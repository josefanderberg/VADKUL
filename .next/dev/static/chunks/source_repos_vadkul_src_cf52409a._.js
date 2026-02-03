(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/source/repos/vadkul/src/services/userService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "userService",
    ()=>userService
]);
// src/services/userService.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
;
;
const userService = {
    // Skapa eller uppdatera användarprofil i databasen
    async createUserProfile (uid, data) {
        const userRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', uid);
        // Sanitize data: Remove undefined values which Firestore doesn't support
        // (We allow null for explicit clearing if supported by types, but remove undefined)
        const sanitizedData = Object.entries(data).reduce((acc, [key, value])=>{
            if (value !== undefined && key !== 'referrerUid') {
                acc[key] = value;
            }
            return acc;
        }, {});
        // Prepare payload
        const payload = {
            ...sanitizedData,
            uid,
            createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now(),
            inviteCount: 0 // Initiera räknare
        };
        // Om vi har en referrer, spara det
        if (data.referrerUid) {
            payload.invitedBy = data.referrerUid;
        }
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setDoc"])(userRef, payload, {
            merge: true
        });
        // Om referrer finns, öka deras räknare
        if (data.referrerUid) {
            const referrerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', data.referrerUid);
            // Använd updateDoc för att inte skriva över hela dokumentet, och increment
            // Vi bryr oss inte om att vänta på denna (fire and forget) eller så gör vi det?
            // Bäst att vänta för att undvika race-conditions i tester, men för UI är det inte så noga.
            // Sätt det i en try-catch så det inte stoppar registreringen om det failar.
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])(referrerRef, {
                    inviteCount: (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["increment"])(1)
                });
            } catch (e) {
                console.error("Failed to increment referrer count", e);
            }
        }
    },
    // Hämta profil
    async getUserProfile (uid) {
        const docRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', uid);
        const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDoc"])(docRef);
        if (snap.exists()) {
            const data = snap.data();
            return {
                ...data,
                uid: snap.id,
                createdAt: data.createdAt?.toDate()
            };
        }
        return null;
        //TURBOPACK unreachable
        ;
    },
    // Lägg till eller uppdatera omdöme
    async addReview (targetUid, review) {
        const userRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', targetUid);
        const reviewRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', targetUid, 'reviews', review.reviewer.uid); // Använd ID för att garantera ett omdöme per pers
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runTransaction"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], async (transaction)=>{
            const userDoc = await transaction.get(userRef);
            const reviewDoc = await transaction.get(reviewRef);
            if (!userDoc.exists()) throw new Error("Användaren finns inte");
            const userData = userDoc.data();
            let currentRating = userData.rating || 0;
            let currentCount = userData.ratingCount || 0;
            // Om omdöme redan finns, dra bort gamla värdet först
            if (reviewDoc.exists()) {
                const oldData = reviewDoc.data();
                const oldRating = oldData.rating || 0;
                // Backa ut gamla betyget
                // (Snitt * antal) - gammalt = Total
                const totalScore = currentRating * currentCount - oldRating;
                // Uppdatera snitt (antalet är samma)
                // (Total + nytt) / antal
                currentRating = (totalScore + review.rating) / currentCount;
            } else {
                // Nytt omdöme
                const totalScore = currentRating * currentCount;
                currentCount += 1;
                currentRating = (totalScore + review.rating) / currentCount;
            }
            // 1. Skapa/Uppdatera review
            transaction.set(reviewRef, {
                reviewerId: review.reviewer.uid,
                reviewerName: review.reviewer.displayName,
                reviewerImage: review.reviewer.photoURL || null,
                rating: review.rating,
                comment: review.comment,
                createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
            });
            // 2. Uppdatera användaren
            transaction.update(userRef, {
                rating: currentRating,
                ratingCount: currentCount
            });
        });
    },
    // Kolla om användaren redan har recenserat
    async hasUserReviewed (targetUid, reviewerUid) {
        const docRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', targetUid, 'reviews', reviewerUid);
        const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDoc"])(docRef);
        return snap.exists();
    },
    // Hämta omdömen (valfritt, men bra för listan)
    async getReviews (targetUid) {
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', targetUid, 'reviews'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["orderBy"])('createdAt', 'desc'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["limit"])(10));
        const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
        return snap.docs.map((doc)=>({
                id: doc.id,
                ...doc.data()
            }));
    },
    // Lös in kod
    async redeemCode (uid, code) {
        const VALID_CODES = [
            'H2K2'
        ]; // Hardcoded for now
        const normalizedCode = code.toUpperCase().trim();
        if (!VALID_CODES.includes(normalizedCode)) {
            return {
                success: false,
                message: 'Ogiltig kod.'
            };
        }
        const userRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', uid);
        try {
            // Use a variable to capture the result message from within the transaction
            let message = "";
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runTransaction"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], async (transaction)=>{
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("User does not exist");
                const userData = userDoc.data();
                const redeemed = userData.redeemedCodes || [];
                if (redeemed.includes(normalizedCode)) {
                    // TOGGLE OFF
                    const newRedeemed = redeemed.filter((c)=>c !== normalizedCode);
                    transaction.update(userRef, {
                        redeemedCodes: newRedeemed
                    });
                    message = 'Koden godkänd. Premium avaktiverat.';
                } else {
                    // TOGGLE ON
                    transaction.update(userRef, {
                        redeemedCodes: [
                            ...redeemed,
                            normalizedCode
                        ]
                    });
                    message = 'Koden godkänd. Premium aktiverat!';
                }
            });
            return {
                success: true,
                message
            };
        } catch (e) {
            console.error("Redeem error:", e);
            return {
                success: false,
                message: e.message || 'Kunde inte lösa in koden.'
            };
        }
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/services/notificationService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "notificationService",
    ()=>notificationService
]);
// src/services/notificationService.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
;
;
const COLLECTION = 'notifications';
const notificationService = {
    // Skicka en notis
    async send (notification) {
        // Skicka inte notis till sig själv
        if (notification.recipientId === notification.senderId) return;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), {
            ...notification,
            read: false,
            createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
        });
    },
    // Lyssna på mina notiser (Realtime)
    subscribe (userId, callback) {
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('recipientId', '==', userId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["orderBy"])('createdAt', 'desc'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["limit"])(20) // Begränsa till 20 senaste notiserna
        );
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["onSnapshot"])(q, (snapshot)=>{
            const data = snapshot.docs.map((doc)=>({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate()
                }));
            callback(data);
        });
    },
    // Markera en som läst (när man klickar på den)
    async markAsRead (id) {
        const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION, id);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])(ref, {
            read: true
        });
    },
    // Markera ALLA som lästa (knapp i menyn)
    async markAllAsRead (userId) {
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('recipientId', '==', userId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('read', '==', false));
        const snapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
        const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
        snapshot.docs.forEach((doc)=>{
            batch.update(doc.ref, {
                read: true
            });
        });
        await batch.commit();
    },
    // Markera specifikt chatt-notiser som lästa från en viss avsändare
    async markChatNotificationsAsRead (recipientId, senderId) {
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('recipientId', '==', recipientId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('senderId', '==', senderId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('type', '==', 'chat'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('read', '==', false));
        const snapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
        if (snapshot.empty) return;
        const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
        snapshot.docs.forEach((doc)=>{
            batch.update(doc.ref, {
                read: true
            });
        });
        await batch.commit();
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>NotificationsMenu
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// src/components/ui/NotificationsMenu.tsx
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/bell.js [app-client] (ecmascript) <export default as Bell>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/notificationService.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
function NotificationsMenu({ notifications }) {
    _s();
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [isOpen, setIsOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const menuRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Stäng om man klickar utanför
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NotificationsMenu.useEffect": ()=>{
            function handleClickOutside(event) {
                if (menuRef.current && !menuRef.current.contains(event.target)) {
                    setIsOpen(false);
                }
            }
            document.addEventListener("mousedown", handleClickOutside);
            return ({
                "NotificationsMenu.useEffect": ()=>document.removeEventListener("mousedown", handleClickOutside)
            })["NotificationsMenu.useEffect"];
        }
    }["NotificationsMenu.useEffect"], []);
    const unreadCount = notifications.filter((n)=>!n.read).length;
    const handleClickNotif = async (notif)=>{
        await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["notificationService"].markAsRead(notif.id);
        setIsOpen(false);
        if (notif.link) router.push(notif.link);
    };
    const markAllRead = async ()=>{
        if (user) await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["notificationService"].markAllAsRead(user.uid);
    };
    if (!user) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative",
        ref: menuRef,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>setIsOpen(!isOpen),
                className: "p-1.5 md:p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-colors relative",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__["Bell"], {
                        size: 24
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                        lineNumber: 51,
                        columnNumber: 9
                    }, this),
                    unreadCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-background animate-in zoom-in",
                        children: unreadCount > 9 ? '9+' : unreadCount
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                        lineNumber: 53,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                lineNumber: 47,
                columnNumber: 7
            }, this),
            isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-0 mt-2 w-80 bg-card rounded-2xl shadow-xl border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 border-b border-border flex justify-between items-center bg-muted/30",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "font-bold text-sm text-foreground",
                                children: "Notiser"
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                lineNumber: 64,
                                columnNumber: 13
                            }, this),
                            unreadCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: markAllRead,
                                className: "text-xs font-medium text-indigo-600 hover:underline",
                                children: "Markera alla lästa"
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                lineNumber: 66,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                        lineNumber: 63,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "max-h-80 overflow-y-auto",
                        children: notifications.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-8 text-center text-muted-foreground text-sm",
                            children: "Inga notiser än."
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                            lineNumber: 74,
                            columnNumber: 15
                        }, this) : notifications.map((n)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>handleClickNotif(n),
                                className: `w-full text-left p-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0
                                ${!n.read ? 'bg-primary/5' : ''}
                            `,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "shrink-0 pt-1",
                                        children: n.senderImage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                            src: n.senderImage,
                                            className: "w-8 h-8 rounded-full object-cover",
                                            alt: ""
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                            lineNumber: 88,
                                            columnNumber: 23
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                                size: 14
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                                lineNumber: 91,
                                                columnNumber: 25
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                            lineNumber: 90,
                                            columnNumber: 23
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                        lineNumber: 86,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-foreground leading-snug",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "font-bold",
                                                        children: n.senderName
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                                        lineNumber: 97,
                                                        columnNumber: 23
                                                    }, this),
                                                    " ",
                                                    n.message
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                                lineNumber: 96,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-xs text-muted-foreground mt-1",
                                                children: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                                lineNumber: 99,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                        lineNumber: 95,
                                        columnNumber: 19
                                    }, this),
                                    !n.read && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "w-2 h-2 bg-primary rounded-full mt-2 shrink-0"
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                        lineNumber: 103,
                                        columnNumber: 31
                                    }, this)
                                ]
                            }, n.id, true, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                                lineNumber: 79,
                                columnNumber: 17
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                        lineNumber: 72,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
                lineNumber: 61,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx",
        lineNumber: 45,
        columnNumber: 5
    }, this);
}
_s(NotificationsMenu, "Kk7c6TCozTk8UIOFPfM+1KueFyQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"],
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = NotificationsMenu;
var _c;
__turbopack_context__.k.register(_c, "NotificationsMenu");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/components/ui/Navbar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Navbar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// src/components/layout/Navbar.tsx
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$ThemeContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/ThemeContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/userService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/notificationService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$NotificationsMenu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/ui/NotificationsMenu.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/sun.js [app-client] (ecmascript) <export default as Sun>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/moon.js [app-client] (ecmascript) <export default as Moon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/message-square.js [app-client] (ecmascript) <export default as MessageSquare>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/info.js [app-client] (ecmascript) <export default as Info>");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
;
;
;
function Navbar() {
    _s();
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const { theme, toggleTheme } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$ThemeContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    // State för bilden i navbaren - Initiera med null för SSR, hämta i useEffect
    const [navImage, setNavImage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            const cached = localStorage.getItem('cached_avatar_url');
            if (cached) setNavImage(cached);
        }
    }["Navbar.useEffect"], []);
    // State för notiser (Flyttad från NotificationsMenu)
    const [notifications, setNotifications] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    // Hämta bilden från databasen när användaren ändras
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if (user?.uid) {
                // VIKTIGT: Vi använder INTE user.photoURL direkt längre, eftersom det kan vara verifikationsbilden.
                // Däremot kan vi kolla om vi redan har en cachad bild.
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["userService"].getUserProfile(user.uid).then({
                    "Navbar.useEffect": (profile)=>{
                        if (profile?.photoURL) {
                            setNavImage(profile.photoURL);
                            // Uppdatera cachen
                            localStorage.setItem('cached_avatar_url', profile.photoURL);
                        } else {
                        // Om ingen bild finns i profilen heller, rensa cachen om den fanns?
                        // Eller behåll "null" så initialerna visas.
                        // setNavImage(null); 
                        // Vi låter bli att rensa här för att inte flimra om fetch misslyckas tillfälligt,
                        // men om man vill vara strikt:
                        // localStorage.removeItem('cached_avatar_url');
                        }
                    }
                }["Navbar.useEffect"]);
            } else {
                setNavImage(null);
                localStorage.removeItem('cached_avatar_url'); // Rensa vid utloggning
            }
        }
    }["Navbar.useEffect"], [
        user
    ]);
    // Hämta notiser
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if (!user) return;
            const unsub = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["notificationService"].subscribe(user.uid, {
                "Navbar.useEffect.unsub": (data)=>{
                    setNotifications(data);
                }
            }["Navbar.useEffect.unsub"]);
            return ({
                "Navbar.useEffect": ()=>unsub()
            })["Navbar.useEffect"];
        }
    }["Navbar.useEffect"], [
        user
    ]);
    const getInitials = ()=>{
        if (!user?.email) return '??';
        return (user.displayName || user.email).substring(0, 2).toUpperCase();
    };
    // Filtrera notiser
    // 'chat' går till chatt-ikonen
    // Allt annat går till klockan
    const chatNotifications = notifications.filter((n)=>n.type === 'chat');
    const generalNotifications = notifications.filter((n)=>n.type !== 'chat');
    const unreadChatCount = chatNotifications.filter((n)=>!n.read).length;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        className: "fixed top-0 left-0 right-0 bg-card/80 backdrop-blur-md shadow-sm z-50 border-b border-border h-16 transition-colors duration-200",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "max-w-6xl mx-auto px-4 md:px-8 h-full flex justify-between items-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: "/",
                    className: "text-3xl font-extrabold italic text-primary tracking-tight hover:text-primary/90 transition-colors",
                    children: "VADKUL"
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                    lineNumber: 83,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-0.5 md:gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/create",
                            className: "p-1.5 md:p-2 text-primary hover:bg-accent hover:text-accent-foreground rounded-full transition-colors",
                            title: "Skapa Event",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                size: 24,
                                strokeWidth: 2.5
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                lineNumber: 92,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                            lineNumber: 91,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/about",
                            className: "p-1.5 md:p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors",
                            title: "Om VADKUL",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__["Info"], {
                                size: 22
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                lineNumber: 97,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                            lineNumber: 96,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: toggleTheme,
                            className: `p-1.5 md:p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors ${!user ? 'mr-3' : ''}`,
                            title: "Växla tema",
                            children: theme === 'dark' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__["Sun"], {
                                size: 20
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                lineNumber: 106,
                                columnNumber: 33
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__["Moon"], {
                                size: 20
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                lineNumber: 106,
                                columnNumber: 53
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                            lineNumber: 101,
                            columnNumber: 11
                        }, this),
                        user ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$NotificationsMenu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    notifications: generalNotifications
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                    lineNumber: 113,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/chat",
                                    className: "p-1.5 md:p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"], {
                                            size: 20
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                            lineNumber: 117,
                                            columnNumber: 17
                                        }, this),
                                        unreadChatCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-background animate-in zoom-in",
                                            children: unreadChatCount > 9 ? '9+' : unreadChatCount
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                            lineNumber: 119,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                    lineNumber: 116,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/profile",
                                    className: "block ml-1 shrink-0",
                                    children: navImage ? // OM BILD FINNS
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                        src: navImage,
                                        alt: "Profil",
                                        className: "w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border-2 border-border shadow-sm hover:border-ring transition-colors"
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                        lineNumber: 129,
                                        columnNumber: 19
                                    }, this) : // FALLBACK: Initialer
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "w-8 h-8 md:w-9 md:h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-extrabold text-xs border-2 border-border shadow-sm hover:border-ring transition-colors",
                                        children: getInitials()
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                        lineNumber: 136,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                    lineNumber: 126,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true) : /* LOGGA IN KNAPP */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/login",
                            className: "px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-colors active:scale-95",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "min-[450px]:hidden",
                                    children: "Logga in"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                    lineNumber: 145,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "hidden min-[450px]:inline",
                                    children: "Logga In / Registrera"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                                    lineNumber: 146,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                            lineNumber: 144,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
                    lineNumber: 87,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
            lineNumber: 80,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/components/ui/Navbar.tsx",
        lineNumber: 79,
        columnNumber: 5
    }, this);
}
_s(Navbar, "HQdPOd5yhWa0hgfGZA+SC+ldVdk=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"],
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$ThemeContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"]
    ];
});
_c = Navbar;
var _c;
__turbopack_context__.k.register(_c, "Navbar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/components/layout/Layout.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Layout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$Navbar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/ui/Navbar.tsx [app-client] (ecmascript)");
// import InstallPrompt from '../ui/InstallPrompt';
// NYTT: Importera Toaster
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-hot-toast/dist/index.mjs [app-client] (ecmascript)"); // Lägg till denna import
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AdminContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/AdminContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$crown$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Crown$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/crown.js [app-client] (ecmascript) <export default as Crown>");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
function Layout({ children }) {
    _s();
    const { isAdmin } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AdminContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAdmin"])();
    return(// min-h-screen ser till att bakgrunden täcker hela sidan, men låter body scrolla
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex flex-col bg-background transition-colors",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$Navbar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/components/layout/Layout.tsx",
                lineNumber: 20,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "flex-1 pt-16",
                children: children
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/components/layout/Layout.tsx",
                lineNumber: 22,
                columnNumber: 7
            }, this),
            isAdmin && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed top-20 right-4 z-[100] pointer-events-none animate-pulse",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-yellow-100/80 backdrop-blur-sm p-2 rounded-full border-2 border-yellow-400 shadow-lg text-yellow-600",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$crown$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Crown$3e$__["Crown"], {
                        size: 24,
                        fill: "currentColor"
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/components/layout/Layout.tsx",
                        lineNumber: 31,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/components/layout/Layout.tsx",
                    lineNumber: 30,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/components/layout/Layout.tsx",
                lineNumber: 29,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Toaster"], {
                position: "top-center",
                toastOptions: {
                    // Anpassa stilen för att matcha designen
                    style: {
                        padding: '16px',
                        fontWeight: 'bold',
                        color: '#1e293b'
                    }
                }
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/components/layout/Layout.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/source/repos/vadkul/src/components/layout/Layout.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this));
}
_s(Layout, "bK+tR5kC32IjO2w4yrvHhWYVaYg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AdminContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAdmin"]
    ];
});
_c = Layout;
var _c;
__turbopack_context__.k.register(_c, "Layout");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PromoCodeModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$key$2d$round$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__KeyRound$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/key-round.js [app-client] (ecmascript) <export default as KeyRound>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-hot-toast/dist/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
function PromoCodeModal({ isOpen, onClose, onSuccess }) {
    _s();
    const [accessCode, setAccessCode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [codeUnlocked, setCodeUnlocked] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [customCategoryName, setCustomCategoryName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    if (!isOpen) return null;
    const handleCodeSubmit = ()=>{
        if (accessCode === 'N4TN') {
            setCodeUnlocked(true);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Kod godkänd! Ange namn på nation/kår.");
        } else {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Felaktig kod. Försök igen.");
            setAccessCode('');
        }
    };
    const handleFinalSubmit = ()=>{
        if (!customCategoryName.trim()) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Vänligen ange ett namn");
            return;
        }
        onSuccess(accessCode, customCategoryName);
        onClose();
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: onClose,
                    className: "absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                        size: 20
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                        lineNumber: 46,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                    lineNumber: 42,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col items-center text-center mb-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$key$2d$round$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__KeyRound$3e$__["KeyRound"], {
                                size: 24
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                lineNumber: 51,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                            lineNumber: 50,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-xl font-bold",
                            children: "Har du en kod?"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                            lineNumber: 53,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-muted-foreground mt-1",
                            children: "Lås upp exklusiva kategorier som Nationer eller Kårer med din accesskod."
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                            lineNumber: 54,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                    lineNumber: 49,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    placeholder: "ANGE KOD...",
                                    value: accessCode,
                                    onChange: (e)=>setAccessCode(e.target.value.toUpperCase()),
                                    disabled: codeUnlocked,
                                    className: `flex-grow p-3 rounded-xl border bg-background text-foreground text-center font-mono uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary transition-all
                                ${codeUnlocked ? 'border-green-500/50 bg-green-500/10 text-green-600' : 'border-border'}
                            `
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                    lineNumber: 62,
                                    columnNumber: 25
                                }, this),
                                !codeUnlocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: handleCodeSubmit,
                                    disabled: !accessCode,
                                    className: "px-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                        size: 20
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                        lineNumber: 78,
                                        columnNumber: 33
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                    lineNumber: 73,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                            lineNumber: 61,
                            columnNumber: 21
                        }, this),
                        codeUnlocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "animate-in fade-in slide-in-from-top-2 space-y-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-center text-green-600 font-bold text-sm flex items-center justify-center gap-1.5 bg-green-500/10 py-1.5 rounded-lg",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                            size: 14
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                            lineNumber: 87,
                                            columnNumber: 33
                                        }, this),
                                        " Kod godkänd!"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                    lineNumber: 86,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "block text-xs font-bold text-muted-foreground uppercase mb-1.5 text-left",
                                            children: "Vilken nation/kår?"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                            lineNumber: 91,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            placeholder: "T.ex. Kalmar Nation",
                                            value: customCategoryName,
                                            onChange: (e)=>setCustomCategoryName(e.target.value),
                                            autoFocus: true,
                                            className: "w-full p-3 rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                            lineNumber: 92,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                    lineNumber: 90,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: handleFinalSubmit,
                                    disabled: !customCategoryName,
                                    className: "w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg active:scale-95 duration-200",
                                    children: "Använd kategori"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                                    lineNumber: 102,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                            lineNumber: 85,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
                    lineNumber: 59,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
            lineNumber: 39,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx",
        lineNumber: 38,
        columnNumber: 9
    }, this);
}
_s(PromoCodeModal, "nfw3oEYadkxAlATljZwPK8t6M9o=");
_c = PromoCodeModal;
var _c;
__turbopack_context__.k.register(_c, "PromoCodeModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/services/eventService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "eventService",
    ()=>eventService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
;
;
const COLLECTION = 'events';
const eventService = {
    // Hämta alla
    async getAll () {
        try {
            // Filter: Only fetch events that have not ended yet (or start in future)
            // Note: "time" is the start time. We want events where time >= now.
            const now = new Date();
            // Reset time to start of day if we want to include today's earlier events, 
            // but strictly speaking "future" means >= now. 
            // Let's keep it simple: time >= now.
            // But wait, the client implementation `Home.tsx` filters `new Date(event.time) < now`.
            // So if we filter here, we save the reads.
            const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])("time", ">=", __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(now)));
            const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
            return snap.docs.map((doc)=>{
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    time: data.time instanceof __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"] ? data.time.toDate() : new Date(data.time),
                    createdAt: data.createdAt instanceof __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"] ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : undefined
                };
            });
        } catch (error) {
            console.error("Error fetching events:", error);
            return [];
        }
    },
    // Hämta events där jag är värd (Optimerad)
    async getHostedEvents (uid) {
        try {
            const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])("host.uid", "==", uid));
            const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
            return snap.docs.map((doc)=>{
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    time: data.time instanceof __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"] ? data.time.toDate() : new Date(data.time),
                    createdAt: data.createdAt instanceof __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"] ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : undefined
                };
            });
        } catch (error) {
            console.error("Error fetching hosted events:", error);
            return [];
        }
    },
    // Hämta en
    async getById (id) {
        try {
            const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION, id);
            const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDoc"])(ref);
            if (snap.exists()) {
                const data = snap.data();
                return {
                    ...data,
                    id: snap.id,
                    time: data.time instanceof __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"] ? data.time.toDate() : new Date(data.time),
                    createdAt: data.createdAt instanceof __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"] ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : undefined
                };
            }
            return null;
        } catch (error) {
            console.error("Error fetching event:", error);
            return null;
        }
    },
    // Skapa
    async create (event) {
        const payload = {
            ...event,
            views: 0,
            time: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(event.time),
            createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now() // Use client-side timestamp for simplicity effectively matching server
        };
        return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), payload);
    },
    // Uppdatera
    async update (event) {
        const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION, event.id);
        // Vi plockar bort id innan vi sparar till Firestore
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...data } = event;
        // Sanitize data: Remove undefined fields and convert Dates to Timestamps
        const payload = {
            ...data
        };
        // Convert known dates
        payload.time = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(event.time);
        if (event.createdAt) {
            payload.createdAt = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(event.createdAt);
        } else {
            delete payload.createdAt; // Ensure it's not undefined
        }
        // Helper to recursively clean undefined from objects/arrays if needed, 
        // but for now shallow cleanup for top-level undefined is likely what's needed for 'createdAt' if it's on the root.
        // However, the error said "found in field createdAt in document events/...". 
        // If it's a root field, the above handles it.
        // If it's inside 'attendees' array, we need deep sanitization or fix the caller.
        // Given the error message "found in field createdAt", it usually refers to top-level or specific path.
        // If it was nested, it might say "attendees[0].createdAt".
        // Let's assume top level for now, but also clean up the payload object.
        Object.keys(payload).forEach((key)=>{
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])(ref, payload);
    },
    // Ta bort
    async delete (id) {
        const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION, id);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deleteDoc"])(ref);
    },
    // Uppdatera ENDAST deltagare (för att matcha säkerhetsregler)
    async updateAttendees (eventId, attendees) {
        const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION, eventId);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])(ref, {
            attendees
        });
    },
    async incrementViews (id) {
        const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION, id);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])(ref, {
            views: (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["increment"])(1)
        });
    },
    // Uppdatera host-data på alla events när användaren byter profil
    async updateEventsHostData (uid, hostData) {
        try {
            // 1. Hämta alla events där jag är värd
            const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])("host.uid", "==", uid));
            const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
            if (snap.empty) return;
            // 2. Uppdatera alla (batch hade varit bättre men loop funkar för nu och är enklare med typerna)
            const updates = snap.docs.map((docSnapshot)=>{
                const eventData = docSnapshot.data();
                const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION, docSnapshot.id);
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])(ref, {
                    host: {
                        ...eventData.host,
                        name: hostData.name,
                        photoURL: hostData.photoURL,
                        verified: hostData.verified
                    }
                });
            });
            await Promise.all(updates);
            console.log(`Updated host data for ${updates.length} events.`);
        } catch (error) {
            console.error("Failed to sync host data to events:", error);
            throw error;
        }
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/services/storageService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "storageService",
    ()=>storageService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$storage$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/storage/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$storage$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/storage/dist/index.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
