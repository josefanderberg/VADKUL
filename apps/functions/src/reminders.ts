/** Event-påminnelser: eventReminders + fönsterlogiken. */
import * as admin from "firebase-admin";
import { db, region, isScrapedEventId } from './shared';
import { sendPushToUser } from './utils/push';
import { eventShareSlug } from '@vadkul/kontrakt';

// ==============================
// EVENT-PÅMINNELSER (automatiskt 1 h innan start + klock-knappens egna fönster)
// ==============================

/**
 * Körs var 5:e minut. TVÅ utskicksvägar på samma tick:
 *
 *  1) AUTOMATISKA 1h-påminnelsen: hittar event som börjar inom en timme och
 *     pushar till alla som ANMÄLT sig (linkEvents/{id}/attendees) eller
 *     GILLAT eventet (users där savedEventIds innehåller event-id:t).
 *  2) KLOCK-KNAPPENS valda fönster (8h/3h/1h/start) ur eventReminderPrefs —
 *     se processReminderPrefs nedan.
 *
 * Dedupe för väg 1: eventReminders/{eventId} skapas med create() INNAN
 * utskicket — finns dokumentet redan har en tidigare körning tagit eventet,
 * så varje event påminns exakt en gång. Dessutom claimas en per-mottagare-
 * markör i eventReminderSends (delad med väg 2) så samma person aldrig får
 * dubbla 1h-notiser när hen både är anmäld/gillare OCH valt 1h i klockan.
 * Ingen klient kan läsa/skriva någon av collectionerna (reglerna är
 * default-deny resp. explicit stängda), bara admin-SDK:t här.
 *
 * Fönstret är (nu, nu+60 min]: med 15-minuters-schemat (glesat 2026-08-19,
 * var tidigare 5 — tredjedelen av scan-läsningarna) fångas eventet första
 * ticken efter att det klivit in i fönstret (~45–60 min innan), och skulle en
 * körning missas tar nästa tick det (så länge eventet inte redan börjat).
 */
export const eventReminders = region.pubsub
    .schedule('every 15 minutes')
    .onRun(async () => {
        const now = admin.firestore.Timestamp.now();
        const inOneHour = admin.firestore.Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000);

        // select() = fältmask: scannen körs var 15:e minut och läser samma event
        // upp till 4 gånger — skicka inte hela ~1 kB-dokumentet över nätet varje
        // gång (egress var den dyra SKU:n aug-26), bara fälten notisen behöver.
        const eventsSnap = await db.collection('linkEvents')
            .where('time', '>', now)
            .where('time', '<=', inOneHour)
            .select('time', 'hasSpecificTime', 'title', 'locationName')
            .get();

        for (const eventDoc of eventsSnap.docs) {
            const event = eventDoc.data();
            // Heldags-event (tid = 00:00 utan klockslag): en "om 1 timme"-notis
            // kl 23 kvällen innan vore fel — hoppa över dem.
            if (event.hasSpecificTime === false) continue;

            const markerRef = db.collection('eventReminders').doc(eventDoc.id);
            try {
                // MOTTAGARNA FÖRST (kostnadsfix 2026-08-19): tidigare skapades
                // markören för VARJE event i fönstret — 46 920 dokument varav 2
                // med mottagare. Nu kollas anmälda ∪ gillare först (2 läsningar,
                // nästan alltid tomma) och event utan mottagare lämnar INGA spår;
                // de omprövas per tick (≤4 ggr à 2 reads) tills fönstret passerat.
                const recipients = new Set<string>();
                const attendeesSnap = await eventDoc.ref.collection('attendees').get();
                attendeesSnap.docs.forEach(d => recipients.add(d.id));
                const likersSnap = await db.collection('users')
                    .where('savedEventIds', 'array-contains', eventDoc.id)
                    .get();
                likersSnap.docs.forEach(d => recipients.add(d.id));

                if (recipients.size === 0) continue;

                // Ta eventet: create() kastar ALREADY_EXISTS om en tidigare tick
                // redan påmint → hoppa vidare. expiresAt låter en Firestore
                // TTL-policy (eller nattens db-janitor) städa markören efteråt.
                try {
                    await markerRef.create({
                        claimedAt: now,
                        eventTime: event.time,
                        expiresAt: admin.firestore.Timestamp.fromMillis(
                            (event.time as admin.firestore.Timestamp).toMillis() + 7 * 24 * 60 * 60 * 1000),
                    });
                } catch {
                    continue;
                }

                const startsAt = (event.time as admin.firestore.Timestamp).toDate()
                    .toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
                const title = `⏰ Om 1 timme: ${event.title}`;
                const body = `Börjar kl ${startsAt}${event.locationName ? ` · ${event.locationName}` : ''}`;
                // /e/<slug> studsar direkt in på kartan med eventet öppet.
                const slug = eventShareSlug(eventDoc.id);
                const url = `/e/${slug}`;

                let delivered = 0;
                for (const uid of recipients) {
                    // Delad exakt-en-gång-markör per (användare, event, fönster)
                    // med klock-pipelinen (processReminderPrefs): har den redan
                    // skickat 1h-notisen till den här personen är fönstret taget
                    // — annars tar vi det här. Vilken väg som än hinner först
                    // vinner, så ingen får dubbla 1h-notiser.
                    try {
                        await db.collection('eventReminderSends')
                            .doc(reminderSendId(slug, uid, '1h'))
                            .create({ uid, eventId: eventDoc.id, slug, window: '1h', via: 'auto', sentAt: now });
                    } catch {
                        continue;
                    }
                    try {
                        delivered += await sendPushToUser(uid, {
                            title, body, url,
                            type: 'eventReminder',
                            eventId: eventDoc.id,
                        });
                    } catch (err) {
                        console.error(`[reminder] Push till ${uid} för event ${eventDoc.id} misslyckades:`, err);
                    }
                }
                await markerRef.update({ sentAt: now, recipients: recipients.size, delivered });
                console.log(`[reminder] "${event.title}" (${eventDoc.id}): ${delivered} leveranser till ${recipients.size} mottagare.`);
            } catch (err) {
                // Markören är redan tagen — logga och gå vidare; nästa event ska inte stoppas.
                console.error(`[reminder] Event ${eventDoc.id} kunde inte behandlas:`, err);
            }
        }

        // Väg 2: klock-knappens valda fönster. Egen try/catch så ett fel här
        // aldrig får det att se ut som att HELA funktionen fallerat (och
        // omvänt: väg 1 ovan sväljer sina egna fel per event).
        try {
            await processReminderPrefs(now);
        } catch (err) {
            console.error('[reminder] Klock-pipelinen fallerade:', err);
        }
        return null;
    });

