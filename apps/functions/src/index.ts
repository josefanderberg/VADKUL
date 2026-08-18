import * as functions from "firebase-functions/v1";

import * as admin from "firebase-admin";
import { createHash } from "crypto";

admin.initializeApp();
const db = admin.firestore();

// Sätt region till europa för lägre latency (matcha klienten)
// Använd 'europe-west1' (Belgien) typiskt för Firebase projekt i europa om inget annat valts
const region = functions.region('europe-west1');

import { scrapeTickster } from './scrapers/tickster';
import { scrapeEventbrite } from './scrapers/eventbrite';
import { sendPushToUser } from './utils/push';
import { eventShareSlug } from './utils/eventShareSlug';

/**
 * Daily Scraper Bot
 * Runs every day at 06:00 Stockholm time
 */
export const dailyScraper = region.pubsub
    .schedule('0 6 * * *')
    .timeZone('Europe/Stockholm')
    .onRun(async (context) => {
        console.log('--- DAILY SCRAPER BOT STARTING ---');
        console.log(`Time: ${new Date().toISOString()}`);

        try {
            // Run scrapers that don't require a browser
            console.log('Running Tickster Scraper...');
            await scrapeTickster();

            console.log('Running Eventbrite Scraper...');
            await scrapeEventbrite();

            console.log('--- DAILY SCRAPER BOT FINISHED ---');
        } catch (error) {
            console.error('Scraper Bot encountered an error:', error);
        }
        return null;
    });

export const redeemCode = region.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    // 1. Auth Check - Ensure user is logged in
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Du måste vara inloggad för att lösa in koder.'
        );
    }

    const { code } = data;
    const uid = context.auth.uid;

    if (!code || typeof code !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Ingen kod angiven.'
        );
    }

    const normalizedCode = code.toUpperCase().trim();
    const VALID_CODES = ['H2K2']; // Här kan vi ha en "hemlig" lista på servern

    if (!VALID_CODES.includes(normalizedCode)) {
        return { success: false, message: 'Ogiltig kod.' };
    }

    const userRef = db.collection('users').doc(uid);

    try {
        let message = "";

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Användaren hittades inte.');
            }

            const userData = userDoc.data() || {};
            const redeemed = userData.redeemedCodes || [];

            if (redeemed.includes(normalizedCode)) {
                // TOGGLE OFF
                const newRedeemed = redeemed.filter((c: string) => c !== normalizedCode);
                transaction.update(userRef, {
                    redeemedCodes: newRedeemed
                });
                message = 'Koden godkänd. Premium avaktiverat.';
            } else {
                // TOGGLE ON
                transaction.update(userRef, {
                    redeemedCodes: [...redeemed, normalizedCode]
                });
                message = 'Koden godkänd. Premium aktiverat!';
            }
        });

        return { success: true, message };

    } catch (error) {
        console.error("Redeem error:", error);
        throw new functions.https.HttpsError(
            'internal',
            'Ett fel uppstod vid inlösning av koden.'
        );
    }
});

// ==============================
// STJÄRN-GÅVAN (tack-kampanj till de första ~100 användarna)
// ==============================
//
// EN gemensam kampanjlänk (/?stjarna=STJARNA1) ger varje konto EN stjärna ⭐
// som kan sättas på VALFRITT event. users/{uid}.starGift: 'unused' → 'placed'
// (+ starEventId) och eventStars/{docId} skrivs ENBART härifrån via admin-SDK:t
// — Firestore-reglerna blockerar all klientskrivning av både eventStars och
// starGift-fälten, annars vore gåvan förfalskbar.

// Giltiga kampanjkoder. Inlösen begränsas per KONTO (starGift-fältet), inte
// per kod — koderna finns för att kunna hålla isär kampanjer i attributionen
// (starGiftCode på user-dokumentet): STJARNA1 = publika kampanjer (FB-grupper
// m.m.), ARRANGOR1 = arrangörs-outreachen (docs/outreach/), MEDLEM1 =
// medlemsutskicket via Zoho Campaigns, STJARNA2 = nya mejlutskicket (aug -26)
// — samma mekanik som STJARNA1, egen kod enbart för attributionens skull.
const STAR_GIFT_CODES = ['STJARNA1', 'ARRANGOR1', 'MEDLEM1', 'STJARNA2'];