;
;
const storageService = {
    /**
     * Laddar upp en fil (File eller Blob) till Firebase Storage
     * @param path Katalog/Sökväg (t.ex. 'users/uid/profile')
     * @param file Filen som ska laddas upp
     * @returns Länk (URL) till bilden
     */ async uploadFile (path, file) {
        // Skapa en referens. Om path slutar med / genererar vi ett unikt ID.
        // Annars skriver vi över filen på sökvägen (bra för profilbilder).
        const fullPath = path.endsWith('/') ? `${path}${Date.now()}_${Math.random().toString(36).substring(7)}` : path;
        const storageRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$storage$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ref"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["storage"], fullPath);
        // Ladda upp
        const snapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$storage$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uploadBytes"])(storageRef, file);
        // Hämta URL
        const url = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$storage$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDownloadURL"])(snapshot.ref);
        return url;
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/assets/categories/mingle.png (static in ecmascript, tag client)", ((__turbopack_context__) => {

__turbopack_context__.v("/_next/static/media/mingle.1b21ce2d.png");}),
"[project]/source/repos/vadkul/src/assets/categories/mingle.png.mjs { IMAGE => \"[project]/source/repos/vadkul/src/assets/categories/mingle.png (static in ecmascript, tag client)\" } [app-client] (structured image object with data url, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$mingle$2e$png__$28$static__in__ecmascript$2c$__tag__client$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/assets/categories/mingle.png (static in ecmascript, tag client)");
;
const __TURBOPACK__default__export__ = {
    src: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$mingle$2e$png__$28$static__in__ecmascript$2c$__tag__client$29$__["default"],
    width: 1024,
    height: 1024,
    blurWidth: 8,
    blurHeight: 8,
    blurDataURL: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/wAARCAAIAAgDAREAAhEBAxEB/9sAQwAKBwcIBwYKCAgICwoKCw4YEA4NDQ4dFRYRGCMfJSQiHyIhJis3LyYpNCkhIjBBMTQ5Oz4+PiUuRElDPEg3PT47/9sAQwEKCwsODQ4cEBAcOygiKDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDFjubadrqSKC2PkIXkClvlHHI9f/r1yVKcZu6VrndTqOmrN3sf/9k="
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/assets/categories/culture.png (static in ecmascript, tag client)", ((__turbopack_context__) => {

__turbopack_context__.v("/_next/static/media/culture.963fdaf5.png");}),
"[project]/source/repos/vadkul/src/assets/categories/culture.png.mjs { IMAGE => \"[project]/source/repos/vadkul/src/assets/categories/culture.png (static in ecmascript, tag client)\" } [app-client] (structured image object with data url, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$culture$2e$png__$28$static__in__ecmascript$2c$__tag__client$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/assets/categories/culture.png (static in ecmascript, tag client)");
;
const __TURBOPACK__default__export__ = {
    src: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$culture$2e$png__$28$static__in__ecmascript$2c$__tag__client$29$__["default"],
    width: 1024,
    height: 1024,
    blurWidth: 8,
    blurHeight: 8,
    blurDataURL: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/wAARCAAIAAgDAREAAhEBAxEB/9sAQwAKBwcIBwYKCAgICwoKCw4YEA4NDQ4dFRYRGCMfJSQiHyIhJis3LyYpNCkhIjBBMTQ5Oz4+PiUuRElDPEg3PT47/9sAQwEKCwsODQ4cEBAcOygiKDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzgSafsNwZ8vuOY8HGO3GMVx2ntY9Pnocl76n/2Q=="
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/utils/categories.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AGE_CATEGORIES",
    ()=>AGE_CATEGORIES,
    "CATEGORY_LIST",
    ()=>CATEGORY_LIST,
    "EVENT_CATEGORIES",
    ()=>EVENT_CATEGORIES
]);
// src/utils/categories.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$mingle$2e$png$2e$mjs__$7b$__IMAGE__$3d3e$__$225b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$mingle$2e$png__$28$static__in__ecmascript$2c$__tag__client$2922$__$7d$__$5b$app$2d$client$5d$__$28$structured__image__object__with__data__url$2c$__ecmascript$29$__ = __turbopack_context__.i('[project]/source/repos/vadkul/src/assets/categories/mingle.png.mjs { IMAGE => "[project]/source/repos/vadkul/src/assets/categories/mingle.png (static in ecmascript, tag client)" } [app-client] (structured image object with data url, ecmascript)');
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$culture$2e$png$2e$mjs__$7b$__IMAGE__$3d3e$__$225b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$culture$2e$png__$28$static__in__ecmascript$2c$__tag__client$2922$__$7d$__$5b$app$2d$client$5d$__$28$structured__image__object__with__data__url$2c$__ecmascript$29$__ = __turbopack_context__.i('[project]/source/repos/vadkul/src/assets/categories/culture.png.mjs { IMAGE => "[project]/source/repos/vadkul/src/assets/categories/culture.png (static in ecmascript, tag client)" } [app-client] (structured image object with data url, ecmascript)');
;
;
const EVENT_CATEGORIES = {
    // --- AKTIVITET & HÄLSA ---
    play: {
        id: 'play',
        label: 'Spel & Lek',
        emoji: '🤹',
        markerColor: 'bg-orange-500',
        color: 'bg-orange-100 text-orange-600',
        badgeStyle: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
        iconColor: 'text-orange-500',
        activeColor: 'bg-orange-600 border-orange-600',
        hoverBorder: 'hover:border-orange-500',
        description: 'Kubb, brännboll, kurragömma eller vattenkrig',
        defaultImage: 'https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?auto=format&fit=crop&w=500&q=80'
    },
    sport: {
        id: 'sport',
        label: 'Sport & Tävling',
        emoji: '🏆',
        markerColor: 'bg-red-500',
        color: 'bg-red-100 text-red-600',
        badgeStyle: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
        iconColor: 'text-red-500',
        activeColor: 'bg-red-600 border-red-600',
        hoverBorder: 'hover:border-red-500',
        description: 'Fotbollsmatcher, turneringar och lagidrott',
        defaultImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=500&q=80'
    },
    training: {
        id: 'training',
        label: 'Träning & Hälsa',
        emoji: '💪',
        markerColor: 'bg-emerald-500',
        color: 'bg-emerald-100 text-emerald-600',
        badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
        iconColor: 'text-emerald-500',
        activeColor: 'bg-emerald-600 border-emerald-600',
        hoverBorder: 'hover:border-emerald-500',
        description: 'Gymmet, löprundan, yoga eller powerwalk',
        defaultImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=500&q=80'
    },
    // --- SOCIALT & CAMPUS ---
    party: {
        id: 'party',
        label: 'Fest & Nattliv',
        emoji: '🪩',
        markerColor: 'bg-purple-600',
        color: 'bg-purple-100 text-purple-600',
        badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
        iconColor: 'text-purple-500',
        activeColor: 'bg-purple-600 border-purple-600',
        hoverBorder: 'hover:border-purple-600',
        description: 'Sittningar, mellanfest, utgång eller korridorsfest',
        defaultImage: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=500&q=80'
    },
    social: {
        id: 'social',
        label: 'Fika & Häng',
        emoji: '☕',
        markerColor: 'bg-amber-500',
        color: 'bg-amber-100 text-amber-600',
        badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
        iconColor: 'text-amber-500',
        activeColor: 'bg-amber-600 border-amber-600',
        hoverBorder: 'hover:border-amber-500',
        description: 'Avslappnat häng, kaffe, lunch eller en pratstund',
        defaultImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=500&q=80'
    },
    campus: {
        id: 'campus',
        label: 'Nation & Kår',
        emoji: '🎓',
        markerColor: 'bg-indigo-500',
        color: 'bg-indigo-100 text-indigo-600',
        badgeStyle: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30',
        iconColor: 'text-indigo-500',
        activeColor: 'bg-indigo-600 border-indigo-600',
        hoverBorder: 'hover:border-indigo-500',
        description: 'Evenemang arrangerade av nationer eller kåren',
        defaultImage: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=500&q=80'
    },
    // --- SAMHÄLLE & ENGAGEMANG ---
    community: {
        id: 'community',
        label: 'Samhälle & Påverkan',
        emoji: '🌍',
        markerColor: 'bg-cyan-600',
        color: 'bg-cyan-100 text-cyan-700',
        badgeStyle: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
        iconColor: 'text-cyan-600',
        activeColor: 'bg-cyan-600 border-cyan-600',
        hoverBorder: 'hover:border-cyan-600',
        description: 'Diskussioner, välgörenhet, samarbeten och framtidsfrågor',
        defaultImage: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=500&q=80' // Ny bild: Volontärer/Händer
    },
    culture: {
        id: 'culture',
        label: 'Kultur & Kreativt',
        emoji: '🎭',
        markerColor: 'bg-pink-500',
        color: 'bg-pink-100 text-pink-600',
        badgeStyle: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30',
        iconColor: 'text-pink-500',
        activeColor: 'bg-pink-600 border-pink-600',
        hoverBorder: 'hover:border-pink-500',
        description: 'Livemusik, teater, utställningar och jam sessions',
        defaultImage: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$culture$2e$png$2e$mjs__$7b$__IMAGE__$3d3e$__$225b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$culture$2e$png__$28$static__in__ecmascript$2c$__tag__client$2922$__$7d$__$5b$app$2d$client$5d$__$28$structured__image__object__with__data__url$2c$__ecmascript$29$__["default"] // Updated
    },
    // --- KUNSKAP & INTRESSE ---
    study: {
        id: 'study',
        label: 'Plugg & Fokus',
        emoji: '📚',
        markerColor: 'bg-blue-500',
        color: 'bg-blue-100 text-blue-600',
        badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
        iconColor: 'text-blue-500',
        activeColor: 'bg-blue-600 border-blue-600',
        hoverBorder: 'hover:border-blue-500',
        description: 'Tenta-P, grupparbeten eller tyst läsning',
        defaultImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=500&q=80'
    },
    workshop: {
        id: 'workshop',
        label: 'Kunskap & Lärande',
        emoji: '🧠',
        markerColor: 'bg-sky-500',
        color: 'bg-sky-100 text-sky-600',
        badgeStyle: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30',
        iconColor: 'text-sky-500',
        activeColor: 'bg-sky-600 border-sky-600',
        hoverBorder: 'hover:border-sky-500',
        description: 'Föreläsningar, workshops, språkcafé och nya färdigheter',
        defaultImage: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=500&q=80' // Ny bild: Föreläsningssal/Workshop
    },
    creative: {
        id: 'creative',
        label: 'Skapande & DIY',
        emoji: '🎨',
        markerColor: 'bg-orange-500',
        color: 'bg-orange-100 text-orange-600',
        badgeStyle: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
        iconColor: 'text-orange-500',
        activeColor: 'bg-orange-600 border-orange-600',
        hoverBorder: 'hover:border-orange-500',
        description: 'Måla, rita, handarbete, skriva eller byggprojekt',
        defaultImage: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=500&q=80' // Ny bild: Målarfärger/Penslar
    },
    // --- MAT & ÖVRIGT ---
    food: {
        id: 'food',
        label: 'Mat & Dryck',
        emoji: '🍕',
        markerColor: 'bg-amber-900',
        color: 'bg-amber-100 text-amber-900',
        badgeStyle: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700',
        iconColor: 'text-amber-900',
        activeColor: 'bg-amber-950 border-amber-950',
        hoverBorder: 'hover:border-amber-900',
        description: 'Middag, bakning, grillning eller matlag',
        defaultImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=500&q=80'
    },
    game: {
        id: 'game',
        label: 'Data & Gaming',
        emoji: '🎮',
        markerColor: 'bg-purple-500',
        color: 'bg-purple-100 text-purple-600',
        badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
        iconColor: 'text-purple-500',
        activeColor: 'bg-purple-600 border-purple-600',
        hoverBorder: 'hover:border-purple-500',
        description: 'LAN, konsol-gaming, e-sport eller arkad',
        defaultImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=500&q=80'
    },
    boardgame: {
        id: 'boardgame',
        label: 'Sällskapsspel',
        emoji: '🎲',
        markerColor: 'bg-stone-500',
        color: 'bg-stone-100 text-stone-600',
        badgeStyle: 'bg-stone-100 text-stone-800 border-stone-200 dark:bg-stone-500/20 dark:text-stone-300 dark:border-stone-500/30',
        iconColor: 'text-stone-500',
        activeColor: 'bg-stone-600 border-stone-600',
        hoverBorder: 'hover:border-stone-500',
        description: 'Brädspel, kortspel, rollspel eller schack',
        defaultImage: 'https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?auto=format&fit=crop&w=500&q=80' // Ny bild: Tärningar/Brädspel
    },
    market: {
        id: 'market',
        label: 'Köp & Sälj',
        emoji: '💸',
        markerColor: 'bg-emerald-600',
        color: 'bg-emerald-100 text-emerald-700',
        badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
        iconColor: 'text-emerald-600',
        activeColor: 'bg-emerald-600 border-emerald-600',
        hoverBorder: 'hover:border-emerald-600',
        description: 'Loppis, kurslitteratur eller klädbytardag',
        defaultImage: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=500&q=80' // Ny bild: Loppis/Shopping
    },
    outdoor: {
        id: 'outdoor',
        label: 'Natur & Uteliv',
        emoji: '🌲',
        markerColor: 'bg-green-500',
        color: 'bg-green-100 text-green-600',
        badgeStyle: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
        iconColor: 'text-green-500',
        activeColor: 'bg-green-600 border-green-600',
        hoverBorder: 'hover:border-green-500',
        description: 'Vandring, picknick, cykling, fiske och friluftsliv',
        defaultImage: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=500&q=80'
    },
    movie: {
        id: 'movie',
        label: 'Film & Bio',
        emoji: '🎬',
        markerColor: 'bg-cyan-500',
        color: 'bg-cyan-100 text-cyan-600',
        badgeStyle: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
        iconColor: 'text-cyan-500',
        activeColor: 'bg-cyan-600 border-cyan-600',
        hoverBorder: 'hover:border-cyan-500',
        description: 'Biobesök, filmkvällar eller maraton av en TV-serie',
        defaultImage: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80'
    },
    mingle: {
        id: 'mingle',
        label: 'Nätverk & Mingel',
        emoji: '🤝',
        markerColor: 'bg-teal-500',
        color: 'bg-teal-100 text-teal-600',
        badgeStyle: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30',
        iconColor: 'text-teal-500',
        activeColor: 'bg-teal-600 border-teal-600',
        hoverBorder: 'hover:border-teal-500',
        description: 'Professionellt nätverkande, lokala samarbeten och after work',
        defaultImage: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$mingle$2e$png$2e$mjs__$7b$__IMAGE__$3d3e$__$225b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$assets$2f$categories$2f$mingle$2e$png__$28$static__in__ecmascript$2c$__tag__client$2922$__$7d$__$5b$app$2d$client$5d$__$28$structured__image__object__with__data__url$2c$__ecmascript$29$__["default"] // Updated
    },
    other: {
        id: 'other',
        label: 'Övrigt',
        emoji: '✨',
        markerColor: 'bg-gray-400',
        color: 'bg-gray-100 text-gray-600',
        badgeStyle: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30',
        iconColor: 'text-gray-500',
        activeColor: 'bg-gray-500 border-gray-500',
        hoverBorder: 'hover:border-gray-400',
        description: 'Allt som inte passar in ovan',
        defaultImage: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=500&q=80' // Ny bild: Sparkler/Festligt/Partiklar
    }
};
const AGE_CATEGORIES = [
    {
        id: 'family',
        label: 'Familj',
        min: 0,
        max: 99
    },
    {
        id: 'youth',
        label: 'Ungdom',
        min: 13,
        max: 17
    },
    {
        id: 'adults',
        label: 'Vuxna',
        min: 18,
        max: 99
    },
    {
        id: 'seniors',
        label: 'Seniorer',
        min: 65,
        max: 99
    }
];
const CATEGORY_LIST = Object.values(EVENT_CATEGORIES);
_c = CATEGORY_LIST;
var _c;
__turbopack_context__.k.register(_c, "CATEGORY_LIST");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/utils/mapUtils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateDistance",
    ()=>calculateDistance,
    "getCurrentBrowserLocation",
    ()=>getCurrentBrowserLocation,
    "getEventColor",
    ()=>getEventColor,
    "getEventEmoji",
    ()=>getEventEmoji,
    "getEventLabel",
    ()=>getEventLabel,
    "loadLocationFromLocalStorage",
    ()=>loadLocationFromLocalStorage,
    "saveLocationToLocalStorage",
    ()=>saveLocationToLocalStorage
]);
// src/utils/mapUtils.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/utils/categories.ts [app-client] (ecmascript)");
;
function saveLocationToLocalStorage(lat, lng) {
    localStorage.setItem('user_lat', lat.toString());
    localStorage.setItem('user_lng', lng.toString());
}
function loadLocationFromLocalStorage() {
    const latStr = localStorage.getItem('user_lat');
    const lngStr = localStorage.getItem('user_lng');
    if (latStr && lngStr) {
        return {
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr)
        };
    }
    return null;
}
function getCurrentBrowserLocation() {
    return new Promise((resolve, reject)=>{
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
        }
        navigator.geolocation.getCurrentPosition((pos)=>resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            }), (err)=>reject(err));
    });
}
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Jordens radie i km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
const getEventEmoji = (type)=>{
    const category = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"][type];
    return category ? category.emoji : '🌟';
};
const getEventColor = (type)=>{
    const category = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"][type];
    return category ? category.color : 'bg-slate-100 text-slate-600';
};
const getEventLabel = (type)=>{
    const category = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"][type];
    return category ? category.label : 'Event';
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/views/CreateEvent.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CreateEvent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// src/pages/CreateEvent.tsx
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$MapContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-leaflet/lib/MapContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$TileLayer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-leaflet/lib/TileLayer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$Marker$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-leaflet/lib/Marker.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-leaflet/lib/hooks.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/chevron-left.js [app-client] (ecmascript) <export default as ChevronLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/chevron-right.js [app-client] (ecmascript) <export default as ChevronRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/calendar.js [app-client] (ecmascript) <export default as Calendar>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/map-pin.js [app-client] (ecmascript) <export default as MapPin>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/users.js [app-client] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/info.js [app-client] (ecmascript) <export default as Info>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/image.js [app-client] (ecmascript) <export default as Image>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$key$2d$round$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__KeyRound$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/key-round.js [app-client] (ecmascript) <export default as KeyRound>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-hot-toast/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/layout/Layout.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$events$2f$PromoCodeModal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/events/PromoCodeModal.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/eventService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/userService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$storageService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/storageService.ts [app-client] (ecmascript)");
// OBS: Vi importerar nu även EVENT_CATEGORIES för att få färgerna till markören
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/utils/categories.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$mapUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/utils/mapUtils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
;
;
;
;
;
;
;
;
;
;
;
;
;
;
// --- SUB-KOMPONENT: KARTVÄLJARE MED ANPASSAD MARKÖR ---
function LocationPicker({ position, onLocationSelect, selectedType }) {
    _s();
    const map = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMapEvents"])({
        click (e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
            map.flyTo(e.latlng, map.getZoom());
        }
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LocationPicker.useEffect": ()=>{
            map.setView(position);
        }
    }["LocationPicker.useEffect"], [
        position,
        map
    ]);
    // Hämta stil och emoji baserat på vald kategori (samma logik som Home.tsx)
    const category = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"][selectedType] || __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"].other;
    const emoji = category.emoji;
    const bgClass = category.markerColor; // T.ex. 'bg-amber-500'
    const markerIcon = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].divIcon({
        className: 'custom-marker-teardrop ',
        html: `
    <div class="relative group rotate-45">
        <div class="w-12 h-12 ${bgClass} border-[3px] border-white shadow-md rounded-full rounded-br-none transform  flex items-center justify-center overflow-hidden">

            <div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent"></div>

            <div class="transform -rotate-45 text-2xl filter drop-shadow-sm">
                ${emoji}
            </div>
        </div>
    </div>
    `,
        iconSize: [
            48,
            65
        ],
        iconAnchor: [
            24,
            58
        ]
    });
    return position ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$Marker$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Marker"], {
        position: position,
        icon: markerIcon
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
        lineNumber: 68,
        columnNumber: 23
    }, this) : null;
}
_s(LocationPicker, "gWh149/DLPuF22WgXAndVVlzhL4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMapEvents"]
    ];
});
_c = LocationPicker;
function LoginAlertModal({ isOpen, onClose }) {
    _s1();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    if (!isOpen) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: onClose,
                    className: "absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                        size: 20
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                        lineNumber: 80,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 79,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col items-center text-center space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$key$2d$round$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__KeyRound$3e$__["KeyRound"], {
                                size: 32
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                lineNumber: 84,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 83,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-xl font-bold",
                            children: "Du behöver logga in"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 86,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-muted-foreground",
                            children: "För att publicera ett event behöver du vara inloggad."
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 87,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>router.push('/login?redirect=/create'),
                            className: "w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-transform active:scale-95",
                            children: "Logga in / Registrera"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 90,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "text-sm font-semibold text-muted-foreground hover:text-foreground",
                            children: "Avbryt"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 96,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 82,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
            lineNumber: 78,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
        lineNumber: 77,
        columnNumber: 9
    }, this);
}
_s1(LoginAlertModal, "fN7XvhJ+p5oE6+Xlo0NJmXpxjC8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c1 = LoginAlertModal;
function CreateEvent() {
    _s2();
    const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"])();
    const id = params?.id;
    const isEditMode = !!id;
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [userProfile, setUserProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Hämta sparad plats vid start (Endast om vi INTE redigerar)
    const savedLocation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateEvent.useMemo[savedLocation]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$mapUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadLocationFromLocalStorage"])()
    }["CreateEvent.useMemo[savedLocation]"], []);
    const [step, setStep] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(1);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const totalSteps = 6;
    // Form Data State - INITIERA MED SPARAD DATA OM FINNS
    const [formData, setFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "CreateEvent.useState": ()=>{
            // Försök hämta från sessionStorage först
            if (!isEditMode) {
                try {
                    const saved = sessionStorage.getItem('create_event_backup');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        // Återställ datumobjekt som blir strängar i JSON
                        if (parsed.date) parsed.date = new Date(parsed.date);
                        return parsed;
                    }
                } catch (e) {
                    console.error("Kunde inte läsa sparad form data", e);
                }
            }
            return {
                type: '',
                title: '',
                description: '',
                lat: 56.8790,
                lng: 14.8059,
                locationName: '',
                date: new Date(),
                timeStr: '18:00',
                ageCategory: 'adults',
                minAge: 18,
                maxAge: 99,
                minParticipants: 2,
                maxParticipants: 10,
                price: 0,
                requiresApproval: false,
                coverImage: '',
                customCategory: ''
            };
        }
    }["CreateEvent.useState"]);
    // NY: State för filuppladdning
    const [coverImageFile, setCoverImageFile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [previewUrl, setPreviewUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(formData.coverImage || null);
    const [currentMonth, setCurrentMonth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Date(formData.date));
    // NY: Kod för exklusiva kategorier
    const [showPromoModal, setShowPromoModal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [showLoginAlert, setShowLoginAlert] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // LIMIT CHECK STATE
    const [hasActiveLimitValues, setHasActiveLimitValues] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [showLimitModal, setShowLimitModal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // CHECK LIMIT ON MOUNT
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CreateEvent.useEffect": ()=>{
            if (!user) return;
            async function checkLimit() {
                if (!user) return; // Repetated check for type narrowing in async closure
                setLoading(true);
                try {
                    // 1. Check premium status
                    const p = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["userService"].getUserProfile(user.uid);
                    const isPremium = (p?.redeemedCodes?.length || 0) > 0;
                    // 2. Check active events
                    const hosted = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].getHostedEvents(user.uid);
                    const now = new Date();
                    const activeCount = hosted.filter({
                        "CreateEvent.useEffect.checkLimit": (e)=>new Date(e.time) >= now
                    }["CreateEvent.useEffect.checkLimit"]).length;
                    setHasActiveLimitValues({
                        count: activeCount,
                        isPremium
                    });
                    // If NOT premium AND limit reached -> Block
                    if (!isPremium && activeCount >= 3 && !isEditMode) {
                        setShowLimitModal(true);
                    }
                } catch (e) {
                    console.error("Failed to check limit", e);
                } finally{
                    setLoading(false);
                }
            }
            checkLimit();
        }
    }["CreateEvent.useEffect"], [
        user,
        isEditMode
    ]);
    // --- CLEANUP & PERSISTENCE ---
    // Spara till sessionStorage vid ändring (om ej edit mode)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CreateEvent.useEffect": ()=>{
            if (!isEditMode) {
                const dataToSave = {
                    ...formData
                };
                // Vi kan inte spara File-objektet i session storage enkelt, men resten går bra.
                // URL:er till bilder sparas ok om de är strängar.
                sessionStorage.setItem('create_event_backup', JSON.stringify(dataToSave));
            }
        }
    }["CreateEvent.useEffect"], [
        formData,
        isEditMode
    ]);
    // Rensa vid unmount om man lämnar sidan helt (valfritt, men kanske bra om man avbryter)
    // Dock: Om användaren går till Login vill vi ha kvar det. Så vi rensar INTE på unmount.
    // Vi rensar BARA vid lyckad publicering.
    const handlePromoSuccess = (_code, customName)=>{
        setFormData({
            ...formData,
            type: 'campus',
            customCategory: customName
        });
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success(`Kategori inställd: ${customName} `);
    };
    // --- LADDA EVENT OM REDIGERING ---
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CreateEvent.useEffect": ()=>{
            if (isEditMode && id) {
                setLoading(true);
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].getById(id).then({
                    "CreateEvent.useEffect": (event)=>{
                        if (event) {
                            // Kontrollera att det är rätt ägare
                            if (user && event.host.uid !== user.uid) {
                                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Du får inte redigera detta event!");
                                router.push('/');
                                return;
                            }
                            // Fyll i formuläret
                            // Hantera om time är en Timestamp (från Firebase SDK direkt) eller Date (från vår Service)
                            // @ts-ignore - Ibland kommer det som timestamp trots typningen
                            const eventDate = event.time.seconds ? new Date(event.time.seconds * 1000) : new Date(event.time);
                            setFormData({
                                type: event.type,
                                title: event.title,
                                description: event.description || '',
                                lat: event.lat,
                                lng: event.lng,
                                locationName: event.location.name,
                                date: eventDate,
                                timeStr: eventDate.toLocaleTimeString('sv-SE', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }),
                                ageCategory: event.ageCategory,
                                minAge: event.minAge,
                                maxAge: event.maxAge,
                                minParticipants: event.minParticipants,
                                maxParticipants: event.maxParticipants,
                                price: event.price,
                                requiresApproval: event.requiresApproval || false,
                                coverImage: event.coverImage || '',
                                customCategory: event.customCategory || '' // <--- NY: Ladda in anpassad kategori
                            });
                            if (event.coverImage) {
                                setPreviewUrl(event.coverImage);
                            }
                            // Sätt kalendern till rätt månad
                            setCurrentMonth(new Date(eventDate));
                        }
                        setLoading(false);
                    }
                }["CreateEvent.useEffect"]);
            }
        }
    }["CreateEvent.useEffect"], [
        id,
        isEditMode,
        user
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CreateEvent.useEffect": ()=>{
            // Endast sätt position från saved/GPS om vi INTE redigerar och inte har laddat data än
            if (!isEditMode && !formData.type && savedLocation) {
                setFormData({
                    "CreateEvent.useEffect": (prev)=>({
                            ...prev,
                            lat: savedLocation.lat,
                            lng: savedLocation.lng
                        })
                }["CreateEvent.useEffect"]);
            } else if (!isEditMode && !formData.type && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition({
                    "CreateEvent.useEffect": (pos)=>{
                        setFormData({
                            "CreateEvent.useEffect": (prev)=>({
                                    ...prev,
                                    lat: pos.coords.latitude,
                                    lng: pos.coords.longitude
                                })
                        }["CreateEvent.useEffect"]);
                    }
                }["CreateEvent.useEffect"]);
            }
        }
    }["CreateEvent.useEffect"], [
        savedLocation,
        isEditMode
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CreateEvent.useEffect": ()=>{
            if (user) {
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["userService"].getUserProfile(user.uid).then({
                    "CreateEvent.useEffect": (profile)=>{
                        if (profile) {
                            setUserProfile(profile);
                        }
                    }
                }["CreateEvent.useEffect"]).catch({
                    "CreateEvent.useEffect": (error)=>{
                        console.error("Kunde inte hämta UserProfile:", error);
                    }
                }["CreateEvent.useEffect"]);
            }
        }
    }["CreateEvent.useEffect"], [
        user
    ]);
    // --- BILD HANTERING ---
    const handleImageChange = (e)=>{
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCoverImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };
    const clearImage = ()=>{
        setCoverImageFile(null);
        setPreviewUrl(null);
        setFormData({
            ...formData,
            coverImage: ''
        });
    };
    // --- LOGIK ---
    const handleNext = ()=>{
        if (!validateStep(step)) return;
        setStep((prev)=>Math.min(prev + 1, totalSteps));
    };
    const handleBack = ()=>{
        setStep((prev)=>Math.max(prev - 1, 1));
    };
    const validateStep = (currentStep)=>{
        switch(currentStep){
            case 1:
                if (!formData.type) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Välj en kategori först!");
                    return false;
                }
                return true;
            case 2:
                return true;
            case 3:
                if (!formData.title) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Ange en titel!");
                    return false;
                }
                return true;
            case 4:
                const combinedDate = new Date(formData.date);
                const [hours, minutes] = formData.timeStr.split(':').map(Number);
                combinedDate.setHours(hours, minutes);
                if (combinedDate < new Date()) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Tiden måste vara i framtiden!");
                    return false;
                }
                return true;
            case 6:
                if (formData.maxParticipants < formData.minParticipants) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Max antal kan inte vara mindre än minsta antal.");
                    return false;
                }
                return true;
            default:
                return true;
        }
    };
    const handleSubmit = async ()=>{
        if (!user) {
            setShowLoginAlert(true);
            return;
        }
        if (!userProfile) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Vänta, laddar din profil...");
            return;
        }
        if (!user.email) return;
        setLoading(true);
        // --- SUBMIT-TIME LIMIT CHECK (Double Check) ---
        if (!isEditMode) {
            try {
                const p = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["userService"].getUserProfile(user.uid);
                const isPremium = (p?.redeemedCodes?.length || 0) > 0;
                if (!isPremium) {
                    const hosted = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].getHostedEvents(user.uid);
                    const now = new Date();
                    // Räkna aktiva events (starttid i framtiden)
                    const activeCount = hosted.filter((e)=>new Date(e.time) >= now).length;
                    if (activeCount >= 3) {
                        setShowLimitModal(true); // Visa modalen
                        setLoading(false);
                        return; // Stoppa sparande
                    }
                }
            } catch (checkErr) {
                console.error("Limit double-check failed", checkErr);
            // Vi låter det passera om checken failar (fail open) eller blockar? Fail safe (block) kanske bättre men irriterande.
            // Låt oss logga och fortsätta för nu, eller blocka?
            // Vi kör vidare för att inte blockera vid nätverksfel, men loggar.
            }
        }
        const finalDate = new Date(formData.date);
        const [h, m] = formData.timeStr.split(':').map(Number);
        finalDate.setHours(h, m);
        try {
            // Gemensam data
            const commonData = {
                title: formData.title,
                description: formData.description,
                location: {
                    name: formData.locationName || "Vald plats",
                    distance: 0
                },
                lat: formData.lat,
                lng: formData.lng,
                time: finalDate,
                type: formData.type,
                price: Number(formData.price),
                minParticipants: Number(formData.minParticipants),
                maxParticipants: Number(formData.maxParticipants),
                minAge: Number(formData.minAge),
                maxAge: Number(formData.maxAge),
                ageCategory: formData.ageCategory,
                requiresApproval: formData.requiresApproval,
                coverImage: formData.coverImage,
                customCategory: formData.customCategory // <--- NY: Spara anpassad kategori
            };
            // Om vi har en ny fil, ladda upp den och uppdatera URL
            if (coverImageFile) {
                const path = `event - images / ${user.uid}/${Date.now()}_${coverImageFile.name}`;
                const url = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$storageService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["storageService"].uploadFile(path, coverImageFile);
                commonData.coverImage = url;
            }
            if (isEditMode && id) {
                // --- UPPDATERA BEFINTLIGT EVENT ---
                // Vi behöver hämta hela eventet först för att inte tappa bort deltagare/host
                const existingEvent = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].getById(id);
                if (!existingEvent) throw new Error("Event not found");
                const updatedEvent = {
                    ...existingEvent,
                    ...commonData
                };
                await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].update(updatedEvent);
                // Rensa hem-cachen så att ändringen syns
                sessionStorage.removeItem('vadkul_events_cache');
                sessionStorage.removeItem('vadkul_events_cache_time');
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success('Eventet är uppdaterat! 🎉');
                router.push(`/event/${id}`);
            } else {
                // --- SKAPA NYTT EVENT ---
                const newEvent = {
                    ...commonData,
                    views: 0,
                    host: {
                        uid: user.uid,
                        name: user.displayName || user.email,
                        initials: (user.displayName || user.email).substring(0, 2).toUpperCase(),
                        email: user.email,
                        verified: userProfile.isVerified,
                        rating: 5.0,
                        photoURL: userProfile.photoURL || user.photoURL || null
                    },
                    attendees: [
                        {
                            uid: user.uid,
                            email: user.email || '',
                            displayName: user.displayName || 'Värd',
                            photoURL: userProfile.photoURL || user.photoURL || null,
                            status: 'confirmed'
                        }
                    ]
                };
                await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].create(newEvent);
                sessionStorage.removeItem('create_event_backup');
                // Rensa hem-cachen så att det nya eventet syns
                sessionStorage.removeItem('vadkul_events_cache');
                sessionStorage.removeItem('vadkul_events_cache_time');
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success('Eventet är publicerat! 🎉');
                router.push('/');
            }
        } catch (error) {
            console.error("Fel vid sparande:", error);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Kunde inte spara eventet. Försök igen.");
        } finally{
            setLoading(false);
        }
    };
    const calendarDays = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateEvent.useMemo[calendarDays]": ()=>{
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            const firstDayOfMonth = new Date(year, month, 1);
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let startDay = firstDayOfMonth.getDay();
            startDay = (startDay + 6) % 7;
            const days = [];
            for(let i = 0; i < startDay; i++)days.push(null);
            for(let i = 1; i <= daysInMonth; i++)days.push(new Date(year, month, i));
            return days;
        }
    }["CreateEvent.useMemo[calendarDays]"], [
        currentMonth
    ]);
    // --- LIMIT BLOCKING UI ---
    if (showLimitModal && hasActiveLimitValues) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$key$2d$round$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__KeyRound$3e$__["KeyRound"], {
                                size: 32
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                lineNumber: 527,
                                columnNumber: 29
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 526,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-2xl font-bold mb-2",
                            children: "Maxgräns nådd!"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 529,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-muted-foreground mb-6",
                            children: [
                                "Du har ",
                                hasActiveLimitValues.count,
                                " aktiva events. ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 531,
                                    columnNumber: 80
                                }, this),
                                "För att skapa fler måste du hitta en hemlig kod på campus!"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 530,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>router.push('/profile'),
                                    className: "w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all",
                                    children: "Jag har en kod! (Gå till Profil)"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 536,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>router.push('/'),
                                    className: "block w-full text-sm font-semibold text-muted-foreground hover:text-foreground py-2",
                                    children: "Gå tillbaka till startsidan"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 542,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 535,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 525,
                    columnNumber: 21
                }, this)
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                lineNumber: 524,
                columnNumber: 17
            }, this)
        }, void 0, false, {
            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
            lineNumber: 523,
            columnNumber: 13
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "max-w-lg mx-auto pb-20 px-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between py-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-2xl font-extrabold text-foreground",
                            children: [
                                isEditMode ? 'Redigera Event' : 'Skapa Event',
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-base text-primary ml-2",
                                    children: [
                                        "Steg ",
                                        step,
                                        "/",
                                        totalSteps
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 564,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 562,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>router.push('/'),
                            className: "text-sm font-semibold text-muted-foreground hover:text-destructive",
                            children: "Avbryt"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 566,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 561,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-1.5 w-full bg-muted rounded-full mb-8 overflow-hidden",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-full bg-primary transition-all duration-300",
                        style: {
                            width: `${step / totalSteps * 100}%`
                        }
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                        lineNumber: 573,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 572,
                    columnNumber: 17
                }, this),
                step === 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "animate-in fade-in slide-in-from-right-4 duration-300",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-bold mb-4 text-foreground",
                            children: "Vad vill du hitta på?"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 579,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap gap-3 justify-center",
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CATEGORY_LIST"].filter((cat)=>cat.id !== 'campus') // Dölj "Nation & Kår" från listan
                            .map((cat)=>{
                                const isSelected = formData.type === cat.id;
                                const bg = isSelected ? `${cat.activeColor} text-white shadow-lg scale-105` : `bg-card text-foreground border-border ${cat.hoverBorder} hover:scale-105`;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>setFormData({
                                            ...formData,
                                            type: cat.id,
                                            customCategory: ''
                                        }),
                                    className: `px-4 py-3 rounded-full font-bold transition-all duration-200 flex items-center gap-2 border-2 ${bg}`,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: cat.emoji
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 596,
                                            columnNumber: 45
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: cat.label
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 597,
                                            columnNumber: 45
                                        }, this)
                                    ]
                                }, cat.id, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 591,
                                    columnNumber: 41
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 580,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-8 flex flex-col items-center",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setShowPromoModal(true),
                                className: "text-sm font-semibold text-muted-foreground hover:text-primary underline mb-3 flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$key$2d$round$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__KeyRound$3e$__["KeyRound"], {
                                        size: 16
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                        lineNumber: 609,
                                        columnNumber: 33
                                    }, this),
                                    " Har du en kod?"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                lineNumber: 605,
                                columnNumber: 29
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 604,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 578,
                    columnNumber: 21
                }, this),
                step === 2 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "animate-in fade-in slide-in-from-right-4 duration-300 space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-bold text-foreground",
                            children: "Var ska ni ses?"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 618,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-muted-foreground",
                            children: "Klicka på kartan för att flytta markören."
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 619,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-72 w-full rounded-xl overflow-hidden border border-border shadow-inner relative z-0",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$MapContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapContainer"], {
                                center: [
                                    formData.lat,
                                    formData.lng
                                ],
                                zoom: 14,
                                style: {
                                    height: '100%',
                                    width: '100%'
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$TileLayer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TileLayer"], {
                                        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                        lineNumber: 623,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LocationPicker, {
                                        position: [
                                            formData.lat,
                                            formData.lng
                                        ],
                                        onLocationSelect: (lat, lng)=>setFormData({
                                                ...formData,
                                                lat,
                                                lng
                                            }),
                                        selectedType: formData.type
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                        lineNumber: 624,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                lineNumber: 622,
                                columnNumber: 29
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 621,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-xs font-bold text-muted-foreground uppercase mb-1",
                                    children: "Platsnamn (Valfritt)"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 633,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__["MapPin"], {
                                            className: "absolute left-3 top-3 text-muted-foreground",
                                            size: 18
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 635,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            value: formData.locationName,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    locationName: e.target.value
                                                }),
                                            className: "w-full pl-10 p-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none",
                                            placeholder: "T.ex. Vid fontänen"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 636,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 634,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 632,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 617,
                    columnNumber: 21
                }, this),
                step === 3 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "animate-in fade-in slide-in-from-right-4 duration-300 space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-bold text-foreground",
                            children: "Beskriv ditt event"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 651,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-xs font-bold text-muted-foreground uppercase mb-2",
                                    children: "Omslagsbild (Valfritt)"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 655,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative w-full h-40 bg-muted rounded-xl overflow-hidden border-2 border-dashed border-border group cursor-pointer hover:border-primary transition-colors",
                                    children: [
                                        previewUrl || formData.type && __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"][formData.type]?.defaultImage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                    src: previewUrl || (()=>{
                                                        const img = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"][formData.type]?.defaultImage;
                                                        return typeof img === 'string' ? img : img?.src;
                                                    })(),
                                                    alt: "Preview",
                                                    className: "w-full h-full object-cover"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 660,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"], {
                                                                size: 20
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                                lineNumber: 673,
                                                                columnNumber: 49
                                                            }, this),
                                                            " Byt bild"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                        lineNumber: 672,
                                                        columnNumber: 45
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 671,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-full h-full flex flex-col items-center justify-center text-muted-foreground",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"], {
                                                    size: 32,
                                                    className: "mb-2 opacity-50"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 679,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-sm font-medium",
                                                    children: "Klicka för att ladda upp"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 680,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 678,
                                            columnNumber: 37
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "file",
                                            accept: "image/*",
                                            onChange: handleImageChange,
                                            className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 684,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 657,
                                    columnNumber: 29
                                }, this),
                                (previewUrl || formData.coverImage) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: clearImage,
                                    className: "text-xs text-destructive hover:underline mt-1 flex items-center gap-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                            size: 12
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 697,
                                            columnNumber: 37
                                        }, this),
                                        " Återställ till standardbild"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 693,
                                    columnNumber: 33
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 654,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-xs font-bold text-muted-foreground uppercase mb-1",
                                    children: "Titel"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 703,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    value: formData.title,
                                    onChange: (e)=>setFormData({
                                            ...formData,
                                            title: e.target.value
                                        }),
                                    className: "w-full p-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none",
                                    placeholder: "T.ex. Fotboll i parken",
                                    autoFocus: true
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 704,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 702,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-xs font-bold text-muted-foreground uppercase mb-1",
                                    children: "Beskrivning (Valfritt)"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 715,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    value: formData.description,
                                    onChange: (e)=>setFormData({
                                            ...formData,
                                            description: e.target.value
                                        }),
                                    className: "w-full p-3 h-32 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none resize-none",
                                    placeholder: "Berätta lite mer..."
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 716,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 714,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 650,
                    columnNumber: 21
                }, this),
                step === 4 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "animate-in fade-in slide-in-from-right-4 duration-300 space-y-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-bold text-foreground",
                            children: "När händer det?"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 729,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-card dark:bg-neutral-900 p-4 rounded-xl border border-border shadow-sm",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex justify-between items-center mb-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-bold capitalize text-foreground",
                                            children: currentMonth.toLocaleDateString('sv-SE', {
                                                month: 'long',
                                                year: 'numeric'
                                            })
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 734,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: ()=>setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1))),
                                                    className: "p-1 hover:bg-muted rounded text-foreground",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                                                        size: 20
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                        lineNumber: 738,
                                                        columnNumber: 194
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 738,
                                                    columnNumber: 37
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: ()=>setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1))),
                                                    className: "p-1 hover:bg-muted rounded text-foreground",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                                                        size: 20
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                        lineNumber: 739,
                                                        columnNumber: 194
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 739,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 737,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 733,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-7 gap-1 text-center mb-2",
                                    children: [
                                        'M',
                                        'T',
                                        'O',
                                        'T',
                                        'F',
                                        'L',
                                        'S'
                                    ].map((d, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-xs font-bold text-muted-foreground",
                                            children: d
                                        }, i, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 744,
                                            columnNumber: 84
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 743,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-7 gap-1",
                                    children: calendarDays.map((date, i)=>{
                                        if (!date) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {}, i, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 749,
                                            columnNumber: 55
                                        }, this);
                                        const isSelected = date.toDateString() === new Date(formData.date).toDateString();
                                        const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            disabled: isPast,
                                            onClick: ()=>setFormData({
                                                    ...formData,
                                                    date: date
                                                }),
                                            className: `
                                        aspect-square rounded-full text-sm flex items-center justify-center transition-colors
                                        ${isSelected ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-primary/10 text-foreground'}
                                        ${isPast ? 'opacity-30 cursor-not-allowed' : ''}
                                    `,
                                            children: date.getDate()
                                        }, i, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 755,
                                            columnNumber: 41
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 747,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 732,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-xs font-bold text-muted-foreground uppercase mb-1",
                                    children: "Klockslag"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 774,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__["Calendar"], {
                                            className: "absolute left-3 top-3 text-muted-foreground",
                                            size: 18
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 776,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "time",
                                            value: formData.timeStr,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    timeStr: e.target.value
                                                }),
                                            className: "w-full pl-10 p-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 777,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 775,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 773,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 728,
                    columnNumber: 21
                }, this),
                step === 5 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "animate-in fade-in slide-in-from-right-4 duration-300 space-y-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-bold text-foreground",
                            children: "Vem passar det för?"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 791,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-xs font-bold text-muted-foreground uppercase mb-2",
                                    children: "Kategori"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 794,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    value: formData.ageCategory,
                                    onChange: (e)=>{
                                        const cat = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AGE_CATEGORIES"].find((c)=>c.id === e.target.value);
                                        setFormData({
                                            ...formData,
                                            ageCategory: e.target.value,
                                            minAge: cat ? cat.min : 0,
                                            maxAge: cat ? cat.max : 99
                                        });
                                    },
                                    className: "w-full p-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none",
                                    children: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AGE_CATEGORIES"].map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: c.id,
                                            children: c.label
                                        }, c.id, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 808,
                                            columnNumber: 58
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 795,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 793,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-2 gap-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "block text-xs font-bold text-muted-foreground uppercase mb-1",
                                            children: "Min Ålder"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 814,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "number",
                                            value: formData.minAge,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    minAge: parseInt(e.target.value)
                                                }),
                                            className: "w-full p-3 rounded-xl border border-border bg-card text-foreground text-center"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 815,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 813,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "block text-xs font-bold text-muted-foreground uppercase mb-1",
                                            children: "Max Ålder"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 823,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "number",
                                            value: formData.maxAge,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    maxAge: parseInt(e.target.value)
                                                }),
                                            className: "w-full p-3 rounded-xl border border-border bg-card text-foreground text-center"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 824,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 822,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 812,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-primary/10 p-4 rounded-xl flex gap-3 text-primary text-sm",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__["Info"], {
                                    className: "shrink-0",
                                    size: 20
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 834,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    children: "Detta är bara rekommendationer så att rätt personer hittar ditt event."
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 835,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 833,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 790,
                    columnNumber: 21
                }, this),
                step === 6 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "animate-in fade-in slide-in-from-right-4 duration-300 space-y-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-bold text-foreground",
                            children: "Sista detaljerna"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 843,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-card dark:bg-neutral-900 p-6 rounded-xl border border-border shadow-sm space-y-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between border-b border-border pb-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-bold text-foreground",
                                                    children: "Kräv godkännande"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 850,
                                                    columnNumber: 37
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-xs text-muted-foreground",
                                                    children: "Du måste godkänna deltagare manuellt"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 851,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 849,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setFormData({
                                                    ...formData,
                                                    requiresApproval: !formData.requiresApproval
                                                }),
                                            className: `
                                w-12 h-6 rounded-full transition-colors relative
                                ${formData.requiresApproval ? 'bg-primary' : 'bg-muted'}
                            `,
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: `
                                w-4 h-4 rounded-full bg-background shadow-sm absolute top-1 transition-transform
                                ${formData.requiresApproval ? 'left-7' : 'left-1'}
                            `
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                lineNumber: 860,
                                                columnNumber: 37
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 853,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 848,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "block text-xs font-bold text-muted-foreground uppercase mb-1",
                                            children: "Pris"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 869,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "number",
                                                    value: formData.price,
                                                    onChange: (e)=>setFormData({
                                                            ...formData,
                                                            price: parseInt(e.target.value)
                                                        }),
                                                    className: "w-full p-3 pr-10 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 871,
                                                    columnNumber: 37
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm",
                                                    children: "kr"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 878,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 870,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs text-muted-foreground mt-1",
                                            children: "Sätt 0 för gratis."
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 880,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 868,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2 mb-3 border-t border-border pt-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"], {
                                                    size: 18,
                                                    className: "text-primary"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 887,
                                                    columnNumber: 37
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "block text-xs font-bold text-muted-foreground uppercase mt-0.5",
                                                    children: "Antal Deltagare"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 888,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 886,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "grid grid-cols-2 gap-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "block text-[10px] font-bold text-muted-foreground uppercase mb-1",
                                                            children: "Minst antal"
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                            lineNumber: 893,
                                                            columnNumber: 41
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "relative",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                    type: "number",
                                                                    min: "2",
                                                                    value: formData.minParticipants,
                                                                    onChange: (e)=>setFormData({
                                                                            ...formData,
                                                                            minParticipants: parseInt(e.target.value)
                                                                        }),
                                                                    className: "w-full p-3 pr-12 rounded-xl border border-border bg-muted/50 text-foreground text-center outline-none focus:ring-2 focus:ring-primary"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                                    lineNumber: 895,
                                                                    columnNumber: 45
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs pointer-events-none",
                                                                    children: "pers"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                                    lineNumber: 903,
                                                                    columnNumber: 45
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                            lineNumber: 894,
                                                            columnNumber: 41
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 892,
                                                    columnNumber: 37
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "block text-[10px] font-bold text-muted-foreground uppercase mb-1",
                                                            children: "Max antal"
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                            lineNumber: 907,
                                                            columnNumber: 41
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "relative",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                    type: "number",
                                                                    min: "2",
                                                                    value: formData.maxParticipants,
                                                                    onChange: (e)=>setFormData({
                                                                            ...formData,
                                                                            maxParticipants: parseInt(e.target.value)
                                                                        }),
                                                                    className: "w-full p-3 pr-12 rounded-xl border border-border bg-muted/50 text-foreground text-center outline-none focus:ring-2 focus:ring-primary"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                                    lineNumber: 909,
                                                                    columnNumber: 45
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs pointer-events-none",
                                                                    children: "pers"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                                    lineNumber: 917,
                                                                    columnNumber: 45
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                            lineNumber: 908,
                                                            columnNumber: 41
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                                    lineNumber: 906,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                            lineNumber: 891,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 884,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 845,
                            columnNumber: 25
                        }, this),
                        formData.price === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-2 text-green-600 bg-green-500/20 p-3 rounded-lg font-bold text-sm justify-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                    size: 18
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 927,
                                    columnNumber: 33
                                }, this),
                                "Detta event blir gratis!"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                            lineNumber: 926,
                            columnNumber: 29
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 842,
                    columnNumber: 21
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "fixed bottom-0 left-0 right-0 p-4 bg-card dark:bg-neutral-900 border-t border-border z-50",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "max-w-lg mx-auto flex gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleBack,
                                disabled: step === 1,
                                className: "px-6 py-3 rounded-xl font-bold bg-muted text-muted-foreground disabled:opacity-50 transition-colors",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                                    size: 24
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                    lineNumber: 942,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                lineNumber: 937,
                                columnNumber: 25
                            }, this),
                            step < totalSteps ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleNext,
                                className: "flex-grow py-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-transform active:scale-[0.98] flex items-center justify-center gap-2",
                                children: [
                                    "Nästa ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                                        size: 20
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                        lineNumber: 950,
                                        columnNumber: 39
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                lineNumber: 946,
                                columnNumber: 29
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleSubmit,
                                disabled: loading,
                                className: "flex-grow py-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70",
                                children: [
                                    loading ? isEditMode ? 'Sparar...' : 'Publicerar...' : isEditMode ? 'Spara ändringar' : 'Publicera Event',
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                        size: 20
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                        lineNumber: 958,
                                        columnNumber: 145
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                                lineNumber: 953,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                        lineNumber: 936,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 935,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$events$2f$PromoCodeModal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    isOpen: showPromoModal,
                    onClose: ()=>setShowPromoModal(false),
                    onSuccess: handlePromoSuccess
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 963,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginAlertModal, {
                    isOpen: showLoginAlert,
                    onClose: ()=>setShowLoginAlert(false)
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
                    lineNumber: 968,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
            lineNumber: 558,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/views/CreateEvent.tsx",
        lineNumber: 557,
        columnNumber: 9
    }, this);
}
_s2(CreateEvent, "xXwqTfa8JFyLPDz6/J10NpQy0+8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c2 = CreateEvent;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "LocationPicker");
__turbopack_context__.k.register(_c1, "LoginAlertModal");
__turbopack_context__.k.register(_c2, "CreateEvent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/views/CreateEvent.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/source/repos/vadkul/src/views/CreateEvent.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=source_repos_vadkul_src_cf52409a._.js.map