// ── Klock-knappens påminnelsefönster (eventReminderPrefs) ──────────────────

/** Valbara fönster i eventReminderPrefs.times → minuter före eventstart. */
const PREF_WINDOWS = { '8h': 8 * 60, '3h': 3 * 60, '1h': 60, 'start': 0 } as const;
type PrefWindow = keyof typeof PREF_WINDOWS;

/**
 * Hur långt EFTER fönstrets tidpunkt ett utskick fortfarande är meningsfullt.
 * Schemat tickar var 15:e minut → normalt skickas inom 0–15 min; 30 min täcker
 * en missad körning (deploy, cold start, kortare strul). Äldre än
 * så skickas INTE ikapp: "Om 8 timmar" som landar 2 h före start är fel
 * information — hellre tyst och låta nästa valda fönster ta vid.
 */
const PREF_WINDOW_GRACE_MS = 30 * 60 * 1000;

/**
 * Markör-id i eventReminderSends: exakt en notis per (användare, event,
 * fönster). DELAS av klock-pipelinen och det automatiska 1h-utskicket till
 * anmälda+gillare — det är själva dubbelskyddet, ändra inte formatet ensidigt.
 */
const reminderSendId = (slug: string, uid: string, window: PrefWindow): string =>
    `${slug}_${uid}_${window}`;

/**
 * Titel + plats till notistexten. Användarskapade event läses ur linkEvents —
 * saknas dokumentet är eventet raderat och null betyder "påminn inte".
 * Skrapade event (id = URL) har inget klient-/billigt läsbart dokument
 * (aggregatedEvents är stängd och en destinations-skanning per tick vore för
 * dyr) — eventStats/{slug} bär titeln för allt som någon gång visats, annars
 * faller notistexten tillbaka på en namnlös formulering. Cachen håller det
 * till EN läsning per event och körning, oavsett antal prenumeranter.
 */
async function reminderEventInfo(
    eventId: string,
    slug: string,
    cache: Map<string, { title: string; locationName: string } | null>,
): Promise<{ title: string; locationName: string } | null> {
    if (cache.has(eventId)) return cache.get(eventId) ?? null;
    let info: { title: string; locationName: string } | null;
    if (isScrapedEventId(eventId)) {
        const stats = await db.collection('eventStats').doc(slug).get();
        info = { title: (stats.get('title') as string) || '', locationName: '' };
    } else {
        const snap = await db.collection('linkEvents').doc(eventId).get();
        info = snap.exists
            ? { title: (snap.get('title') as string) || '', locationName: (snap.get('locationName') as string) || '' }
            : null;
    }
    cache.set(eventId, info);
    return info;
}