/** Lös in stjärn-gåvan: sätter starGift='unused' på kontot, max en gång. */
export const redeemStarGift = region.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Du måste vara inloggad för att hämta din stjärna.'
        );
    }

    const { code } = data;
    const uid = context.auth.uid;

    if (!code || typeof code !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Ingen kod angiven.');
    }
    if (!STAR_GIFT_CODES.includes(code.toUpperCase().trim())) {
        return { success: false, message: 'Ogiltig gåvolänk.' };
    }

    const userRef = db.collection('users').doc(uid);

    try {
        let result: { success: boolean; status: 'unused' | 'placed'; message: string } = {
            success: true, status: 'unused', message: 'Du har en stjärna! ⭐'
        };

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.exists ? (userDoc.data() || {}) : {};

            if (userData.starGift === 'placed') {
                result = { success: false, status: 'placed', message: 'Din stjärna är redan använd — den sitter på ett event. ⭐' };
                return;
            }
            if (userData.starGift === 'unused') {
                result = { success: false, status: 'unused', message: 'Du har redan hämtat din stjärna — öppna ett event och tryck på ⭐.' };
                return;
            }
            // users-dokumentet ska finnas (skapas vid registrering), men gamla
            // konton utan doc får inte fastna → set med merge täcker båda.
            // starGiftCode = vilken kampanj stjärnan kom från (attribution).
            transaction.set(userRef, { starGift: 'unused', starGiftCode: code.toUpperCase().trim() }, { merge: true });
        });

        return result;
    } catch (error) {
        console.error('[stjärna] Inlösen misslyckades:', error);
        throw new functions.https.HttpsError('internal', 'Ett fel uppstod. Försök igen.');
    }
});

/**
 * Sätt sin stjärna på ett event: kräver starGift='unused'. Skapar
 * eventStars/{safeEventKey__uid} + flippar starGift='placed' i SAMMA
 * transaction, så stjärnan aldrig kan dubbelplaceras. Flera användares
 * stjärnor på samma event är ok (uid ingår i doc-id:t).
 */
export const placeStar = region.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Du måste vara inloggad för att sätta din stjärna.'
        );
    }

    const { eventId } = data;
    const uid = context.auth.uid;

    if (!eventId || typeof eventId !== 'string' || eventId.length > 1000) {
        throw new functions.https.HttpsError('invalid-argument', 'Ogiltigt event.');
    }

    // Doc-id får inte innehålla '/' (skrapade event-id:n kan vara URL:ar) —
    // hasha sådana till en kort hex-nyckel. Själva eventId ligger orört i fältet.
    const safeEventKey = eventId.includes('/')
        ? createHash('sha256').update(eventId).digest('hex').slice(0, 32)
        : eventId;
    const starRef = db.collection('eventStars').doc(`${safeEventKey}__${uid}`);
    const userRef = db.collection('users').doc(uid);

    try {
        let result: { success: boolean; message: string } = {
            success: true, message: 'Din stjärna sitter! ⭐'
        };

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.exists ? (userDoc.data() || {}) : {};

            if (userData.starGift === 'placed') {
                result = { success: false, message: 'Din stjärna är redan placerad — den kan bara användas en gång.' };
                return;
            }
            if (userData.starGift !== 'unused') {
                result = { success: false, message: 'Du har ingen stjärna att sätta. Har du klickat på gåvolänken?' };
                return;
            }

            // create() kastar om dokumentet redan finns — kan inte hända när
            // starGift-gaten håller, men skyddar mot race på samma konto.
            transaction.create(starRef, {
                eventId,
                uid,
                createdAt: admin.firestore.Timestamp.now(),
            });
            transaction.update(userRef, { starGift: 'placed', starEventId: eventId });
        });

        return result;
    } catch (error) {
        console.error('[stjärna] Placering misslyckades:', error);
        throw new functions.https.HttpsError('internal', 'Ett fel uppstod. Försök igen.');
    }
});

// ==============================
// PUSH NOTIFICATIONS
// ==============================

/**
 * Cloud Function: Send push notification when a new notification is created
 * Triggers on: onCreate in /notifications collection
 */
