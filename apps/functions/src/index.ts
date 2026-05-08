import * as functions from "firebase-functions/v1";

import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Sätt region till europa för lägre latency (matcha klienten)
// Använd 'europe-west1' (Belgien) typiskt för Firebase projekt i europa om inget annat valts
const region = functions.region('europe-west1');

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
