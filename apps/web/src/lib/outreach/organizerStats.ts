// organizerStats — server-only aggregering av eventStats per ARRANGÖR
// (Arrangörer-fliken + mejlgenereringen, 14/9).
//
// KOSTNADSSKYDDET: frågan filtrerar på clicks > 0 — view-only-dokumenten
// (den stora massan, ett per öppnat eventkort) lämnar aldrig Firestore, och
// select() kapar egressen till exakt fälten aggregatet behöver. Svepet är
// proportionellt mot antal KLICKADE event, inte mot trafiken.
//
// Attribution: hostName/domain bakas in i eventStats-dokumentet vid första
// klicket (eventStatsService.recordEventClick) — ingen uppslagning mot
// aggregat/linkEvents behövs, och statistiken överlever att eventet lämnar
// aggregaten. Dokument som bara har views saknar attribution (accepterat).

import type { Firestore } from 'firebase-admin/firestore';
import type { OrganizerEventStat, OrganizerStat } from '@/types/outreach';

/** Fälten aggregatet läser — själva fältmasken mot Firestore. */
const STAT_FIELDS = ['eventId', 'title', 'hostName', 'domain', 'clicks', 'views', 'clicksByMonth', 'clicksByDay'] as const;

interface StatDoc {
    eventId?: string;
    title?: string;
    hostName?: string;
    domain?: string;
    clicks?: number;
    views?: number;
    clicksByMonth?: Record<string, number>;
    clicksByDay?: Record<string, number>;
}

const DAY_MS = 86_400_000;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Summera dagshinkar inom [nu − days, nu]. Tom map → 0. */
function sumDays(byDay: Record<string, number> | undefined, days: number, now: Date): number {
    if (!byDay) return 0;
    const from = new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);
    let sum = 0;
    for (const [day, n] of Object.entries(byDay)) {
        if (day >= from) sum += num(n);
    }
    return sum;
}

function monthKey(d: Date): string { return d.toISOString().slice(0, 7); }

/** Sammanställningen som mejlgenereringen citerar — och radens siffror. */
export interface OrganizerFigures {
    clicks: number;
    views: number;
    clicks7d: number;
    clicks30d: number;
    clicksThisMonth: number;
    clicksPrevMonth: number;
    events: OrganizerEventStat[];
}

function aggregate(docs: StatDoc[], now: Date, maxEvents: number): OrganizerFigures {
    const prevMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15));
    const figures: OrganizerFigures = {
        clicks: 0, views: 0, clicks7d: 0, clicks30d: 0,
        clicksThisMonth: 0, clicksPrevMonth: 0, events: [],
    };
    for (const d of docs) {
        figures.clicks += num(d.clicks);
        figures.views += num(d.views);
        figures.clicks7d += sumDays(d.clicksByDay, 7, now);
        figures.clicks30d += sumDays(d.clicksByDay, 30, now);
        figures.clicksThisMonth += num(d.clicksByMonth?.[monthKey(now)]);
        figures.clicksPrevMonth += num(d.clicksByMonth?.[prevMonth]);
        figures.events.push({
            eventId: d.eventId ?? '',
            title: d.title ?? '(utan titel)',
            clicks: num(d.clicks),
            views: num(d.views),
        });
    }
    figures.events.sort((a, b) => b.clicks - a.clicks);
    figures.events = figures.events.slice(0, maxEvents);
    return figures;
}

/** Kontaktfälten som joinas in per rad. */
interface ContactSlice {
    id: string;
    name: string | null;
    domain: string | null;
    email: string | null;
    replyStatus: string | null;
    followUpDueAt: number | null;
}

/**
 * Hela Arrangörer-fliken: klickade eventStats grupperade på domän (fallback
 * hostName), joinade mot arrangörskontakterna (120 st, select:ade fält),
 * sorterade på senaste månadens klick. `dayDataSince` = äldsta dagshinken —
 * panelen etiketterar 7/30-fönstren ärligt utifrån den (aldrig påhittade
 * fönster innan serien börjat mäta).
 */
