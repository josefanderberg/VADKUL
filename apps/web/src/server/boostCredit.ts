/**
 * KREDITDAGAR - serverdelen (Admin SDK), bakom /api/boost/credit/settle och
 * /api/boost/credit/apply. Ägarbeslut 4/11 2026 (Josef): "de dagar man inte
 * förbrukar ... ska man ha återstående tid som man kan lägga på en annan
 * event när det eventet försvinner. Men man kan minst förlora en dag. Och
 * tänk på att man inte kan utnyttja det. Eventet måste vara slut innan man
 * får kreditdagar."
 *
 * Bodde först som två Cloud Functions (settleBoostCredits/applyBoostCredit,
 * 4/11) men deploy-kontot får inte sätta anropsrättigheten (IAM invoker) på
 * NYA funktioner, så de svarade 403. Webbens API-routes kör i hosting-
 * backendens SSR-funktion med Admin SDK:t (lib/firestore-admin) och behöver
 * ingen sådan rättighet - samma Firestore-skrivningar, samma regler.
 *
 * Regeln (dygnet efter eventet, hela dagar, minus en dag) bor i kontraktet
 * (@vadkul/kontrakt boostCredit.ts, testad). Saldot i boostCredits/{uid}
 * { days, updatedAt } har INGEN match i firestore.rules = stängd för
 * klienten; bara den här modulen rör den. Kvittona (boostPayments) skrivs av
 * functions confirmBoost (from/until/eventTime sedan 4/11) och av
 * applyBoostCredit här (kredit-kvitton, `credit: true`).
 *
 * Flödet: klienten anropar settle när boost-väljaren eller profilen öppnas →
 * egna kvitton vars event hunnit vara avräknas EN gång (creditSettledAt),
 * saldot höjs och den gamla boosten klipps (featuredUntil = nu, så ett
 * ägarredigerat datum inte kan väcka den). apply lägger hela saldot på ett
 * annat event utan Stripe - samma skrivning som confirmBoost, med ett
 * kredit-kvitto som i sin tur kan avräknas (krymper med avgiften varje varv).
 */
import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { creditDaysFor, DAY_MS, eventEndsAtMs, eventShareSlug } from '@vadkul/kontrakt';
import { getAdminAuth, getAdminDb } from '@/lib/firestore-admin';

/** Fel med HTTP-status - routen svarar { error } med statusen. */
export class BoostCreditError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
    }
}

/** Skrapade event har källans URL som id (snedstreck); linkEvents-id:n kan
 *  aldrig innehålla snedstreck. Samma regel som functions shared.ts. */
const isScrapedEventId = (id: string): boolean => id.includes('/');

/** Var boosten bor: egna event på linkEvents-dokumentet, skrapade i
 *  overlayn eventBoosts/{slug} (functions boostTargetRef). */
const boostTargetRef = (db: Firestore, eventId: string): DocumentReference =>
    isScrapedEventId(eventId)
        ? db.collection('eventBoosts').doc(eventShareSlug(eventId))
        : db.collection('linkEvents').doc(eventId);

const creditRef = (db: Firestore, uid: string) => db.collection('boostCredits').doc(uid);

const toMs = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : null);

const timeIso = (v: unknown): string | null => {
    if (v instanceof Timestamp) return v.toDate().toISOString();
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
    return null;
};

/**
 * Vem anropar? Bearer-token ur Authorization-headern verifieras med Admin
 * SDK:t; anonyma tips-sessioner räknas inte (kreditdagar hör till ett konto
 * man kan komma tillbaka till, som boost-köpet).
 */
export async function requireAccount(request: Request): Promise<string> {
    const header = request.headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new BoostCreditError(401, 'Du måste vara inloggad.');
    const auth = getAdminAuth();
    if (!auth) throw new BoostCreditError(503, 'Tjänsten är inte tillgänglig just nu.');
    try {
        const decoded = await auth.verifyIdToken(token);
        if (decoded.firebase?.sign_in_provider === 'anonymous') throw new BoostCreditError(401, 'Du måste vara inloggad.');
        return decoded.uid;
    } catch (e) {
        if (e instanceof BoostCreditError) throw e;
        throw new BoostCreditError(401, 'Du måste vara inloggad.');
    }
}

export function requireDb(): Firestore {
    const db = getAdminDb();
    if (!db) throw new BoostCreditError(503, 'Tjänsten är inte tillgänglig just nu.');
    return db;
}