export const sendPushNotification = region.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap: functions.firestore.QueryDocumentSnapshot, context: functions.EventContext) => {

        const notification = snap.data();
        const recipientId = notification.recipientId;

        if (!recipientId) {
            console.warn('Notification missing recipientId');
            return;
        }

        try {
            // Get all FCM tokens for the recipient
            const tokensSnapshot = await db
                .collection('fcmTokens')
                .doc(recipientId)
                .collection('tokens')
                .get();

            if (tokensSnapshot.empty) {
                console.log(`No FCM tokens for user ${recipientId}`);
                return;
            }

            const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

            // Determine notification title and body based on type
            let title = 'VADKUL';
            let body = notification.message || 'Du har en ny notis';
            let url = '/';

            switch (notification.type) {
                case 'join':
                    title = '🎉 Ny deltagare!';
                    body = notification.message;
                    url = `/event/${notification.eventId}`;
                    break;
                case 'chat':
                    title = '💬 Nytt meddelande';
                    body = notification.message;
                    url = '/chat';
                    break;
                case 'comment':
                    title = '💬 Ny kommentar';
                    body = notification.message;
                    url = `/event/${notification.eventId}`;
                    break;
                default:
                    title = 'VADKUL';
                    body = notification.message;
            }

            // Create FCM message
            const message = {
                notification: {
                    title,
                    body,
                },
                data: {
                    type: notification.type || 'general',
                    url,
                    eventId: notification.eventId || '',
                },
                tokens, // Send to all user's devices
            };

            // Send notification
            const response = await admin.messaging().sendEachForMulticast(message);

            console.log(`Push notification sent. Success: ${response.successCount}, Failed: ${response.failureCount}`);

            // Remove invalid tokens
            if (response.failureCount > 0) {
                const invalidTokens: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.error(`Token ${tokens[idx]} failed:`, resp.error);
                        invalidTokens.push(tokens[idx]);
                    }
                });

                // Delete invalid tokens
                const batch = db.batch();
                invalidTokens.forEach(token => {
                    const tokenRef = db
                        .collection('fcmTokens')
                        .doc(recipientId)
                        .collection('tokens')
                        .doc(token);
                    batch.delete(tokenRef);
                });
                await batch.commit();
                console.log(`Deleted ${invalidTokens.length} invalid tokens`);
            }
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    });

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
 * Fönstret är (nu, nu+60 min]: med 5-minuters-schemat fångas eventet första
 * ticken efter att det klivit in i fönstret (~55–60 min innan), och skulle en
 * körning missas tar nästa tick det (så länge eventet inte redan börjat).
 */