export async function buildOrganizerStats(db: Firestore): Promise<{ organizers: OrganizerStat[]; dayDataSince: string | null }> {
    const now = new Date();
    const [statsSnap, contactsSnap] = await Promise.all([
        db.collection('eventStats').where('clicks', '>', 0).select(...STAT_FIELDS).get(),
        db.collection('outreachContacts').where('kind', '==', 'arrangor')
            .select('name', 'domain', 'email', 'replyStatus', 'followUpDueAt').get(),
    ]);

    const contactByDomain = new Map<string, ContactSlice>();
    contactsSnap.docs.forEach(c => {
        const v = c.data() as Record<string, unknown>;
        const domain = typeof v.domain === 'string' ? v.domain.toLowerCase().replace(/^www\./, '') : null;
        if (!domain) return;
        contactByDomain.set(domain, {
            id: c.id,
            name: typeof v.name === 'string' ? v.name : null,
            domain,
            email: typeof v.email === 'string' ? v.email : null,
            replyStatus: typeof v.replyStatus === 'string' ? v.replyStatus : null,
            followUpDueAt: typeof v.followUpDueAt === 'number' ? v.followUpDueAt : null,
        });
    });

    const byKey = new Map<string, StatDoc[]>();
    let dayDataSince: string | null = null;
    statsSnap.docs.forEach(s => {
        const d = s.data() as StatDoc;
        const key = (d.domain ?? d.hostName ?? '').toLowerCase().replace(/^www\./, '');
        if (!key) return; // klick utan attribution — inget att mejla
        const arr = byKey.get(key);
        if (arr) arr.push(d); else byKey.set(key, [d]);
        for (const day of Object.keys(d.clicksByDay ?? {})) {
            if (dayDataSince === null || day < dayDataSince) dayDataSince = day;
        }
    });

    const organizers: OrganizerStat[] = [...byKey.entries()].map(([key, docs]) => {
        const figures = aggregate(docs, now, 8);
        const contact = contactByDomain.get(key) ?? null;
        const hostName = docs.find(d => typeof d.hostName === 'string')?.hostName ?? null;
        return {
            key,
            domain: docs.some(d => d.domain) ? key : null,
            hostName,
            ...figures,
            contactId: contact?.id ?? null,
            contactName: contact?.name ?? null,
            email: contact?.email ?? null,
            replyStatus: contact?.replyStatus ?? null,
            followUpDueAt: contact?.followUpDueAt ?? null,
        };
    });

    // Färska klick överst: månadens, sedan förra månadens, sedan totalen.
    organizers.sort((a, b) =>
        (b.clicksThisMonth - a.clicksThisMonth)
        || (b.clicksPrevMonth - a.clicksPrevMonth)
        || (b.clicks - a.clicks));

    return { organizers: organizers.slice(0, 60), dayDataSince };
}

/**
 * En enskild arrangörs siffror — mejlgenereringens FACIT-underlag. Riktad
 * fråga på domänen (samma fältmask), aldrig klientens siffror. null = inga
 * klickade event alls.
 */
export async function statsForOrganizer(db: Firestore, domain: string): Promise<OrganizerFigures | null> {
    const clean = domain.toLowerCase().replace(/^www\./, '');
    // BARA likhetsfiltret i frågan: domain == + clicks > på olika fält kräver
    // ett composite-index. Domänens dokument är få — klickfiltret tas i minnet.
    const snap = await db.collection('eventStats')
        .where('domain', '==', clean)
        .select(...STAT_FIELDS)
        .get();
    const clicked = snap.docs.map(d => d.data() as StatDoc).filter(d => num(d.clicks) > 0);
    if (clicked.length === 0) return null;
    return aggregate(clicked, new Date(), 5);
}
