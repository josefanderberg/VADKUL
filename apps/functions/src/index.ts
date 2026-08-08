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
// medlemsutskicket via Zoho Campaigns.
const STAR_GIFT_CODES = ['STJARNA1', 'ARRANGOR1', 'MEDLEM1'];

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
// EVENT-PÅMINNELSER (1 h innan start)
// ==============================

/**
 * Körs var 5:e minut: hittar event som börjar inom en timme och pushar en
 * påminnelse till alla som ANMÄLT sig (linkEvents/{id}/attendees) eller
 * GILLAT eventet (users där savedEventIds innehåller event-id:t).
 *
 * Dedupe: eventReminders/{eventId} skapas med create() INNAN utskicket —
 * finns dokumentet redan har en tidigare körning tagit eventet, så varje
 * event påminns exakt en gång. Ingen klient kan läsa/skriva collectionen
 * (reglerna är default-deny), bara admin-SDK:t här.
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
        if (eventsSnap.empty) return null;

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
                const url = `/e/${eventShareSlug(eventDoc.id)}`;

                let delivered = 0;
                for (const uid of recipients) {
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
        return null;
    });

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

/** Priset (Stripe Price-ID) sätts i apps/functions/.env — aldrig av klienten. */
const BOOST_PRICE_ID = process.env.STRIPE_BOOST_PRICE_ID || '';
/** Speglar BOOST_DURATION_DAYS i webbens boostService.ts. */
const BOOST_DAYS = 7;
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

export const createBoostCheckout = functions
    .runWith({ secrets: ['STRIPE_API_KEY'] })
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
        if (!BOOST_PRICE_ID) {
            console.error('[boost] STRIPE_BOOST_PRICE_ID saknas i functions-miljön.');
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
        // avvisas som "finns inte".
        const eventId = rawEventId.split('__')[0];

        // Boosten sätts på linkEvents/{eventId}. Finns inte dokumentet kan
        // `applyEventBoost` aldrig applicera den — då ska ingen betala heller.
        // (Det är därför skrapade event inte går att boosta: de bor inte här.)
        const eventSnap = await db.collection('linkEvents').doc(eventId).get();
        if (!eventSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Eventet går inte att boosta.');
        }

        const returnUrl = safeReturnUrl(data?.returnUrl);
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
        const metadata = { eventId, boostDays: String(BOOST_DAYS), firebaseUID: uid };

        try {
            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                customer: stripeId,
                line_items: [{ price: BOOST_PRICE_ID, quantity: 1 }],
                success_url: returnUrl,
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
            console.log(`[boost] Checkout ${session.id} skapad för event ${eventId} (user ${uid}).`);
            return { url: session.url };
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            console.error('[boost] Kunde inte skapa checkout-session:', err);
            throw new functions.https.HttpsError('internal', 'Kunde inte starta betalningen. Försök igen om en stund.');
        }
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

        const eventRef = db.collection('linkEvents').doc(eventId);
        try {
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(eventRef);
                if (!snap.exists) {
                    console.error(`[boost] Event ${eventId} saknas — betalning ${paymentId} (user ${uid}) kunde inte appliceras.`);
                    return;
                }
                const data = snap.data() || {};
                // 5/8: boosten är öppen — VEM SOM HELST (inloggad) får betala för att
                // lyfta ett event, inte bara ägaren (fans/föreningar/arrangörer utan
                // eget konto för eventet). Betalningen är redan Stripe-verifierad och
                // boost ger bara synlighet, så ägarkravet togs bort. Betalare + ägare
                // loggas för spårbarhet.
                if (data.hostUid !== uid) {
                    console.log(`[boost] ${uid} boostar annans event ${eventId} (hostUid=${data.hostUid ?? 'okänd'}).`);
                }
                // Förläng från det senare av "nu" och en ev. pågående boost.
                const now = Date.now();
                const currentUntilMs =
                    data.featuredUntil instanceof admin.firestore.Timestamp ? data.featuredUntil.toMillis() : 0;
                const base = Math.max(now, currentUntilMs);
                const until = new Date(base + boostDays * 24 * 60 * 60 * 1000);
                tx.update(eventRef, {
                    featuredUntil: admin.firestore.Timestamp.fromDate(until),
                    featuredPaymentId: paymentId,
                });
            });
            console.log(`[boost] Event ${eventId} boostat ${boostDays} dagar (betalning ${paymentId}, user ${uid}).`);
        } catch (err) {
            console.error('[boost] Kunde inte applicera boost:', err);
        }
        return null;
    });