export const eventReminders = region.pubsub
    .schedule('every 5 minutes')
    .onRun(async () => {
        const now = admin.firestore.Timestamp.now();
        const inOneHour = admin.firestore.Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000);

        const eventsSnap = await db.collection('linkEvents')
            .where('time', '>', now)
            .where('time', '<=', inOneHour)
            .get();

        for (const eventDoc of eventsSnap.docs) {
            const event = eventDoc.data();
            // Heldags-event (tid = 00:00 utan klockslag): en "om 1 timme"-notis
            // kl 23 kvällen innan vore fel — hoppa över dem.
            if (event.hasSpecificTime === false) continue;

            // Ta eventet: create() kastar ALREADY_EXISTS om en tidigare körning
            // redan påmint → hoppa vidare.
            const markerRef = db.collection('eventReminders').doc(eventDoc.id);
            try {
                await markerRef.create({ claimedAt: now, eventTime: event.time });
            } catch {
                continue;
            }

            try {
                // Anmälda (subcollectionens doc-id = uid) ∪ gillare.
                const recipients = new Set<string>();
                const attendeesSnap = await eventDoc.ref.collection('attendees').get();
                attendeesSnap.docs.forEach(d => recipients.add(d.id));
                const likersSnap = await db.collection('users')
                    .where('savedEventIds', 'array-contains', eventDoc.id)
                    .get();
                likersSnap.docs.forEach(d => recipients.add(d.id));

                if (recipients.size === 0) {
                    await markerRef.update({ sentAt: now, recipients: 0, delivered: 0 });
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
 * Schemat tickar var 5:e minut → normalt skickas inom 0–5 min; 30 min täcker
 * en handfull missade körningar (deploy, cold start, kortare strul). Äldre än
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
    // En extra schematick (5 min) i marginal: gränsfall ska hellre hämtas en
    // gång för mycket (och fällas av tidsvillkoren nedan) än falla mellan två
    // queries. Range på ett enda fält → ingen composite-index behövs.
    const TICK_MS = 5 * 60 * 1000;
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

// ==============================
// EVENT-BOOST (Stripe)
// ==============================

/**
 * Skapar Checkout-sessionen för en boost — vår EGEN, i stället för den som
 * `firestore-stripe-payments`-extensionen skapar från customers/{uid}/checkout_sessions.
 *
 * VARFÖR egen: Stripe slår på Managed Payments (Stripe/Link som merchant of
 * record) som default på kontot, och den kräver att produkten har en tax code
 * ur listan för DIGITALA VAROR. En boost är betald synlighet — annonsering —
 * som dessutom säljs via en plattform, alltså två saker Managed Payments
 * uttryckligen inte stödjer. Enda dokumenterade avstängningen är per session
 * (`managed_payments.enabled = false`), och extensionen bygger sessionen från
 * en FAST fältlista och kastar okända fält. Därför skapar vi sessionen själva.
 *
 * Resten av kedjan är orörd: vi återanvänder kundkopplingen extensionen redan
 * håller (`customers/{uid}.stripeId`), så dess webhook skriver fortfarande
 * customers/{uid}/payments när betalningen går igenom — och `applyEventBoost`
 * nedan gör jobbet precis som förut.
 */

/**
 * Boost i TRE nivåer. Priserna (Stripe Price-ID) sätts i apps/functions/.env —
 * aldrig av klienten: den skickar bara `tier`, och backend slår upp både pris
 * och antal dagar här. _WEEK faller tillbaka på gamla STRIPE_BOOST_PRICE_ID så
 * en deploy UTAN de nya env-nycklarna beter sig exakt som förut (en nivå,
 * 7 dagar — speglar BOOST_DURATION_DAYS i webbens boostService.ts). Dagarna
 * åker med som boostDays-metadata på sessionen + payment_intent, så
 * fulfillment (confirmBoost/applyEventBoost) är helt nivå-omedveten.
 */
type BoostTier = 'day' | 'week' | 'month';
const BOOST_TIERS: Record<BoostTier, { days: number; priceId: string }> = {
    day: { days: 1, priceId: process.env.STRIPE_BOOST_PRICE_ID_DAY || '' },
    week: { days: 7, priceId: process.env.STRIPE_BOOST_PRICE_ID_WEEK || process.env.STRIPE_BOOST_PRICE_ID || '' },
    month: { days: 30, priceId: process.env.STRIPE_BOOST_PRICE_ID_MONTH || '' },
};
/**
 * Vart Stripe får skicka tillbaka webbläsaren. Klienten skickar sin egen URL,
 * men den valideras mot den här listan — annars vore funktionen en öppen
 * redirect med Stripes namn framför.
 */
const RETURN_ORIGINS = ['https://vadkul.se', 'https://www.vadkul.se', 'http://localhost:3000'];

const safeReturnUrl = (raw: unknown): string => {
    if (typeof raw !== 'string' || !raw) return 'https://vadkul.se';
    try {
        const url = new URL(raw);
        return RETURN_ORIGINS.includes(url.origin) ? url.toString() : 'https://vadkul.se';
    } catch {
        return 'https://vadkul.se';
    }
};

/**
 * Skrapade event har källans URL som id (url är primärnyckeln i hela
 * pipelinen); linkEvents-dokument har Firestore-id:n, som aldrig kan
 * innehålla snedstreck. Snedstrecket skiljer alltså spåren åt.
 */
const isScrapedEventId = (id: string): boolean => id.includes('/');

/**
 * Var boosten bor. Användarskapade event: featuredUntil på själva
 * linkEvents-dokumentet. Skrapade event har inget dokument klienten får läsa
 * (aggregatedEvents är stängd sedan egress-fixen) — deras boost läggs i
 * overlay-kollektionen eventBoosts/{slug}, som webben läser och mappar
 * tillbaka på kart-eventen via fältet eventId. Slug i stället för URL som
 * dokument-id eftersom Firestore-id:n inte får innehålla snedstreck — samma
 * FNV-hash som /e/-länkarna, så id:t är stabilt för alltid.
 */
const boostTargetRef = (eventId: string) =>
    isScrapedEventId(eventId)
        ? db.collection('eventBoosts').doc(eventShareSlug(eventId))
        : db.collection('linkEvents').doc(eventId);

/**
 * Finns det skrapade eventet i aggregatens destinations-lager? Kollas innan
 * checkout skapas — ingen ska betala för ett id som inte pekar på något.
 * Destinations är antingen ett doc med events-array eller ett index-doc med
 * shardCount + destinations_N-shards; några få admin-reads, och boost-köp är
 * sällsynta, så kostnaden är försumbar.
 */
async function scrapedEventExists(eventId: string): Promise<boolean> {
    const index = await db.collection('aggregatedEvents').doc('destinations').get();
    if (!index.exists) return false;
    const data = index.data() || {};
    const inArr = (events: unknown) =>
        Array.isArray(events) && events.some((e: any) => e?.id === eventId);
    if (inArr(data.events)) return true;
    const shardCount = typeof data.shardCount === 'number' ? data.shardCount : 0;
    for (let i = 0; i < shardCount; i++) {
        const shard = await db.collection('aggregatedEvents').doc(`destinations_${i}`).get();
        if (inArr(shard.data()?.events)) return true;
    }
    return false;
}

export const createBoostCheckout = functions
    // invoker: 'public' — nya Gen1-funktioner får INTE allUsers-invoker
    // automatiskt längre, och utan den svarar Google 403 innan koden startar
    // (de äldre callables i filen har bindningen sedan tidigare). Anropet är
    // fortfarande skyddat: auth-kontrollen sker i koden via context.auth.
    .runWith({ secrets: ['STRIPE_API_KEY'], invoker: 'public' })
    .region('europe-west1')
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Du måste vara inloggad för att boosta ett event.');
        }
        // Anonym tips-session räknas inte som inloggad: betalningen ska knytas
        // till ett konto personen kan komma tillbaka till (och kvittot mailas dit).
        if (context.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new functions.https.HttpsError('unauthenticated', 'Du måste vara inloggad för att boosta ett event.');
        }
        // Nivån är valfri — utelämnad (eller null) betyder 'week', så gamla
        // bundlar som inte skickar tier köper 7-dagarsboosten precis som innan.
        // Allt annat än de tre kända nivåerna avvisas hårt: tier väljer pris,
        // och ett påhittat värde ska aldrig tyst bli ett köp på fel nivå.
        const rawTier = data?.tier;
        if (rawTier != null && rawTier !== 'day' && rawTier !== 'week' && rawTier !== 'month') {
            throw new functions.https.HttpsError('invalid-argument', 'Ogiltig boostnivå.');
        }
        const tier: BoostTier = rawTier ?? 'week';
        const { days: boostDays, priceId } = BOOST_TIERS[tier];
        if (!priceId) {
            console.error(`[boost] Pris-ID för nivån '${tier}' saknas i functions-miljön `
                + `(STRIPE_BOOST_PRICE_ID_${tier.toUpperCase()}${tier === 'week' ? ' eller STRIPE_BOOST_PRICE_ID' : ''}).`);
            throw new functions.https.HttpsError('failed-precondition', 'Boost är inte tillgängligt ännu.');
        }

        const uid = context.auth.uid;
        const rawEventId = typeof data?.eventId === 'string' ? data.eventId.trim() : '';
        if (!rawEventId) {
            throw new functions.https.HttpsError('invalid-argument', 'Inget event angivet.');
        }
        // Ett tillfälle i en veckoserie har id "<docId>__2026-08-13" och motsvarar
        // inget eget dokument — dokumentet är seriens bas (samma avskalning som
        // vid radering). Boosten hamnar alltså på serien, vilket är rätt: alla
        // tillfällen lyfts. Utan den här raden skulle varje serie-tillfälle
        // avvisas som "finns inte". Skrapade id:n är URL:er och lämnas orörda —
        // en URL kan mycket väl innehålla "__" utan att vara en serie.
        const eventId = isScrapedEventId(rawEventId) ? rawEventId : rawEventId.split('__')[0];

        // Finns eventet inte ska ingen betala heller. Användarskapade valideras
        // mot linkEvents (dit boosten skrivs); skrapade mot aggregatens
        // destinations-lager (boosten hamnar i eventBoosts-overlayn).
        if (isScrapedEventId(eventId)) {
            if (!(await scrapedEventExists(eventId))) {
                throw new functions.https.HttpsError('not-found', 'Eventet går inte att boosta.');
            }
        } else {
            const eventSnap = await db.collection('linkEvents').doc(eventId).get();
            if (!eventSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Eventet går inte att boosta.');
            }
        }

        const returnUrl = safeReturnUrl(data?.returnUrl);
        // Stripe ersätter {CHECKOUT_SESSION_ID} i success_url. Klammrarna får INTE
        // url-kodas, så parametern läggs på råtext efter serialiseringen — det är
        // den `confirmBoost` läser när användaren kommer tillbaka.
        const successUrl = (() => {
            const u = new URL(returnUrl);
            u.searchParams.delete('boost_session');
            const qs = u.searchParams.toString();
            return `${u.origin}${u.pathname}${qs ? `?${qs}&` : '?'}boost_session={CHECKOUT_SESSION_ID}`;
        })();

        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_API_KEY as string, { apiVersion: '2026-07-29.dahlia' });

        // Kundkopplingen: extensionen skriver `stripeId` på customers/{uid} vid
        // första köpet. Saknas den skapar vi kunden på samma form (metadata
        // firebaseUID + fältet stripeId), annars hittar inte extensionens
        // webhook tillbaka till uid:t och betalningen landar aldrig i Firestore.
        const customerRef = db.collection('customers').doc(uid);
        const customerSnap = await customerRef.get();
        let stripeId = customerSnap.get('stripeId') as string | undefined;
        if (!stripeId) {
            const authUser = await admin.auth().getUser(uid);
            const customer = await stripe.customers.create({
                email: authUser.email || undefined,
                metadata: { firebaseUID: uid },
            });
            stripeId = customer.id;
            await customerRef.set({ stripeId, stripeLink: `https://dashboard.stripe.com/customers/${stripeId}` }, { merge: true });
        }

        // Samma metadata på både sessionen och payment_intent: extensionens
        // payments-dokument speglar payment_intent, och det är den `applyEventBoost` läser.
        const metadata = { eventId, boostDays: String(boostDays), firebaseUID: uid };

        try {
            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                customer: stripeId,
                line_items: [{ price: priceId, quantity: 1 }],
                success_url: successUrl,
                cancel_url: returnUrl,
                allow_promotion_codes: true,
                // Kärnan i hela den här funktionen — se blocket överst.
                managed_payments: { enabled: false },
                metadata,
                payment_intent_data: { metadata },
            });
            if (!session.url) {
                throw new functions.https.HttpsError('internal', 'Fick ingen betalningslänk från Stripe.');
            }
            console.log(`[boost] Checkout ${session.id} skapad för event ${eventId} (nivå ${tier}, ${boostDays} d, user ${uid}).`);
            return { url: session.url };
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            console.error('[boost] Kunde inte skapa checkout-session:', err);
            throw new functions.https.HttpsError('internal', 'Kunde inte starta betalningen. Försök igen om en stund.');
        }
    });

