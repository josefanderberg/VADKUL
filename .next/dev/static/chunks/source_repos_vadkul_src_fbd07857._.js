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
"[project]/source/repos/vadkul/src/services/friendService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "friendService",
    ()=>friendService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript)");
;
;
const friendService = {
    // Check status between current user and target user
    async checkFriendStatus (currentUid, targetUid) {
        if (!currentUid || !targetUid) return 'none';
        // Check friend document in current user's subcollection
        const docRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', currentUid, 'friends', targetUid);
        const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDoc"])(docRef);
        if (snap.exists()) {
            return snap.data().status;
        }
        return 'none';
    },
    // Check if users are friends (helper for booleans)
    async isFriend (currentUid, targetUid) {
        const status = await this.checkFriendStatus(currentUid, targetUid);
        return status === 'accepted';
    },
    // Send friend request
    async sendFriendRequest (currentUid, targetUid) {
        const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
        // 1. My side: 'pending' (I am waiting for answer)
        const myRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', currentUid, 'friends', targetUid);
        batch.set(myRef, {
            uid: targetUid,
            status: 'pending',
            createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
        });
        // 2. Their side: 'incoming' (They have a request)
        const theirRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', targetUid, 'friends', currentUid);
        batch.set(theirRef, {
            uid: currentUid,
            status: 'incoming',
            createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
        });
        await batch.commit();
    },
    // Accept friend request
    async acceptFriendRequest (currentUid, targetUid) {
        const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
        // Both become 'accepted'
        const myRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', currentUid, 'friends', targetUid);
        batch.update(myRef, {
            status: 'accepted',
            updatedAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
        });
        const theirRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', targetUid, 'friends', currentUid);
        batch.update(theirRef, {
            status: 'accepted',
            updatedAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
        });
        await batch.commit();
    },
    // Remove friend or cancel request
    async removeFriend (currentUid, targetUid) {
        const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
        const myRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', currentUid, 'friends', targetUid);
        batch.delete(myRef);
        const theirRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', targetUid, 'friends', currentUid);
        batch.delete(theirRef);
        await batch.commit();
    },
    // Get list of friends (accepts)
    async getFriends (uid) {
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', uid, 'friends'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('status', '==', 'accepted'));
        const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
        const friendIds = snap.docs.map((doc)=>doc.id);
        return friendIds;
    },
    // Get incoming requests
    async getFriendRequests (uid) {
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', uid, 'friends'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('status', '==', 'incoming'));
        const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
        return snap.docs.map((doc)=>({
                uid: doc.data().uid,
                createdAt: doc.data().createdAt
            }));
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/components/ui/Loading.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Loading
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
;
function Loading({ text = "Laddar...", fullScreen = false }) {
    // Spinner Component
    const Spinner = ({ size = "md" })=>{
        const dims = size === "lg" ? "w-16 h-16 border-[6px]" : "w-10 h-10 border-4";
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `relative ${size === "lg" ? "w-16 h-16" : "w-10 h-10"}`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `absolute inset-0 ${dims} border-primary/20 rounded-full`
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
                    lineNumber: 11,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `absolute inset-0 ${dims} border-primary border-t-transparent rounded-full animate-spin`
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
                    lineNumber: 13,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
            lineNumber: 9,
            columnNumber: 13
        }, this);
    };
    if (fullScreen) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-6",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Spinner, {
                        size: "lg"
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
                        lineNumber: 22,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
                    lineNumber: 21,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xl font-bold text-foreground animate-pulse tracking-wide",
                    children: text
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
                    lineNumber: 24,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
            lineNumber: 20,
            columnNumber: 13
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col items-center justify-center p-8",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Spinner, {
                    size: "md"
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
                    lineNumber: 32,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
                lineNumber: 31,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-muted-foreground text-sm font-medium",
                children: text
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
                lineNumber: 34,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/source/repos/vadkul/src/components/ui/Loading.tsx",
        lineNumber: 30,
        columnNumber: 9
    }, this);
}
_c = Loading;
var _c;
__turbopack_context__.k.register(_c, "Loading");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/utils/dateUtils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateAge",
    ()=>calculateAge,
    "formatEventDate",
    ()=>formatEventDate,
    "formatTime",
    ()=>formatTime
]);
const calculateAge = (birthDateString)=>{
    if (!birthDateString) return 0;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
        age--;
    }
    return age;
};
const formatTime = (date)=>{
    return date.toLocaleTimeString('sv-SE', {
        hour: '2-digit',
        minute: '2-digit'
    });
};
const formatEventDate = (date)=>{
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear();
    const time = formatTime(date);
    if (isToday) {
        return `Idag ${time}`;
    } else if (isTomorrow) {
        return `Imorgon ${time}`;
    } else {
        // Weekday Day Month Time (e.g., "Mån 12 Jan 18:00")
        const dateStr = date.toLocaleDateString('sv-SE', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
        // Remove dot from month abbreviation if present and capitalize
        const cleanDateStr = dateStr.replace('.', '');
        // Capitalize first letter
        const capitalizedDateStr = cleanDateStr.charAt(0).toUpperCase() + cleanDateStr.slice(1);
        return `${capitalizedDateStr} ${time}`;
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
"[project]/source/repos/vadkul/src/components/ui/EventCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EventCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/utils/dateUtils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$mapUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/utils/mapUtils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/utils/categories.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/map-pin.js [app-client] (ecmascript) <export default as MapPin>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/star.js [app-client] (ecmascript) <export default as Star>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/clock.js [app-client] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/arrow-right.js [app-client] (ecmascript) <export default as ArrowRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/AuthContext.tsx [app-client] (ecmascript)");
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
function EventCard({ event, compact = false }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    // --- DATA ---
    const category = __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"][event.type] || __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVENT_CATEGORIES"].other;
    const emoji = category.emoji;
    // Bild-logik (prioritera eventets bild, annars kategori-default)
    const rawCoverImage = event.coverImage || category.defaultImage;
    const coverImage = typeof rawCoverImage === 'string' ? rawCoverImage : rawCoverImage.src;
    // --- DISTANS BERÄKNING (NYTT) ---
    const [distance, setDistance] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(typeof event.location.distance === 'number' ? event.location.distance : null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EventCard.useEffect": ()=>{
            if (typeof event.location.distance === 'number') {
                setDistance(event.location.distance);
                return;
            }
            // Fallback: Räkna ut från localStorage
            const userLoc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$mapUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadLocationFromLocalStorage"])();
            if (userLoc && event.lat && event.lng) {
                setDistance((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$mapUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateDistance"])(userLoc.lat, userLoc.lng, event.lat, event.lng));
            }
        }
    }["EventCard.useEffect"], [
        event.lat,
        event.lng,
        event.location.distance
    ]);
    const formatDistance = (d)=>{
        if (d < 1) return `${Math.round(d * 1000)} m`;
        return `${d.toFixed(1)} km`;
    };
    // --- STATUS LOGIK ---
    const currentCount = event.attendees.length;
    const spotsLeft = event.maxParticipants - currentCount;
    const isFull = currentCount >= event.maxParticipants;
    const isGuaranteed = currentCount >= event.minParticipants;
    // --- DELTAGAR LOGIK ---
    const visibleAttendees = event.attendees.slice(0, 3);
    const hiddenCount = event.attendees.length - visibleAttendees.length;
    // --- LOADING STATE ---
    const [imageLoaded, setImageLoaded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        href: `/event/${event.id}`,
        className: "block h-full group relative",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative flex flex-col h-full transition-transform duration-300 hover:-translate-y-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)]",
            style: {
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))'
            },
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col h-full bg-card overflow-hidden rounded-xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `relative w-full bg-muted overflow-hidden ${compact ? 'h-20' : 'h-24'}`,
                        children: [
                            !imageLoaded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute inset-0 bg-muted animate-pulse z-10"
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 82,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                src: coverImage,
                                alt: event.title,
                                loading: "lazy",
                                decoding: "async",
                                onLoad: ()=>setImageLoaded(true),
                                className: `w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 86,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 transition-opacity duration-500 ${imageLoaded ? 'opacity-60' : 'opacity-0'}`
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 96,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-md backdrop-blur-md bg-white/90 text-slate-900 transition-all duration-500 delay-100 ${imageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-sm",
                                        children: emoji
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                        lineNumber: 100,
                                        columnNumber: 29
                                    }, this),
                                    category.label
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 99,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `absolute bottom-3 right-3 bg-white/90 backdrop-blur-md text-slate-900 font-bold px-2 py-1 rounded-lg text-xs shadow-sm flex flex-col items-center leading-tight transition-all duration-500 delay-100 ${imageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[9px] uppercase text-red-500",
                                        children: event.time.toLocaleDateString('sv-SE', {
                                            month: 'short'
                                        })
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                        lineNumber: 106,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-lg",
                                        children: event.time.getDate()
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                        lineNumber: 107,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 105,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                        lineNumber: 78,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `flex flex-col flex-1 ${compact ? 'p-3' : 'p-5'} pt-4`,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: `font-bold text-card-foreground leading-tight mb-3 group-hover:text-primary transition-colors line-clamp-2 ${compact ? 'text-base' : 'text-lg'}`,
                                children: event.title
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 115,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2 mb-5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-300",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: `p-1 rounded-md bg-slate-50 dark:bg-slate-700/50 ${category.iconColor}`,
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                                                    size: 14,
                                                    strokeWidth: 2.5
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                    lineNumber: 123,
                                                    columnNumber: 37
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                lineNumber: 122,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEventDate"])(event.time)
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                lineNumber: 125,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                        lineNumber: 121,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-300",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: `p-1 rounded-md bg-slate-50 dark:bg-slate-700/50 ${category.iconColor}`,
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__["MapPin"], {
                                                    size: 14,
                                                    strokeWidth: 2.5
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                    lineNumber: 130,
                                                    columnNumber: 37
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                lineNumber: 129,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between flex-1 min-w-0 gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-1 overflow-hidden",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "truncate",
                                                                children: event.location.name
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                lineNumber: 134,
                                                                columnNumber: 41
                                                            }, this),
                                                            distance !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "shrink-0 text-[10px] text-muted-foreground/80 font-normal",
                                                                children: [
                                                                    "• ",
                                                                    formatDistance(distance),
                                                                    " bort"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                lineNumber: 136,
                                                                columnNumber: 45
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                        lineNumber: 133,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "shrink-0",
                                                        children: isGuaranteed ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 rounded-md",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                                                                    size: 10,
                                                                    strokeWidth: 3
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 146,
                                                                    columnNumber: 49
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: "Blir av!"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 147,
                                                                    columnNumber: 49
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                            lineNumber: 145,
                                                            columnNumber: 45
                                                        }, this) : spotsLeft > 0 && (event.minParticipants - currentCount <= 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 rounded-md",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                                                                    size: 10,
                                                                    strokeWidth: 3
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 153,
                                                                    columnNumber: 57
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: "Blir av!"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 154,
                                                                    columnNumber: 57
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                            lineNumber: 152,
                                                            columnNumber: 53
                                                        }, this) : event.minParticipants - currentCount === 1 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300 px-2 py-0.5 rounded-md",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                                                                    size: 10,
                                                                    strokeWidth: 3
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 158,
                                                                    columnNumber: 57
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: "Söker 1 till!"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 159,
                                                                    columnNumber: 57
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                            lineNumber: 157,
                                                            columnNumber: 53
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 bg-orange-100 dark:bg-orange-500/20 dark:text-orange-300 px-2 py-0.5 rounded-md",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                                                                    size: 10,
                                                                    strokeWidth: 3
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 163,
                                                                    columnNumber: 57
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: [
                                                                        "Söker ",
                                                                        event.minParticipants - currentCount,
                                                                        " till"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 164,
                                                                    columnNumber: 57
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                            lineNumber: 162,
                                                            columnNumber: 53
                                                        }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                        lineNumber: 143,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                lineNumber: 132,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                        lineNumber: 128,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 120,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-auto border-t border-border pt-4 flex items-end justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col gap-1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider",
                                                children: "Värd"
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                lineNumber: 181,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                onClick: (e)=>{
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (event.host.uid) {
                                                        // Om det är jag själv som är värd, gå till min profil
                                                        if (user && user.uid === event.host.uid) {
                                                            router.push('/profile');
                                                        } else {
                                                            router.push(`/public-profile/${event.host.uid}`);
                                                        }
                                                    }
                                                },
                                                className: "flex items-center gap-2 cursor-pointer group/host",
                                                children: [
                                                    event.host.photoURL ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                        src: event.host.photoURL,
                                                        alt: event.host.name,
                                                        className: "w-6 h-6 rounded-full object-cover ring-1 ring-border"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                        lineNumber: 198,
                                                        columnNumber: 41
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground",
                                                        children: event.host.initials
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                        lineNumber: 200,
                                                        columnNumber: 41
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-xs font-semibold text-foreground group-hover/host:text-primary transition-colors",
                                                        children: event.host.name.split(' ')[0]
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                        lineNumber: 204,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center text-[10px] text-amber-500 bg-amber-500/15 dark:bg-amber-500/20 px-1 rounded",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"], {
                                                                size: 8,
                                                                fill: "currentColor",
                                                                className: "mr-0.5"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                lineNumber: 208,
                                                                columnNumber: 41
                                                            }, this),
                                                            event.host.rating.toFixed(1)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                        lineNumber: 207,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                lineNumber: 182,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                        lineNumber: 180,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col items-end gap-1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[10px] font-bold text-muted-foreground/70",
                                                children: isFull ? 'Fullbokat' : `${spotsLeft} platser kvar`
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                lineNumber: 216,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center pl-2 h-6",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex -space-x-2",
                                                    children: [
                                                        visibleAttendees.map((attendee, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "relative z-10 hover:z-20 transition-transform hover:scale-110",
                                                                children: attendee.photoURL ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                    src: attendee.photoURL,
                                                                    alt: attendee.displayName,
                                                                    className: "w-6 h-6 rounded-full object-cover ring-2 ring-card bg-muted",
                                                                    title: attendee.displayName
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 225,
                                                                    columnNumber: 53
                                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "w-6 h-6 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[9px] font-bold text-muted-foreground cursor-default",
                                                                    title: attendee.displayName,
                                                                    children: attendee.displayName?.charAt(0).toUpperCase() || '?'
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                    lineNumber: 232,
                                                                    columnNumber: 53
                                                                }, this)
                                                            }, i, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                                lineNumber: 223,
                                                                columnNumber: 45
                                                            }, this)),
                                                        hiddenCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "w-6 h-6 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[9px] font-bold text-muted-foreground z-0",
                                                            children: [
                                                                "+",
                                                                hiddenCount
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                            lineNumber: 243,
                                                            columnNumber: 45
                                                        }, this),
                                                        event.attendees.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-xs text-muted-foreground/60 italic pr-1",
                                                            children: "Bli först!"
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                            lineNumber: 249,
                                                            columnNumber: 45
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                    lineNumber: 221,
                                                    columnNumber: 37
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                                lineNumber: 220,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                        lineNumber: 215,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 177,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute bottom-4 right-4 z-50 opacity-0 group-hover:opacity-100 translate-x-3 group-hover:translate-x-0 transition-all duration-300",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__["ArrowRight"], {
                                    size: 20,
                                    className: "text-primary"
                                }, void 0, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                    lineNumber: 258,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                                lineNumber: 257,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                        lineNumber: 114,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
                lineNumber: 74,
                columnNumber: 17
            }, this)
        }, void 0, false, {
            fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
            lineNumber: 69,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/components/ui/EventCard.tsx",
        lineNumber: 68,
        columnNumber: 9
    }, this);
}
_s(EventCard, "7c0wpnF/ZcbaIqfQEyUO9OD5K7c=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = EventCard;
var _c;
__turbopack_context__.k.register(_c, "EventCard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RateUserModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/star.js [app-client] (ecmascript) <export default as Star>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-hot-toast/dist/index.mjs [app-client] (ecmascript)"); // Antar att vi använder denna
;
var _s = __turbopack_context__.k.signature();
;
;
;
function RateUserModal({ isOpen, onClose, onSubmit, targetName }) {
    _s();
    const [rating, setRating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [hoverRating, setHoverRating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [comment, setComment] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [isSubmitting, setIsSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    if (!isOpen) return null;
    const handleSubmit = async ()=>{
        if (rating === 0) return __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Välj ett betyg!");
        setIsSubmitting(true);
        try {
            await onSubmit(rating, comment);
            onClose();
        // Toast sköts troligen av föräldern eller här
        // Toast sköts av föräldern (PublicProfile)
        } catch (error) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Något gick fel.");
            console.error(error);
        } finally{
            setIsSubmitting(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative animate-in zoom-in-95 duration-200",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center relative",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                size: 20
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                                lineNumber: 47,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                            lineNumber: 43,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-xl font-bold mb-1",
                            children: "Betygsätt"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                            lineNumber: 49,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-white/90 text-sm",
                            children: targetName
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                            lineNumber: 50,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                    lineNumber: 42,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "p-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex justify-center gap-2 mb-6",
                            children: [
                                1,
                                2,
                                3,
                                4,
                                5
                            ].map((star)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    className: "transition-transform hover:scale-110 focus:outline-none",
                                    onMouseEnter: ()=>setHoverRating(star),
                                    onMouseLeave: ()=>setHoverRating(0),
                                    onClick: ()=>setRating(star),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"], {
                                        size: 36,
                                        className: `${(hoverRating || rating) >= star ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm' : 'text-slate-300 dark:text-slate-600'} transition-colors duration-200`
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                                        lineNumber: 65,
                                        columnNumber: 33
                                    }, this)
                                }, star, false, {
                                    fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                                    lineNumber: 57,
                                    columnNumber: 29
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                            lineNumber: 55,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                            value: comment,
                            onChange: (e)=>setComment(e.target.value),
                            placeholder: "Skriv en kommentar (frivilligt)...",
                            className: "w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 outline-none resize-none text-sm min-h-[100px] mb-4"
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                            lineNumber: 77,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: handleSubmit,
                            disabled: isSubmitting || rating === 0,
                            className: "w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/30",
                            children: isSubmitting ? 'Skickar...' : 'Skicka Omdöme'
                        }, void 0, false, {
                            fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                            lineNumber: 85,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
                    lineNumber: 53,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
            lineNumber: 39,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx",
        lineNumber: 38,
        columnNumber: 9
    }, this);
}
_s(RateUserModal, "7fTCOPTB6rjzmj0WxkPHOeay3uc=");
_c = RateUserModal;
var _c;
__turbopack_context__.k.register(_c, "RateUserModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/views/PublicProfile.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PublicProfile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// src/pages/PublicProfile.tsx
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageCircle$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/message-circle.js [app-client] (ecmascript) <export default as MessageCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/map-pin.js [app-client] (ecmascript) <export default as MapPin>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/calendar.js [app-client] (ecmascript) <export default as Calendar>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-client] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__UserPlus$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/user-plus.js [app-client] (ecmascript) <export default as UserPlus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flag$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Flag$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/flag.js [app-client] (ecmascript) <export default as Flag>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/star.js [app-client] (ecmascript) <export default as Star>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/log-out.js [app-client] (ecmascript) <export default as LogOut>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-hot-toast/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/layout/Layout.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/userService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/eventService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$friendService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/friendService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$Loading$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/ui/Loading.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$EventCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/ui/EventCard.tsx [app-client] (ecmascript)"); // Återanvänd EventCard!
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$profile$2f$RateUserModal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/profile/RateUserModal.tsx [app-client] (ecmascript)"); // Importera modalen
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
;
;
;
;
function PublicProfile() {
    _s();
    const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"])();
    const uid = params?.uid;
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { user: currentUser } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [profile, setProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    // --- NYA STATES FÖR EVENTS ---
    const [hostedEvents, setHostedEvents] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [joinedEvents, setJoinedEvents] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activeTab, setActiveTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('hosted');
    const [eventsLoading, setEventsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Sortering
    const [sortOption, setSortOption] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('created');
    // Friend / Rating State
    const [friendStatus, setFriendStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('none');
    const [isRateModalOpen, setIsRateModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [hasRated, setHasRated] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PublicProfile.useEffect": ()=>{
            async function load() {
                if (!uid) return;
                // Legacy check (behålls från tidigare kod)
                if (uid === 'legacy_user') {
                    setProfile({
                        uid: 'legacy_user',
                        displayName: 'Tidigare Användare',
                        email: '',
                        isVerified: false,
                        age: 0,
                        verificationImage: undefined,
                        createdAt: new Date()
                    });
                    setLoading(false);
                    return;
                }
                try {
                    const data = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["userService"].getUserProfile(uid);
                    if (data) {
                        setProfile(data);
                        // --- CHECK FRIEND STATUS & RATING (om inloggad) ---
                        if (currentUser && currentUser.uid !== uid) {
                            try {
                                const status = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$friendService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["friendService"].checkFriendStatus(currentUser.uid, uid);
                                setFriendStatus(status); // Type-cast om det behövs beroende på types
                                // Check if rated
                                const rated = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["userService"].hasUserReviewed(uid, currentUser.uid);
                                setHasRated(rated);
                            } catch (e) {
                                console.error("Failed to check status", e);
                            }
                        }
                        // --- LOAD HOSTED EVENTS (Alltid publika) ---
                        const hosted = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].getHostedEvents(uid);
                        setHostedEvents(hosted);
                    } else {
                        console.error("Ingen profil hittades för ID:", uid);
                    }
                } catch (error) {
                    console.error("Fel vid hämtning av profil:", error);
                } finally{
                    setLoading(false);
                }
            }
            load();
        }
    }["PublicProfile.useEffect"], [
        uid,
        currentUser
    ]);
    // --- LOAD JOINED EVENTS (Om vänner) ---
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PublicProfile.useEffect": ()=>{
            async function loadJoined() {
                if (activeTab === 'joined' && joinedEvents.length === 0 && profile && uid) {
                    // Endast om vän eller om det är jag själv (fast detta är public profile, så antagligen inte jag)
                    // Eller om logiken säger att joined events är publika? USER sa "om man är vänner ska man kunna se vilka den ska gå på"
                    // Så vi laddar bara om vänstatus är accepted.
                    if (friendStatus === 'accepted') {
                        setEventsLoading(true);
                        try {
                            const all = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].getAll();
                            const pEmail = profile.email || '';
                            const pUid = profile.uid;
                            const joined = all.filter({
                                "PublicProfile.useEffect.loadJoined.joined": (e)=>e.attendees.some({
                                        "PublicProfile.useEffect.loadJoined.joined": (a)=>a.email === pEmail || a.uid === pUid
                                    }["PublicProfile.useEffect.loadJoined.joined"]) && e.host.uid !== pUid
                            }["PublicProfile.useEffect.loadJoined.joined"]);
                            setJoinedEvents(joined);
                        } catch (err) {
                            console.error(err);
                        } finally{
                            setEventsLoading(false);
                        }
                    }
                }
            }
            loadJoined();
        }
    }["PublicProfile.useEffect"], [
        activeTab,
        friendStatus,
        profile,
        uid,
        joinedEvents.length
    ]);
    const startChat = ()=>{
        if (!currentUser) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Du måste logga in för att chatta.");
            return;
        }
        if (!profile) return;
        router.push(`/chat?uid=${profile.uid}`);
    };
    const handleFriendRequest = async ()=>{
        if (!currentUser || !profile) return;
        try {
            if (friendStatus === 'none') {
                await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$friendService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["friendService"].sendFriendRequest(currentUser.uid, profile.uid);
                setFriendStatus('pending');
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Vänförfrågan skickad!");
            }
        } catch (e) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Kunde inte hantera vänförfrågan");
        }
    };
    const handleAcceptFriend = async ()=>{
        if (!currentUser || !profile) return;
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$friendService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["friendService"].acceptFriendRequest(currentUser.uid, profile.uid);
            setFriendStatus('accepted');
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Ni är nu vänner!");
        } catch  {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Misslyckades.");
        }
    };
    const handleRateUser = async (rating, comment)=>{
        if (!currentUser || !profile || !currentUser.email) return;
        await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["userService"].addReview(profile.uid, {
            rating,
            comment,
            reviewer: {
                ...currentUser,
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || 'Anonym',
                age: 0,
                isVerified: false,
                createdAt: new Date(),
                photoURL: currentUser.photoURL || undefined
            }
        });
        // Uppdatera profilen för att visa nytt snittbetyg
        const updated = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$userService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["userService"].getUserProfile(profile.uid);
        if (updated) setProfile(updated);
        setHasRated(true);
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Tack för ditt betyg!");
    };
    if (loading) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$Loading$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            text: "Laddar profil..."
        }, void 0, false, {
            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
            lineNumber: 188,
            columnNumber: 33
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
        lineNumber: 188,
        columnNumber: 25
    }, this);
    if (!profile) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-10 text-center flex flex-col items-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-muted-foreground mb-4",
                    children: "Kunde inte hitta användaren."
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                    lineNumber: 193,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: ()=>router.back(),
                    className: "text-primary font-bold hover:underline",
                    children: "Gå tillbaka"
                }, void 0, false, {
                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                    lineNumber: 194,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
            lineNumber: 192,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
        lineNumber: 191,
        columnNumber: 9
    }, this);
    const isMe = currentUser?.uid === profile.uid; // Borde inte hända ofta på public profile men bra att ha
    const isLegacy = profile.uid === 'legacy_user';
    const initials = (profile.displayName || '??').substring(0, 2).toUpperCase();
    // Rating Display
    const ratingValue = profile.rating ? profile.rating.toFixed(1) : 'Ny';
    // Sort Logic
    const rawList = activeTab === 'hosted' ? hostedEvents : joinedEvents;
    const currentList = [
        ...rawList
    ].sort((a, b)=>{
        if (sortOption === 'created') {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA; // Nyast först
        } else {
            return new Date(a.time).getTime() - new Date(b.time).getTime(); // Snarast först
        }
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-4xl mx-auto p-4 md:p-8 pb-24",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>router.back(),
                        className: "flex items-center text-muted-foreground hover:text-primary mb-4 md:hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                                size: 20
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                lineNumber: 225,
                                columnNumber: 21
                            }, this),
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold ml-1",
                                children: "Tillbaka"
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                lineNumber: 225,
                                columnNumber: 45
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                        lineNumber: 224,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-card rounded-2xl shadow-xl overflow-hidden border border-border mb-8",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 relative",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative flex-shrink-0",
                                    children: [
                                        profile.photoURL ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                            src: profile.photoURL,
                                            alt: profile.displayName,
                                            className: "w-32 h-32 rounded-full border-4 border-background object-cover shadow-lg"
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 236,
                                            columnNumber: 33
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-32 h-32 rounded-full border-4 border-background bg-primary/20 flex items-center justify-center shadow-lg text-4xl font-extrabold text-primary",
                                            children: initials
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 242,
                                            columnNumber: 33
                                        }, this),
                                        profile.isVerified && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "absolute bottom-2 right-2 bg-background rounded-full p-1.5 shadow-sm",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                                                size: 24,
                                                className: "text-blue-500 fill-blue-50"
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 248,
                                                columnNumber: 37
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 247,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                    lineNumber: 234,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex-1 w-full",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col md:flex-row justify-between items-center md:items-start gap-4 mb-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                            className: "text-3xl font-black text-foreground mb-1",
                                                            children: profile.displayName
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 257,
                                                            columnNumber: 37
                                                        }, this),
                                                        profile.bio && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-muted-foreground text-sm md:text-base max-w-lg mx-auto md:mx-0 leading-relaxed mb-3",
                                                            children: profile.bio
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 262,
                                                            columnNumber: 41
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-muted-foreground",
                                                            children: [
                                                                profile.age > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: [
                                                                        profile.age,
                                                                        " år"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                    lineNumber: 268,
                                                                    columnNumber: 61
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"], {
                                                                            size: 14,
                                                                            fill: "currentColor"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                            lineNumber: 271,
                                                                            columnNumber: 45
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "font-bold",
                                                                            children: ratingValue
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                            lineNumber: 272,
                                                                            columnNumber: 45
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "opacity-70 text-xs font-normal",
                                                                            children: [
                                                                                "(",
                                                                                profile.ratingCount || 0,
                                                                                ")"
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                            lineNumber: 273,
                                                                            columnNumber: 45
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                    lineNumber: 270,
                                                                    columnNumber: 41
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-1.5",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__["MapPin"], {
                                                                            size: 14
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                            lineNumber: 277,
                                                                            columnNumber: 45
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: "Växjö"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                            lineNumber: 278,
                                                                            columnNumber: 45
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                    lineNumber: 276,
                                                                    columnNumber: 41
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-1.5",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__["Calendar"], {
                                                                            size: 14
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                            lineNumber: 281,
                                                                            columnNumber: 45
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: [
                                                                                "Medlem sedan ",
                                                                                profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Nyligen'
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                            lineNumber: 282,
                                                                            columnNumber: 45
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                    lineNumber: 280,
                                                                    columnNumber: 41
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 267,
                                                            columnNumber: 37
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 256,
                                                    columnNumber: 33
                                                }, this),
                                                !isMe && !isLegacy && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: handleReport,
                                                    className: "hidden md:block p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-full transition-colors self-start",
                                                    title: "Rapportera",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flag$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Flag$3e$__["Flag"], {
                                                        size: 20
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 290,
                                                        columnNumber: 41
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 289,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 255,
                                            columnNumber: 29
                                        }, this),
                                        !isMe && !isLegacy && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-2",
                                            children: [
                                                friendStatus === 'none' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: handleFriendRequest,
                                                    className: "flex-1 md:flex-none bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__UserPlus$3e$__["UserPlus"], {
                                                            size: 18
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 306,
                                                            columnNumber: 45
                                                        }, this),
                                                        " Lägg till vän"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 302,
                                                    columnNumber: 41
                                                }, this),
                                                friendStatus === 'pending' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    disabled: true,
                                                    className: "flex-1 md:flex-none bg-muted text-muted-foreground px-5 py-2.5 rounded-xl font-bold border border-border cursor-not-allowed flex items-center justify-center gap-2",
                                                    children: "Vänförfrågan skickad"
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 310,
                                                    columnNumber: 41
                                                }, this),
                                                friendStatus === 'incoming' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: handleAcceptFriend,
                                                    className: "flex-1 md:flex-none bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__UserPlus$3e$__["UserPlus"], {
                                                            size: 18
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 316,
                                                            columnNumber: 45
                                                        }, this),
                                                        " Acceptera vän"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 315,
                                                    columnNumber: 41
                                                }, this),
                                                friendStatus === 'accepted' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex-1 md:flex-none px-5 py-2.5 rounded-xl font-bold border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                                                            size: 18
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 321,
                                                            columnNumber: 45
                                                        }, this),
                                                        " Vänner"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 320,
                                                    columnNumber: 41
                                                }, this),
                                                hasRated ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    disabled: true,
                                                    className: "flex-1 md:flex-none bg-muted/50 text-amber-600/70 border border-amber-500/10 px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 cursor-default",
                                                    title: "Du har redan betygsatt",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"], {
                                                            size: 18,
                                                            fill: "currentColor"
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 328,
                                                            columnNumber: 45
                                                        }, this),
                                                        " Betygsatt"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 327,
                                                    columnNumber: 41
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: ()=>setIsRateModalOpen(true),
                                                    className: "flex-1 md:flex-none bg-card text-foreground border border-border hover:bg-muted px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"], {
                                                            size: 18
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 335,
                                                            columnNumber: 45
                                                        }, this),
                                                        " Betygsätt"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 331,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: startChat,
                                                    className: "flex-1 md:flex-none bg-secondary text-secondary-foreground hover:bg-secondary/80 px-5 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageCircle$3e$__["MessageCircle"], {
                                                            size: 18
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 344,
                                                            columnNumber: 41
                                                        }, this),
                                                        " Chatta"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 340,
                                                    columnNumber: 37
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: handleReport,
                                                    className: "md:hidden p-3 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition-colors",
                                                    title: "Rapportera",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flag$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Flag$3e$__["Flag"], {
                                                        size: 20,
                                                        className: "text-destructive/80"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 353,
                                                        columnNumber: 41
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                    lineNumber: 348,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 298,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                    lineNumber: 254,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                            lineNumber: 231,
                            columnNumber: 21
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                        lineNumber: 229,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative",
                        children: [
                            !currentUser && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute inset-0 z-10 flex flex-col items-center justify-start pt-32 bg-background/60 backdrop-blur-sm rounded-xl border border-white/20",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "bg-card p-8 rounded-2xl shadow-2xl border border-border max-w-md text-center transform hover:scale-105 transition-transform duration-300",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary animate-pulse",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__UserPlus$3e$__["UserPlus"], {
                                                size: 32
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 371,
                                                columnNumber: 37
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 370,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "text-2xl font-bold mb-2",
                                            children: [
                                                "Nyfiken på ",
                                                profile.displayName,
                                                "?"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 373,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-muted-foreground mb-6",
                                            children: [
                                                "Logga in för att se vilka events ",
                                                profile.displayName,
                                                " ska gå på, vilka vänner hen har och mycket mer!"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 374,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col gap-3",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>router.push('/login'),
                                                className: "w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:bg-primary/90 transition-colors",
                                                children: "Logga in / Skapa konto"
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 378,
                                                columnNumber: 37
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                            lineNumber: 377,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                    lineNumber: 369,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                lineNumber: 368,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: !currentUser ? 'filter blur-md pointer-events-none select-none opacity-50' : '',
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "border-b border-border",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex mb-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: ()=>setActiveTab('hosted'),
                                                        className: `pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2
                                        ${activeTab === 'hosted' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}
                                    `,
                                                        children: [
                                                            "Arrangerar",
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "bg-muted px-2 py-0.5 rounded-full text-xs text-muted-foreground",
                                                                children: hostedEvents.length
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                lineNumber: 402,
                                                                columnNumber: 37
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 395,
                                                        columnNumber: 33
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: ()=>setActiveTab('joined'),
                                                        className: `pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2
                                        ${activeTab === 'joined' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}
                                    `,
                                                        children: [
                                                            "Ska gå på",
                                                            friendStatus === 'accepted' && joinedEvents.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "bg-muted px-2 py-0.5 rounded-full text-xs text-muted-foreground",
                                                                children: joinedEvents.length
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                lineNumber: 412,
                                                                columnNumber: 41
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 404,
                                                        columnNumber: 33
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 394,
                                                columnNumber: 29
                                            }, this),
                                            currentList.length > 0 && (activeTab === 'hosted' || friendStatus === 'accepted') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "p-2 flex justify-end gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "text-xs font-semibold text-muted-foreground self-center mr-1",
                                                        children: "Sortera:"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 420,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex bg-card rounded-lg p-1 border border-border shadow-sm",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>setSortOption('created'),
                                                                className: `px-3 py-1 rounded-md text-xs font-medium transition-all
                                                    ${sortOption === 'created' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}
                                                `,
                                                                children: "Senast tillagd"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                lineNumber: 422,
                                                                columnNumber: 41
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>setSortOption('time'),
                                                                className: `px-3 py-1 rounded-md text-xs font-medium transition-all
                                                    ${sortOption === 'time' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}
                                                `,
                                                                children: "Tid kvar"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                                lineNumber: 430,
                                                                columnNumber: 41
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 421,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 419,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                        lineNumber: 393,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "min-h-[200px] mt-6",
                                        children: [
                                            activeTab === 'hosted' && (currentList.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2",
                                                children: currentList.map((evt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-full",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$EventCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                            event: evt,
                                                            compact: false
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 453,
                                                            columnNumber: 49
                                                        }, this)
                                                    }, evt.id, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 452,
                                                        columnNumber: 45
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 450,
                                                columnNumber: 37
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl",
                                                children: "Ingen events skapade just nu."
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 458,
                                                columnNumber: 37
                                            }, this)),
                                            activeTab === 'joined' && (friendStatus === 'accepted' ? eventsLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$Loading$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                text: "Hämtar..."
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 468,
                                                columnNumber: 41
                                            }, this) : currentList.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2",
                                                children: currentList.map((evt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-full",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$ui$2f$EventCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                            event: evt,
                                                            compact: false
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 474,
                                                            columnNumber: 57
                                                        }, this)
                                                    }, evt.id, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 473,
                                                        columnNumber: 53
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 471,
                                                columnNumber: 45
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl",
                                                children: [
                                                    profile.displayName,
                                                    " ska inte gå på något just nu."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 479,
                                                columnNumber: 45
                                            }, this) : // PRIVATE CONTENT
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-center py-16 bg-card rounded-2xl border border-dashed border-border flex flex-col items-center",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__["LogOut"], {
                                                            size: 24
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                            lineNumber: 488,
                                                            columnNumber: 45
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 487,
                                                        columnNumber: 41
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-lg font-bold mb-2",
                                                        children: "Detta är privat"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 490,
                                                        columnNumber: 41
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-muted-foreground max-w-xs mx-auto mb-6",
                                                        children: [
                                                            "Du måste vara vän med ",
                                                            profile.displayName,
                                                            " för att se vilka events de ska gå på."
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 491,
                                                        columnNumber: 41
                                                    }, this),
                                                    friendStatus === 'none' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: handleFriendRequest,
                                                        className: "text-primary font-bold hover:underline",
                                                        children: "Skicka vänförfrågan"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                        lineNumber: 495,
                                                        columnNumber: 45
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                                lineNumber: 486,
                                                columnNumber: 37
                                            }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                        lineNumber: 445,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                                lineNumber: 390,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                        lineNumber: 364,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                lineNumber: 222,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$profile$2f$RateUserModal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                isOpen: isRateModalOpen,
                onClose: ()=>setIsRateModalOpen(false),
                onSubmit: handleRateUser,
                targetName: profile.displayName
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
                lineNumber: 513,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/source/repos/vadkul/src/views/PublicProfile.tsx",
        lineNumber: 221,
        columnNumber: 9
    }, this);
    //TURBOPACK unreachable
    ;
    // Helper för rapport (om det inte fanns definierat)
    function handleReport() {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])('Rapportera funktion ej implementerad ännu', {
            icon: '⚠️'
        });
    }
}
_s(PublicProfile, "OPrPrLIxTZ0rey6s444kedID040=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = PublicProfile;
var _c;
__turbopack_context__.k.register(_c, "PublicProfile");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/views/PublicProfile.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/source/repos/vadkul/src/views/PublicProfile.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=source_repos_vadkul_src_fbd07857._.js.map