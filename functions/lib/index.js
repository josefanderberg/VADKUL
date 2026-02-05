"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemCode = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// Sätt region till europa för lägre latency (matcha klienten)
// Använd 'europe-west1' (Belgien) typiskt för Firebase projekt i europa om inget annat valts
const region = functions.region('europe-west1');
exports.redeemCode = region.https.onCall(async (data, context) => {
    // 1. Auth Check - Ensure user is logged in
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Du måste vara inloggad för att lösa in koder.');
    }
    const { code } = data;
    const uid = context.auth.uid;
    if (!code || typeof code !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Ingen kod angiven.');
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
                const newRedeemed = redeemed.filter((c) => c !== normalizedCode);
                transaction.update(userRef, {
                    redeemedCodes: newRedeemed
                });
                message = 'Koden godkänd. Premium avaktiverat.';
            }
            else {
                // TOGGLE ON
                transaction.update(userRef, {
                    redeemedCodes: [...redeemed, normalizedCode]
                });
                message = 'Koden godkänd. Premium aktiverat!';
            }
        });
        return { success: true, message };
    }
    catch (error) {
        console.error("Redeem error:", error);
        throw new functions.https.HttpsError('internal', 'Ett fel uppstod vid inlösning av koden.');
    }
});
//# sourceMappingURL=index.js.map