/**
 * Det skrapade eventet ur aggregatens destinations-lager (null = finns
 * inte): ett doc med events-array eller ett index-doc med shardCount +
 * destinations_N-shards. Några få admin-reads; boostar är sällsynta.
 */
async function findScrapedEvent(db: Firestore, eventId: string): Promise<{ time?: unknown } | null> {
    const index = await db.collection('aggregatedEvents').doc('destinations').get();
    if (!index.exists) return null;
    const data = index.data() || {};
    const find = (events: unknown): { time?: unknown } | null =>
        (Array.isArray(events) ? events.find((e: { id?: unknown }) => e?.id === eventId) : undefined) ?? null;
    const hit = find(data.events);
    if (hit) return hit;
    const shardCount = typeof data.shardCount === 'number' ? data.shardCount : 0;
    for (let i = 0; i < shardCount; i++) {
        const shard = await db.collection('aggregatedEvents').doc(`destinations_${i}`).get();
        const h = find(shard.data()?.events);
        if (h) return h;
    }
    return null;
}

/** Finns eventet (samma villkor som checkouten)? Ger dess tid (ISO) till kvittot. */
async function boostableEventTime(db: Firestore, eventId: string): Promise<string | null> {
    if (isScrapedEventId(eventId)) {
        const found = await findScrapedEvent(db, eventId);
        if (!found) throw new BoostCreditError(404, 'Eventet går inte att boosta.');
        return timeIso(found.time);
    }
    const snap = await db.collection('linkEvents').doc(eventId).get();
    if (!snap.exists) throw new BoostCreditError(404, 'Eventet går inte att boosta.');
    return timeIso(snap.data()?.time);
}

/**
 * När eventet bakom ett kvitto är slut (ms). null = vet inte / tar aldrig
 * slut (tills vidare-serie, skrapat event som försvunnit ur aggregaten) -
 * då avräknas inget. 'deleted' = raderat eget event: boosten går inte att
 * använda men eventet har inte VARIT, så ingen kredit (ägarbeslutets villkor).
 */
async function receiptEventEndsMs(db: Firestore, eventId: string, receiptEventTime: unknown): Promise<number | null | 'deleted'> {
    if (isScrapedEventId(eventId)) {
        const iso = typeof receiptEventTime === 'string'
            ? receiptEventTime
            : timeIso((await findScrapedEvent(db, eventId))?.time);
        const ms = iso ? Date.parse(iso) : NaN;
        return Number.isFinite(ms) ? ms : null;
    }
    const snap = await db.collection('linkEvents').doc(eventId).get();
    if (!snap.exists) return 'deleted';
    const d = snap.data() || {};
    const timeMs = toMs(d.time) ?? (typeof d.time === 'string' ? Date.parse(d.time) : NaN);
    if (!Number.isFinite(timeMs)) return null;
    return eventEndsAtMs({
        timeMs,
        repeatWeekly: d.repeatWeekly,
        repeatWeeks: d.repeatWeeks,
        repeatIntervalWeeks: d.repeatIntervalWeeks,
        repeatDays: d.repeatDays,
        seriesEndsAtMs: toMs(d.seriesEndsAt),
    });
}

export interface CreditBalance {
    days: number;
    settled: number;
}

