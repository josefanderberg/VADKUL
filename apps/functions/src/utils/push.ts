import * as admin from "firebase-admin";
import { byggPushMeddelanden, ärAppToken, ärDödToken } from "./pushMessages";

/**
 * Skicka en push till ALLA en användares enheter (fcmTokens/{uid}/tokens/*).
 *
 * Webbens tokens får DATA-ONLY (service workerns onBackgroundMessage visar
 * notisen EN gång själv; en notification-payload hade gett dubbla notiser,
 * sw.js läser title/body/url ur payload.data). Appens tokens (platform
 * ios/android) får en riktig notis - en native app visar aldrig data-only.
 * Uppbyggnaden är ren och testad i utils/pushMessages.
 *
 * Döda tokens (avinstallerad app, återkallat tillstånd) städas bort ur
 * Firestore. Tillfälliga fel raderar ingenting.
 *
 * Returnerar antal lyckade leveranser.
 */
export async function sendPushToUser(
    uid: string,
    payload: { title: string; body: string; url: string; type: string; eventId?: string },
    opts?: {
        /**
         * Hur länge FCM får hålla på meddelandet innan det slängs. Default 1 h
         * (en påminnelse som kommer fram efter eventstart är meningslös) —
         * helgtipset sätter ett dygn: det är lika relevant på fredagsmorgonen
         * som på torsdagskvällen.
         */
        ttlSeconds?: number;
    },
): Promise<number> {
    const db = admin.firestore();
    const tokensSnapshot = await db
        .collection('fcmTokens')
        .doc(uid)
        .collection('tokens')
        .get();

    if (tokensSnapshot.empty) return 0;
    const tokens = tokensSnapshot.docs.map(doc => ({
        token: doc.data().token as string,
        platform: doc.data().platform as unknown,
    }));

    // Webbens tokens: data-only (service workern ritar). Appens: riktig notis
    // (utils/pushMessages). En påminnelse som inte hunnit fram innan eventet
    // börjat är meningslös → default en timme; helgtipset skickar längre.
    const messages = byggPushMeddelanden(tokens, payload, opts?.ttlSeconds ?? 3600, Date.now());
    const response = await admin.messaging().sendEach(messages);

    if (response.failureCount > 0) {
        const batch = db.batch();
        let döda = 0;
        response.responses.forEach((resp, idx) => {
            if (resp.success) return;
            const { token, platform } = tokens[idx];
            console.error(`Token till ${uid} (${ärAppToken(platform) ? platform : 'webb'}) failed:`, resp.error?.code ?? resp.error);
            if (!ärDödToken(resp.error?.code)) return;
            batch.delete(db.collection('fcmTokens').doc(uid).collection('tokens').doc(token));
            döda++;
        });
        if (döda > 0) await batch.commit();
    }

    return response.successCount;
}
