// lib/outreach/repo.ts
//
// Admin-SDK-läsning av outreach-collections + ihopsättning av kö-svaret.
// Server-only: importeras ENBART av /api/admin/outreach/*-routes (bakom
// requireAdmin). Collections är helt stängda i firestore.rules (regel 19–21)
// — Admin SDK kringgår reglerna, precis som aggregatedEvents-mönstret.

import type { Firestore } from 'firebase-admin/firestore';
import type {
    OutreachApiUsage, OutreachContact, OutreachLogEntry, QueueItem, QueueResponse, TodayAction,
} from '@/types/outreach';
import { gatesFor, isBlocked, MAX_POSTS_PER_DAY, STADSKROCK_DAGAR } from './rules';
import { scoreContact } from './scoring';
import { eventSupplyForContact } from './eventSupply';
import { stockholmDayKey, VISITS_DOC } from './visits';

const DAY_MS = 86_400_000;

export async function getAllContacts(db: Firestore): Promise<OutreachContact[]> {
    const snap = await db.collection('outreachContacts').get();
    return snap.docs.map(d => ({ ...(d.data() as OutreachContact), id: d.id }));
}

export async function getRecentLog(db: Firestore, sinceMs: number): Promise<OutreachLogEntry[]> {
    // Ett litet svep räcker: loggen är < 1000 rader lång tid framöver.
    const snap = await db.collection('outreachLog')
        .where('draftCreatedAt', '>=', sinceMs)
        .get();
    return snap.docs.map(d => ({ ...(d.data() as OutreachLogEntry), id: d.id }));
}

/** Bygg hela kö-svaret: dagskvot, att-göra-lista, mogna + blockerade grupper. */
export async function buildQueueResponse(db: Firestore): Promise<QueueResponse> {
    const now = Date.now();
    const [contacts, recentLog, visitsSnap, apiUsageSnap] = await Promise.all([
        getAllContacts(db),
        getRecentLog(db, now - 30 * DAY_MS),
        db.collection('outreachStats').doc(VISITS_DOC).get(),
        db.collection('outreachStats').doc('apiUsage').get(),
    ]);
    const visitDays: Record<string, number> = (visitsSnap.data() as any)?.days ?? {};
    const visits = {
        today: visitDays[stockholmDayKey(now)] ?? 0,
        yesterday: visitDays[stockholmDayKey(now - DAY_MS)] ?? 0,
    };
    // Skrivs av draft-routen efter varje generering; null tills första utkastet.
    const apiUsage = apiUsageSnap.exists ? (apiUsageSnap.data() as OutreachApiUsage) : null;

    /* ── DayContext ur loggen ─────────────────────────────────────────────── */
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const sod = startOfDay.getTime();

    const postedToday = recentLog.filter(l =>
        l.channel === 'fb-grupp' && l.confirmedByOwner && (l.postedAt ?? 0) >= sod).length;

    const citiesPostedRecently = new Map<string, number>();
    const cityWindow = now - STADSKROCK_DAGAR * DAY_MS;
    const contactById = new Map(contacts.map(c => [c.id, c]));
    for (const l of recentLog) {
        if (l.channel !== 'fb-grupp' || !l.confirmedByOwner || !l.postedAt || l.postedAt < cityWindow) continue;
        const city = contactById.get(l.contactId)?.city?.toLowerCase();
        if (city) citiesPostedRecently.set(city, Math.max(citiesPostedRecently.get(city) ?? 0, l.postedAt));
    }
    const ctx = { now, postedToday, citiesPostedRecently };

    /* ── Kön: bara FB-grupper rankas (arrangörer har eget mejlflöde) ──────── */
    const groups = contacts.filter(c => c.kind === 'fb-grupp');
    const queue: QueueItem[] = [];
    const blocked: QueueItem[] = [];

    for (const c of groups) {
        // Utbudscache 6 h — annars räknar vi ~21k event × 83 grupper per anrop.
        if (c.eventSupplyThisWeek === undefined || (c.eventSupplyAt ?? 0) < now - 6 * 3_600_000) {
            const supply = await eventSupplyForContact(c);
            if (supply !== undefined) {
                c.eventSupplyThisWeek = supply;
                c.eventSupplyAt = now;
                // fire-and-forget — cachemiss får aldrig blockera svaret
                db.collection('outreachContacts').doc(c.id)
                    .set({ eventSupplyThisWeek: supply, eventSupplyAt: now }, { merge: true })
                    .catch(() => { /* cache-skrivning är best-effort */ });
            }
        }
        const gates = gatesFor(c, ctx);
        const { score, explanation } = scoreContact(c);
        const item: QueueItem = { contact: c, gates, score, scoreExplanation: explanation, blocked: isBlocked(gates) };
        (item.blocked ? blocked : queue).push(item);
    }
    queue.sort((a, b) => b.score - a.score);
    blocked.sort((a, b) => (a.contact.nextAllowedAt ?? 0) - (b.contact.nextAllowedAt ?? 0));

    /* ── Att göra idag ────────────────────────────────────────────────────── */
    const actions: TodayAction[] = [];

    for (const l of recentLog) {
        // Okänt utfall 24 h efter postning — de kroniska '?'-raderna.
        // Bara FB-grupper: mejlen har sin egen uppföljningsrad (followUpDueAt)
        // och ska inte dubbelräknas här.
        if (l.channel === 'fb-grupp' && l.confirmedByOwner && l.postedAt && !l.outcomeCheckedAt && now - l.postedAt > DAY_MS) {
            actions.push({
                type: 'följ-upp-utfall', logId: l.id, contactId: l.contactId, contactName: l.contactName,
                label: `Kolla utfallet i ${l.contactName} (postat ${new Date(l.postedAt).toLocaleDateString('sv-SE')})`,
                dueSince: l.postedAt + DAY_MS,
                groupUrl: contactById.get(l.contactId)?.groupUrl,
            });
        }
        // Kölagt > 24 h — släppte moderatorn igenom det?
        if (l.status === 'i-godkännandekö' && l.postedAt && now - l.postedAt > DAY_MS) {
            actions.push({
                type: 'släpp-kollen', logId: l.id, contactId: l.contactId, contactName: l.contactName,
                label: `Släppte moderatorn inlägget i ${l.contactName}?`,
                dueSince: l.postedAt + DAY_MS,
                groupUrl: contactById.get(l.contactId)?.groupUrl,
            });
        }
    }
    // Förfallna mejluppföljningar (arrangörerna).
    for (const c of contacts) {
        if (c.kind === 'arrangor' && c.followUpDueAt && c.followUpDueAt <= now
            && c.replyStatus !== 'svar' && c.replyStatus !== 'nej' && !c.linkUrl) {
            actions.push({
                type: 'mejluppföljning', contactId: c.id, contactName: c.name,
                label: `Uppföljningsmejl till ${c.name} (skickat för ${Math.round((now - (c.followUpDueAt - 8 * DAY_MS)) / DAY_MS)} d sedan)`,
                dueSince: c.followUpDueAt,
                email: c.email,
            });
        }
    }
    actions.sort((a, b) => (a.dueSince ?? 0) - (b.dueSince ?? 0));

    const loggedCount = await db.collection('outreachLog').count().get()
        .then(s => s.data().count).catch(() => recentLog.length);

    return {
        generatedAt: now,
        quota: { postedToday, maxPerDay: MAX_POSTS_PER_DAY },
        visits,
        apiUsage,
        actions,
        queue,
        blocked,
        counts: {
            contacts: contacts.length,
            groups: groups.length,
            organizers: contacts.filter(c => c.kind === 'arrangor').length,
            logged: loggedCount,
        },
    };
}