/** Avräkna anroparens kvitton vars event hunnit vara; svara med saldot. */
export async function settleBoostCredits(db: Firestore, uid: string, now = Date.now()): Promise<CreditBalance> {
    const snap = await db.collection('boostPayments').where('uid', '==', uid).limit(200).get();
    let settled = 0;
    for (const doc of snap.docs) {
        const r = doc.data() || {};
        if (r.creditSettledAt || typeof r.eventId !== 'string' || !r.eventId) continue;
        const eventId: string = r.eventId;
        const ends = await receiptEventEndsMs(db, eventId, r.eventTime);
        if (ends === null) continue;
        const targetRef = boostTargetRef(db, eventId);
        try {
            const granted = await db.runTransaction(async (tx) => {
                const [fresh, target] = await Promise.all([tx.get(doc.ref), tx.get(targetRef)]);
                const fd = fresh.data() || {};
                if (!fresh.exists || fd.creditSettledAt) return null;
                const t = target.exists ? (target.data() || {}) : {};
                const targetUntil = toMs(t.featuredUntil);
                let days = 0;
                let cutBoost = false;
                if (ends !== 'deleted') {
                    const fromMs = toMs(fd.from) ?? toMs(fd.appliedAt);
                    const untilMs = toMs(fd.until) ?? targetUntil;
                    if (fromMs !== null && untilMs !== null) {
                        const c = creditDaysFor({ fromMs, untilMs }, ends, now);
                        if (c === null) return null; // eventet har inte varit än
                        days = c;
                        // Klipp den avräknade boosten om kvittot är dess sista
                        // fönster - annars kunde ett redigerat datum tända
                        // samma dagar igen.
                        cutBoost = targetUntil !== null && targetUntil > now && untilMs >= targetUntil;
                    }
                }
                tx.update(doc.ref, { creditSettledAt: FieldValue.serverTimestamp(), creditDays: days });
                if (days > 0) {
                    tx.set(creditRef(db, uid), {
                        days: FieldValue.increment(days),
                        updatedAt: FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
                if (cutBoost && target.exists) {
                    tx.update(targetRef, { featuredUntil: Timestamp.fromMillis(now) });
                }
                return days;
            });
            if (granted !== null) {
                settled++;
                console.log(`[boost] Kvitto ${doc.id} (event ${eventId}, user ${uid}) avräknat: ${granted} kreditdagar.`);
            }
        } catch (e) {
            // Ett trasigt kvitto ska inte stoppa de andra - det avräknas nästa gång.
            console.error(`[boost] Kunde inte avräkna kvitto ${doc.id}:`, e);
        }
    }
    const credit = await creditRef(db, uid).get();
    const days = Math.max(0, Math.floor(Number(credit.data()?.days ?? 0)) || 0);
    return { days, settled };
}

export interface CreditApplied {
    applied: true;
    until: string;
    days: number;
    daysLeft: number;
}

/** Lägg HELA saldot (tak 90 d, som en betald boost) på eventet - utan Stripe. */
export async function applyBoostCredit(db: Firestore, uid: string, rawEventId: string, now = Date.now()): Promise<CreditApplied> {
    const trimmed = rawEventId.trim();
    if (!trimmed) throw new BoostCreditError(400, 'Inget event angivet.');
    // Serietillfälle "<docId>__<datum>" → seriens dokument (samma som checkouten).
    const eventId = isScrapedEventId(trimmed) ? trimmed : trimmed.split('__')[0];
    const eventTime = await boostableEventTime(db, eventId);
    const scraped = isScrapedEventId(eventId);
    const targetRef = boostTargetRef(db, eventId);
    const receiptId = `credit_${uid}_${now}`;
    const receiptRef = db.collection('boostPayments').doc(receiptId);

    const result = await db.runTransaction(async (tx) => {
        const [credit, target] = await Promise.all([tx.get(creditRef(db, uid)), tx.get(targetRef)]);
        const days = Math.min(90, Math.max(0, Math.floor(Number(credit.data()?.days ?? 0)) || 0));
        if (days < 1) throw new BoostCreditError(409, 'Du har inga kreditdagar att lägga på.');
        if (!scraped && !target.exists) throw new BoostCreditError(404, 'Eventet finns inte längre.');
        const t = target.exists ? (target.data() || {}) : {};
        const base = Math.max(now, toMs(t.featuredUntil) ?? 0);
        const until = new Date(base + days * DAY_MS);
        const paymentId = receiptId;
        if (scraped) {
            // eventId med: slug-hashen är enkelriktad, klienten parar via URL:en.
            tx.set(targetRef, { eventId, featuredUntil: Timestamp.fromDate(until), featuredPaymentId: paymentId }, { merge: true });
        } else {
            tx.update(targetRef, { featuredUntil: Timestamp.fromDate(until), featuredPaymentId: paymentId });
        }
        tx.set(receiptRef, {
            uid, eventId, boostDays: days, paymentId, sessionId: receiptId,
            credit: true,
            appliedAt: FieldValue.serverTimestamp(),
            from: Timestamp.fromMillis(base),
            until: Timestamp.fromDate(until),
            eventTime,
        });
        tx.set(creditRef(db, uid), { days: FieldValue.increment(-days), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return { applied: true as const, until: until.toISOString(), days, daysLeft: 0 };
    });
    console.log(`[boost] Event ${eventId} boostat ${result.days} kreditdagar (user ${uid}).`);
    return result;
}

/** Routernas gemensamma felsvar: BoostCreditError → dess status, allt annat 500. */
export function creditErrorResponse(e: unknown): { status: number; error: string } {
    if (e instanceof BoostCreditError) return { status: e.status, error: e.message };
    console.error('[boost/credit]', e);
    return { status: 500, error: 'Något gick fel. Försök igen om en stund.' };
}