/**
 * Klock-knappen på eventkortet: webben skriver eventReminderPrefs/{slug}_{uid}
 * med fönstren användaren valt (times ⊆ 8h/3h/1h/start) + eventStart.
 * KONTRAKTET (fältnamn, doc-id-format, times-värdena) delas med webben —
 * ändras det här måste webben följa med, precis som eventShareSlug.
 *
 * Varje tick hämtas prefs vars event ligger inom [nu − grace, nu + 8 h] (+ en
 * ticks marginal åt båda hållen): tidigaste möjliga fönster är 8 h före start,
 * senaste är starten + grace, så inget kan missas trots det snäva intervallet.
 * Ett fönster skickas när dess tidpunkt passerats men gracen inte löpt ut;
 * create() på eventReminderSends-markören garanterar exakt en notis per
 * (användare, event, fönster) även om körningar överlappar — och markören
 * delas med 1h-utskicket till anmälda+gillare så ingen får dubbla 1h.
 *
 * Av-växeln per enhet (vadkul_notiser_av) behöver ingen egen hantering här:
 * "av" raderar enhetens token ur fcmTokens, och sendPushToUser skickar bara
 * till tokens som finns — exakt som befintliga utskick respekterar den.
 */
async function processReminderPrefs(now: admin.firestore.Timestamp): Promise<void> {
    const nowMs = now.toMillis();
    // En extra schematick (15 min) i marginal: gränsfall ska hellre hämtas en
    // gång för mycket (och fällas av tidsvillkoren nedan) än falla mellan två
    // queries. Range på ett enda fält → ingen composite-index behövs.
    const TICK_MS = 15 * 60 * 1000;
    const prefsSnap = await db.collection('eventReminderPrefs')
        .where('eventStart', '>', admin.firestore.Timestamp.fromMillis(nowMs - PREF_WINDOW_GRACE_MS - TICK_MS))
        .where('eventStart', '<=', admin.firestore.Timestamp.fromMillis(nowMs + PREF_WINDOWS['8h'] * 60 * 1000 + TICK_MS))
        .get();
    if (prefsSnap.empty) return;

    const infoCache = new Map<string, { title: string; locationName: string } | null>();
    let sent = 0;

    for (const prefDoc of prefsSnap.docs) {
        const pref = prefDoc.data();
        const { uid, eventId, slug, eventStart } = pref;
        // Reglerna formlåser dokumenten, men bältet kostar inget: ett trasigt
        // dokument ska inte kunna välta hela körningen.
        if (typeof uid !== 'string' || typeof eventId !== 'string' || typeof slug !== 'string'
            || !(eventStart instanceof admin.firestore.Timestamp) || !Array.isArray(pref.times)) {
            continue;
        }
        const startMs = eventStart.toMillis();

        for (const chosen of pref.times) {
            if (typeof chosen !== 'string' || !(chosen in PREF_WINDOWS)) continue;
            const window = chosen as PrefWindow;
            const sendAtMs = startMs - PREF_WINDOWS[window] * 60 * 1000;
            // Aktuellt = tidpunkten passerad men gracen inte löpt ut …
            if (nowMs < sendAtMs || nowMs > sendAtMs + PREF_WINDOW_GRACE_MS) continue;
            // … och för-fönstren ALDRIG efter att eventet börjat (redundant så
            // länge grace ≤ 1 h, men skyddar den som höjer gracen utan att tänka).
            if (PREF_WINDOWS[window] > 0 && nowMs >= startMs) continue;

            // Raderat användarskapat event → påminn inte. Ingen markör behövs
            // för att minnas det: samma villkor fäller fönstret varje tick
            // tills gracen löpt ut, sedan hämtas prefen aldrig mer.
            const info = await reminderEventInfo(eventId, slug, infoCache);
            if (info === null) continue;

            // Ta fönstret: create() kastar ALREADY_EXISTS om en tidigare tick
            // — eller det automatiska 1h-utskicket — redan skickat.
            try {
                await db.collection('eventReminderSends')
                    .doc(reminderSendId(slug, uid, window))
                    .create({ uid, eventId, slug, window, via: 'pref', sentAt: now });
            } catch {
                continue;
            }

            const name = info.title || 'eventet du bevakar';
            const title = window === 'start' ? `🎉 Nu börjar: ${name}`
                : window === '1h' ? `⏰ Om 1 timme: ${name}`
                    : window === '3h' ? `⏰ Om 3 timmar: ${name}`
                        : `⏰ Om 8 timmar: ${name}`;
            const startsAt = eventStart.toDate()
                .toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
            const loc = info.locationName ? ` · ${info.locationName}` : '';
            const body = window === 'start' ? `Börjar nu, kl ${startsAt}${loc}` : `Börjar kl ${startsAt}${loc}`;

            try {
                sent += await sendPushToUser(uid, {
                    title, body,
                    // /e/<slug> studsar direkt in på kartan med eventet öppet.
                    url: `/e/${slug}`,
                    type: 'eventReminder',
                    eventId,
                });
            } catch (err) {
                // Markören är redan tagen — notisen är förlorad, samma
                // avvägning som väg 1: hellre en tappad notis än risk för
                // dubbletter. Logga och gå vidare.
                console.error(`[reminder] Klock-push (${window}) till ${uid} för ${eventId} misslyckades:`, err);
            }
        }
    }
    if (sent > 0) console.log(`[reminder] Klock-prefs: ${sent} leveranser den här körningen.`);
}