/**
 * Applicerar boosten när användaren kommer tillbaka från Stripe.
 *
 * Detta är den PRIMÄRA fulfillment-vägen. `applyEventBoost` nedan (via
 * extensionens webhook) ligger kvar som skyddsnät, men förutsätter att Stripe
 * faktiskt ringer extensionen — och den webhooken har aldrig avfyrats.
 *
 * Betalningen verifieras hos Stripe, aldrig på klientens ord: vi hämtar
 * sessionen och kräver payment_status === 'paid'. Dubbelapplicering hindras av
 * kvittot `boostPayments/{sessionId}` som skrivs i SAMMA transaction som
 * featuredUntil — utan det skulle en omladdning av success-URL:en förlänga
 * boosten gratis, om och om igen.
 */
export const confirmBoost = functions
    .runWith({ secrets: ['STRIPE_API_KEY'], invoker: 'public' })
    .region('europe-west1')
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Du måste vara inloggad.');
        }
        const uid = context.auth.uid;
        const sessionId = typeof data?.sessionId === 'string' ? data.sessionId.trim() : '';
        if (!sessionId.startsWith('cs_') || sessionId.length > 200) {
            throw new functions.https.HttpsError('invalid-argument', 'Ogiltig betalning.');
        }

        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_API_KEY as string, { apiVersion: '2026-07-29.dahlia' });

        let session: any;
        try {
            session = await stripe.checkout.sessions.retrieve(sessionId);
        } catch (err) {
            console.error('[boost] Kunde inte hämta session:', err);
            throw new functions.https.HttpsError('not-found', 'Betalningen kunde inte hittas.');
        }

        // Obetald (t.ex. avbruten, eller en fördröjd betalmetod som ännu inte
        // klarnat) → inget fel, bara "inte klar än".
        if (session.payment_status !== 'paid') {
            console.log(`[boost] Session ${sessionId} har status ${session.payment_status} — ingen boost.`);
            return { applied: false, status: session.payment_status };
        }

        const metadata = (session.metadata || {}) as Record<string, string>;
        // Sessionen måste tillhöra den som anropar: annars kunde någon som fått
        // tag på ett session-id lösa in en annans betalning.
        if (metadata.firebaseUID !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'Betalningen tillhör ett annat konto.');
        }
        const eventId = metadata.eventId;
        if (!eventId) {
            throw new functions.https.HttpsError('failed-precondition', 'Betalningen saknar event.');
        }
        const boostDays = Math.max(1, Math.min(90, parseInt(metadata.boostDays || '7', 10) || 7));
        const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : sessionId;

        const receiptRef = db.collection('boostPayments').doc(sessionId);
        const scraped = isScrapedEventId(eventId);
        const eventRef = boostTargetRef(eventId);

        const result = await db.runTransaction(async (tx) => {
            const [receipt, evt] = await Promise.all([tx.get(receiptRef), tx.get(eventRef)]);
            if (receipt.exists) return { applied: false, alreadyApplied: true };
            // Skrapade event: overlay-dokumentet skapas vid FÖRSTA boosten, så
            // att det saknas är normalt. Användarskapade: dokumentet ÄR eventet
            // och måste finnas.
            if (!scraped && !evt.exists) {
                throw new functions.https.HttpsError('not-found', 'Eventet finns inte längre.');
            }
            const evtData = evt.exists ? (evt.data() || {}) : {};
            const now = Date.now();
            const currentUntilMs =
                evtData.featuredUntil instanceof admin.firestore.Timestamp ? evtData.featuredUntil.toMillis() : 0;
            const until = new Date(Math.max(now, currentUntilMs) + boostDays * 24 * 60 * 60 * 1000);
            tx.set(receiptRef, {
                uid, eventId, boostDays, paymentId, sessionId,
                appliedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (scraped) {
                // eventId med i dokumentet: slug-hashen är enkelriktad och
                // klienten behöver ursprungs-id:t (URL:en) för att para ihop
                // overlayn med rätt kart-event.
                tx.set(eventRef, {
                    eventId,
                    featuredUntil: admin.firestore.Timestamp.fromDate(until),
                    featuredPaymentId: paymentId,
                }, { merge: true });
            } else {
                tx.update(eventRef, {
                    featuredUntil: admin.firestore.Timestamp.fromDate(until),
                    featuredPaymentId: paymentId,
                });
            }
            return { applied: true, until: until.toISOString() };
        });

        if (result.applied) {
            console.log(`[boost] Event ${eventId} boostat ${boostDays} dagar via confirmBoost (session ${sessionId}, user ${uid}).`);
        }
        return result;
    });

