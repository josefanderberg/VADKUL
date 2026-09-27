/** Push vid ny notis-dokument: sendPushNotification. */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { db, region } from './shared';

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
