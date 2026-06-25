import * as functions from "firebase-functions/v1";

import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Sätt region till europa för lägre latency (matcha klienten)
// Använd 'europe-west1' (Belgien) typiskt för Firebase projekt i europa om inget annat valts
const region = functions.region('europe-west1');

import { scrapeTickster } from './scrapers/tickster';
import { scrapeEventbrite } from './scrapers/eventbrite';

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
// EVENT-BOOST (Stripe)
// ==============================

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
                // Försvar på djupet: boosta bara event som betalaren faktiskt äger.
                // UI:t erbjuder bara boost på egna event, så detta fångar manipulation.
                if (data.hostUid !== uid) {
                    console.error(`[boost] ${uid} betalade för event ${eventId} men hostUid=${data.hostUid}. Applicerar EJ.`);
                    return;
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
