import * as admin from "firebase-admin";

/**
 * Skicka en push till ALLA en användares enheter (fcmTokens/{uid}/tokens/*).
 *
 * Skickas som DATA-ONLY-meddelande (ingen notification-payload): då visar
 * service workerns onBackgroundMessage notisen EN gång själv. Med en
 * notification-payload visar FCM-SDK:t den dessutom automatiskt → dubbla
 * notiser. sw.js läser title/body/url ur payload.data.
 *
 * Ogiltiga tokens (avinstallerad app, återkallat tillstånd) städas bort ur
 * Firestore, samma mönster som sendPushNotification i index.ts.
 *
 * Returnerar antal lyckade leveranser.
 */
export async function sendPushToUser(
    uid: string,
    payload: { title: string; body: string; url: string; type: string; eventId?: string },
): Promise<number> {
    const db = admin.firestore();
    const tokensSnapshot = await db
        .collection('fcmTokens')
        .doc(uid)
        .collection('tokens')
        .get();

    if (tokensSnapshot.empty) return 0;
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token as string);

    const response = await admin.messaging().sendEachForMulticast({
        tokens,
        // Alla data-värden måste vara strängar.
        data: {
            type: payload.type,
            title: payload.title,
            body: payload.body,
            url: payload.url,
            eventId: payload.eventId ?? '',
        },
        webpush: {
            // En påminnelse som inte hunnit fram innan eventet börjat är
            // meningslös → låt den dö efter en timme i stället för att
            // levereras när mobilen vaknar dagen efter.
            headers: { TTL: '3600', Urgency: 'high' },
        },
    });

    if (response.failureCount > 0) {
        const batch = db.batch();
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                console.error(`Token ${tokens[idx]} failed:`, resp.error);
                batch.delete(
                    db.collection('fcmTokens').doc(uid).collection('tokens').doc(tokens[idx])
                );
            }
        });
        await batch.commit();
    }

    return response.successCount;
}