/**
 * Applicerar en betald "boost" på ett event.
 *
 * Förutsätter Firebase-extensionen `firestore-stripe-payments` (Invertase/Stripe),
 * som vid en lyckad ENGÅNGSbetalning skriver ett dokument under
 *   customers/{uid}/payments/{paymentId}
 * (Stripe PaymentIntent: { status, amount, currency, metadata, ... }).
 *
 * Klienten startar köpet genom att skapa en checkout-session med
 * payment_intent_data.metadata.eventId (+ boostDays) — se webb-klienten. Vi läser
 * tillbaka den metadatan här och sätter featuredUntil på eventet. Detta är ENDA
 * stället featuredUntil skrivs: klienten kan aldrig boosta sig själv gratis
 * (Firestore-reglerna tillåter inte fältet), bara en verifierad betalning.
 */
export const applyEventBoost = region.firestore
    .document('customers/{uid}/payments/{paymentId}')
    .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
        const after = change.after.exists ? change.after.data() : null;
        if (!after) return null;
        const before = change.before.exists ? change.before.data() : null;

        // Agera bara på lyckade betalningar, och bara EN gång (status-övergången).
        if (after.status !== 'succeeded') return null;
        if (before && before.status === 'succeeded') return null;

        const uid = context.params.uid as string;
        const paymentId = context.params.paymentId as string;
        const metadata = (after.metadata || {}) as Record<string, string>;
        const eventId = metadata.eventId;
        if (!eventId) {
            // Inte ett boost-köp (t.ex. framtida prenumeration) → ignorera.
            // OBS: ser du detta för ETT boost-köp bär inte payment_intent metadatan
            // eventId — då måste klientens checkout-session sätta
            // payment_intent_data.metadata (se docs/stripe-event-boost.md).
            console.log(`[boost] Betalning ${paymentId} (user ${uid}) saknar eventId-metadata — hoppar över.`);
            return null;
        }

        // Säkra gränser: 1–90 dagar, default 7.
        const boostDays = Math.max(1, Math.min(90, parseInt(metadata.boostDays || '7', 10) || 7));

        const scraped = isScrapedEventId(eventId);
        const eventRef = boostTargetRef(eventId);
        try {
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(eventRef);
                // Skrapade event: overlay-dokumentet skapas vid första boosten —
                // att det saknas är normalt. Användarskapade: dokumentet ÄR
                // eventet och måste finnas.
                if (!scraped && !snap.exists) {
                    console.error(`[boost] Event ${eventId} saknas — betalning ${paymentId} (user ${uid}) kunde inte appliceras.`);
                    return;
                }
                const data = snap.exists ? (snap.data() || {}) : {};
                // Redan applicerad av confirmBoost när användaren kom tillbaka från
                // Stripe (samma payment_intent-id på båda vägarna). Utan den här
                // kollen skulle en fungerande webhook lägga på boosten en gång till.
                if (data.featuredPaymentId === paymentId) {
                    console.log(`[boost] Betalning ${paymentId} redan applicerad på ${eventId} — hoppar över.`);
                    return;
                }
                // 5/8: boosten är öppen — VEM SOM HELST (inloggad) får betala för att
                // lyfta ett event, inte bara ägaren (fans/föreningar/arrangörer utan
                // eget konto för eventet). Betalningen är redan Stripe-verifierad och
                // boost ger bara synlighet, så ägarkravet togs bort. Betalare + ägare
                // loggas för spårbarhet. (Skrapade event har ingen ägare att logga.)
                if (!scraped && data.hostUid !== uid) {
                    console.log(`[boost] ${uid} boostar annans event ${eventId} (hostUid=${data.hostUid ?? 'okänd'}).`);
                }
                // Förläng från det senare av "nu" och en ev. pågående boost.
                const now = Date.now();
                const currentUntilMs =
                    data.featuredUntil instanceof admin.firestore.Timestamp ? data.featuredUntil.toMillis() : 0;
                const base = Math.max(now, currentUntilMs);
                const until = new Date(base + boostDays * 24 * 60 * 60 * 1000);
                if (scraped) {
                    // eventId med i dokumentet — se confirmBoost: hashen är
                    // enkelriktad, klienten parar via URL:en.
                    tx.set(eventRef, {
                        eventId,
                        featuredUntil: admin.firestore.Timestamp.fromDate(until),
                        featuredPaymentId: paymentId,
                    }, { merge: true });
                } else {
                    tx.update(eventRef, {
                        featuredUntil: admin.firestore.Timestamp.fromDate(until),
                        featuredPaymentId: paymentId,
                    });
                }
            });
            console.log(`[boost] Event ${eventId} boostat ${boostDays} dagar (betalning ${paymentId}, user ${uid}).`);
        } catch (err) {
            console.error('[boost] Kunde inte applicera boost:', err);
        }
        return null;
    });
