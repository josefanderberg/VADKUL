(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/source/repos/vadkul/src/services/eventService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "eventService",
    ()=>eventService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$geofire$2d$common$2f$dist$2f$geofire$2d$common$2f$geofire$2d$common$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/geofire-common/dist/geofire-common/geofire-common.min.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
;
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
    // Hämta events inom en radie (Geo-querying)
    async getEventsInBounds (center, radiusInMeters) {
        try {
            const bounds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$geofire$2d$common$2f$dist$2f$geofire$2d$common$2f$geofire$2d$common$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["geohashQueryBounds"])(center, radiusInMeters);
            const promises = [];
            const now = new Date(); // Filter only future events
            for (const b of bounds){
                const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["orderBy"])('geohash'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startAt"])(b[0]), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["endAt"])(b[1]));
                promises.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q));
            }
            const snapshots = await Promise.all(promises);
            const matchingDocs = [];
            const seenIds = new Set();
            for (const snap of snapshots){
                for (const doc of snap.docs){
                    if (seenIds.has(doc.id)) continue;
                    const data = doc.data();
                    // 1. Client-side Time Filter (Future events only)
                    const eventTime = data.time instanceof __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"] ? data.time.toDate() : new Date(data.time);
                    if (eventTime < now) continue;
                    // 2. Client-side Distance Filter
                    // Lat/Lng are required for distance calc
                    const lat = data.lat;
                    const lng = data.lng;
                    if (!lat || !lng) continue;
                    const distanceInKm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$geofire$2d$common$2f$dist$2f$geofire$2d$common$2f$geofire$2d$common$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["distanceBetween"])([
                        lat,
                        lng
                    ], center);
                    const distanceInM = distanceInKm * 1000;
                    if (distanceInM <= radiusInMeters) {
                        seenIds.add(doc.id);
                        matchingDocs.push({
                            ...data,
                            id: doc.id,
                            time: eventTime,
                            createdAt: data.createdAt instanceof __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"] ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt || 0) : undefined
                        });
                    }
                }
            }
            return matchingDocs;
        } catch (error) {
            console.error("Error fetching events in bounds:", error);
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
        const hash = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$geofire$2d$common$2f$dist$2f$geofire$2d$common$2f$geofire$2d$common$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["geohashForLocation"])([
            event.lat,
            event.lng
        ]);
        const payload = {
            ...event,
            views: 0,
            geohash: hash,
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
        // Recalculate geohash if lat/lng changed (always calculating to be safe)
        const hash = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$geofire$2d$common$2f$dist$2f$geofire$2d$common$2f$geofire$2d$common$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["geohashForLocation"])([
            event.lat,
            event.lng
        ]);
        // Sanitize data: Remove undefined fields and convert Dates to Timestamps
        const payload = {
            ...data,
            geohash: hash
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
    },
    // Migrera events för att lägga till geohash
    async migrateEventsToGeo () {
        try {
            const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION));
            console.log(`Checking ${snap.size} events for missing geohash...`);
            let updated = 0;
            const updates = snap.docs.map(async (docSnap)=>{
                const data = docSnap.data();
                // Om geohash saknas men lat/lng finns
                if (!data.geohash && data.lat && data.lng) {
                    const hash = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$geofire$2d$common$2f$dist$2f$geofire$2d$common$2f$geofire$2d$common$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["geohashForLocation"])([
                        data.lat,
                        data.lng
                    ]);
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION, docSnap.id), {
                        geohash: hash
                    });
                    updated++;
                }
            });
            await Promise.all(updates);
            return updated;
        } catch (error) {
            console.error("Migration failed:", error);
            throw error;
        }
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
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
    // Lös in kod (Via Cloud Function för säkerhet)
    async redeemCode (uid, code) {
        try {
            const { httpsCallable } = await __turbopack_context__.A("[project]/source/repos/vadkul/node_modules/firebase/functions/dist/esm/index.esm.js [app-client] (ecmascript, async loader)");
            const { functions } = await __turbopack_context__.A("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript, async loader)");
            const redeemFn = httpsCallable(functions, 'redeemCode');
            const result = await redeemFn({
                code
            });
            return result.data;
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
"[project]/source/repos/vadkul/src/services/feedbackService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "feedbackService",
    ()=>feedbackService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
;
;
const feedbackService = {
    async getRecentFeedback (limitCount = 5) {
        try {
            const feedbackRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'feedback');
            const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])(feedbackRef, (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["orderBy"])('createdAt', 'desc'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["limit"])(limitCount));
            const querySnapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
            return querySnapshot.docs.map((doc)=>({
                    id: doc.id,
                    ...doc.data()
                }));
        } catch (error) {
            console.error("Error fetching feedback:", error);
            return [];
        }
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/services/settingsService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "settingsService",
    ()=>settingsService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
;
;
const SETTINGS_DOC_ID = 'global';
const COLLECTION_NAME = 'settings';
const settingsService = {
    // Get settings once (with cache)
    async getGlobalSettings () {
        // 1. Try cache first for speed
        try {
            const cached = localStorage.getItem('vadkul_settings_global');
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
        // Ignore storage error
        }
        // 2. Fetch fresh
        try {
            const docRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION_NAME, SETTINGS_DOC_ID);
            const docSnap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDoc"])(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                localStorage.setItem('vadkul_settings_global', JSON.stringify(data));
                return data;
            } else {
                return {
                    showHallOfFame: true
                };
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
            return {
                showHallOfFame: true
            };
        }
    },
    // Update settings
    async updateGlobalSettings (settings) {
        const docRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION_NAME, SETTINGS_DOC_ID);
        // Optimistic update of cache
        const currentCache = localStorage.getItem('vadkul_settings_global');
        if (currentCache) {
            const parsed = JSON.parse(currentCache);
            localStorage.setItem('vadkul_settings_global', JSON.stringify({
                ...parsed,
                ...settings
            }));
        }
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setDoc"])(docRef, settings, {
            merge: true
        });
    },
    // Subscribe to settings changes
    subscribe (callback) {
        const docRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], COLLECTION_NAME, SETTINGS_DOC_ID);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["onSnapshot"])(docRef, (docSnap)=>{
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Update cache
                localStorage.setItem('vadkul_settings_global', JSON.stringify(data));
                callback(data);
            } else {
                callback({
                    showHallOfFame: true
                });
            }
        }, (error)=>{
            console.warn("Settings listener failed (permissions?):", error);
            // Try to fallback to cache if listener fails
            const cached = localStorage.getItem('vadkul_settings_global');
            if (cached) {
                callback(JSON.parse(cached));
            } else {
                callback({
                    showHallOfFame: true
                });
            }
        });
    },
    // Synchronous getter for initial state
    getCachedSettings () {
        try {
            const cached = localStorage.getItem('vadkul_settings_global');
            return cached ? JSON.parse(cached) : null;
        } catch  {
            return null;
        }
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/views/AdminDashboard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AdminDashboard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/lib/firebase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/eventService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AdminContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/context/AdminContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/components/layout/Layout.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/utils/categories.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/notificationService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XCircle$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/circle-x.js [app-client] (ecmascript) <export default as XCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/shield-alert.js [app-client] (ecmascript) <export default as ShieldAlert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/message-square.js [app-client] (ecmascript) <export default as MessageSquare>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flag$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Flag$3e$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/lucide-react/dist/esm/icons/flag.js [app-client] (ecmascript) <export default as Flag>");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$feedbackService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/feedbackService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$settingsService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/services/settingsService.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/react-hot-toast/dist/index.mjs [app-client] (ecmascript)");
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
;
// --- KONFIGURATION & KONSTANTER ---
const VAXJO_AREAS = [
    {
        name: 'Växjö',
        lat: 56.87767,
        lng: 14.80906
    },
    {
        name: 'Växjö Campus',
        lat: 56.8550,
        lng: 14.8300
    },
    {
        name: 'Alvesta',
        lat: 56.8994,
        lng: 14.5556
    },
    {
        name: 'Gemla',
        lat: 56.8667,
        lng: 14.6500
    },
    {
        name: 'Rottne',
        lat: 57.0271,
        lng: 14.9080
    },
    {
        name: 'Ingelstad',
        lat: 56.7444,
        lng: 14.9333
    },
    {
        name: 'Braås',
        lat: 57.0667,
        lng: 15.0500
    },
    {
        name: 'Hovmantorp',
        lat: 56.7833,
        lng: 15.1500
    },
    {
        name: 'Åryd',
        lat: 56.8333,
        lng: 14.9667
    },
    {
        name: 'Vederslöv',
        lat: 56.8200,
        lng: 14.7300
    },
    {
        name: 'Tävelsås',
        lat: 56.7800,
        lng: 14.8100
    },
    {
        name: 'Lammhult',
        lat: 57.1700,
        lng: 14.5800
    },
    {
        name: 'Växjö Landsbygd',
        lat: 56.9000,
        lng: 14.7500
    },
    {
        name: 'Furuby',
        lat: 56.8600,
        lng: 14.9500
    },
    {
        name: 'Kalvsvik',
        lat: 56.7200,
        lng: 14.7200
    } // Rural
];
// Hjälpfunktion för slumpad position runt Växjö
// Hjälpfunktion för slumpad position runt Växjö
const getRandomLocationAroundVaxjo = (index)=>{
    // Om index skickas med, rotera genom listan för jämn spridning. Annars slumpa.
    const area = typeof index === 'number' ? VAXJO_AREAS[index % VAXJO_AREAS.length] : VAXJO_AREAS[Math.floor(Math.random() * VAXJO_AREAS.length)];
    // Ökad spridning (ca 5-6 km) för mer "ute på landet" känsla
    const latOffset = (Math.random() - 0.5) * 0.08;
    const lngOffset = (Math.random() - 0.5) * 0.08;
    return {
        lat: area.lat + latOffset,
        lng: area.lng + lngOffset,
        cityName: area.name
    };
};
// NY HJÄLPFUNKTION: Slumpa en eventkategori
const getRandomCategory = ()=>{
    const randomIndex = Math.floor(Math.random() * __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CATEGORY_LIST"].length);
    return __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$utils$2f$categories$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CATEGORY_LIST"][randomIndex].id;
};
function AdminDashboard() {
    _s();
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const { isAdmin, enableAdmin, disableAdmin } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AdminContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAdmin"])();
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [log, setLog] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [users, setUsers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    // Verification State
    const [pendingVerifications, setPendingVerifications] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [rejectReason, setRejectReason] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [rejectingId, setRejectingId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Feedback State
    const [feedback, setFeedback] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [reports, setReports] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    // Pagination for user list
    const [visibleCount, setVisibleCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(5);
    // State för varningsmeddelande
    const [selectedUserId, setSelectedUserId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [warningMessage, setWarningMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    // Settings State
    const [showHallOfFame, setShowHallOfFame] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    // Hämta användare vid start (för dropdown-listan)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AdminDashboard.useEffect": ()=>{
            const fetchUsers = {
                "AdminDashboard.useEffect.fetchUsers": async ()=>{
                    try {
                        const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users'));
                        const userList = snap.docs.map({
                            "AdminDashboard.useEffect.fetchUsers.userList": (d)=>({
                                    uid: d.id,
                                    ...d.data()
                                })
                        }["AdminDashboard.useEffect.fetchUsers.userList"]);
                        setUsers(userList);
                        // Filter pending verifications
                        const pending = userList.filter({
                            "AdminDashboard.useEffect.fetchUsers.pending": (u)=>u.verificationStatus === 'pending'
                        }["AdminDashboard.useEffect.fetchUsers.pending"]);
                        setPendingVerifications(pending);
                        if (userList.length > 0) setSelectedUserId(userList[0].uid);
                    } catch (e) {
                        addLog("Kunde inte hämta användarlistan.");
                    }
                }
            }["AdminDashboard.useEffect.fetchUsers"];
            const fetchFeedback = {
                "AdminDashboard.useEffect.fetchFeedback": async ()=>{
                    const data = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$feedbackService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["feedbackService"].getRecentFeedback(5);
                    setFeedback(data);
                }
            }["AdminDashboard.useEffect.fetchFeedback"];
            const fetchReports = {
                "AdminDashboard.useEffect.fetchReports": async ()=>{
                    try {
                        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'reports'), (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["where"])('status', '==', 'pending'));
                        const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
                        setReports(snap.docs.map({
                            "AdminDashboard.useEffect.fetchReports": (d)=>({
                                    id: d.id,
                                    ...d.data()
                                })
                        }["AdminDashboard.useEffect.fetchReports"]));
                    } catch (e) {
                        console.error(e);
                    }
                }
            }["AdminDashboard.useEffect.fetchReports"];
            const fetchSettings = {
                "AdminDashboard.useEffect.fetchSettings": async ()=>{
                    const settings = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$settingsService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["settingsService"].getGlobalSettings();
                    setShowHallOfFame(settings.showHallOfFame);
                }
            }["AdminDashboard.useEffect.fetchSettings"];
            fetchUsers();
            fetchFeedback();
            fetchSettings();
            if (isAdmin) fetchReports();
        }
    }["AdminDashboard.useEffect"], [
        loading,
        isAdmin
    ]); // Reload when loading finishes or admin status changes
    const addLog = (msg)=>setLog((prev)=>[
                `[${new Date().toLocaleTimeString()}] ${msg}`,
                ...prev
            ]);
    const handleToggleHallOfFame = async ()=>{
        const newValue = !showHallOfFame;
        setShowHallOfFame(newValue);
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$settingsService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["settingsService"].updateGlobalSettings({
                showHallOfFame: newValue
            });
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success(`Hall of Fame är nu ${newValue ? 'PÅ' : 'AV'}`);
        } catch (error) {
            console.error(error);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Kunde inte spara inställning.");
            setShowHallOfFame(!newValue); // Revert
        }
    };
    // ---------------------------------------------------------
    // FUNKTION 1: SKAPA RANDOM EVENTS (SEED)
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // FUNKTION: TA BORT ALLA EVENTS
    // ---------------------------------------------------------
    const handleDeleteAllEvents = async ()=>{
        if (!confirm("VARNING: Detta tar bort ALLA events permanent. Vill du fortsätta?")) return;
        if (!confirm("Är du verkligen helt säker? Det går inte att ångra.")) return;
        setLoading(true);
        setLog([]);
        addLog("🗑️ Startar radering av alla events...");
        try {
            const snapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'events'));
            const total = snapshot.size;
            if (total === 0) {
                addLog("✅ Inga events att ta bort.");
                setLoading(false);
                return;
            }
            addLog(`Hittade ${total} events. Raderar...`);
            let count = 0;
            // Firestore batch limit is 500
            const docs = snapshot.docs;
            // Vi måste köra flera batcher om det är > 500
            // Här gör vi det enkelt och kör en-och-en via promise.all eller seriemässigt om det är säkrare, 
            // men för prestanda är batch bäst. Låt oss köra uppdelade batcher.
            for(let i = 0; i < docs.length; i += 400){
                const chunk = docs.slice(i, i + 400);
                const currentBatch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
                chunk.forEach((doc)=>{
                    currentBatch.delete(doc.ref);
                });
                await currentBatch.commit();
                count += chunk.length;
                addLog(`🗑️ Raderat batch ${Math.ceil(count / 400)} (${count} / ${total})...`);
            }
            addLog(`✅ Alla ${count} events har raderats.`);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Alla events raderade.");
            // Clear cache
            sessionStorage.removeItem('vadkul_events_cache');
            sessionStorage.removeItem('vadkul_events_cache_time');
        } catch (error) {
            addLog(`❌ Fel vid radering: ${error.message}`);
            console.error(error);
        } finally{
            setLoading(false);
        }
    };
    // ---------------------------------------------------------
    // FUNKTION 1: SKAPA RANDOM EVENTS (SEED)
    // ---------------------------------------------------------
    const handleMigrateGeohash = async ()=>{
        if (!confirm("Vill du uppdatera alla events med geohash?")) return;
        setLoading(true);
        addLog("🌍 Startar migrering av geohash...");
        try {
            const count = await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$eventService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eventService"].migrateEventsToGeo();
            addLog(`✅ Migrering klar! ${count} events uppdaterades.`);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success(`Uppdaterade ${count} events!`);
        } catch (e) {
            addLog(`❌ Fel: ${e.message}`);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Migrering misslyckades.");
        } finally{
            setLoading(false);
        }
    };
    const handleSeedEvents = async (count)=>{
        if (!confirm(`Är du säker på att du vill skapa ${count} nya events?`)) return;
        setLoading(true);
        setLog([]); // Rensa logg
        addLog(`🚀 Startar generering av ${count} events...`);
        try {
            if (users.length === 0) throw new Error("Inga användare hittades att använda som hosts.");
            // UPDATED CATEGORY EXAMPLES TO MATCH ids in categories.ts
            const MOCKED_TEMPLATES = {
                study: [
                    {
                        title: "Tenta-P i biblioteket",
                        desc: "Vi sitter hela dagen. Kom och plugga med oss för motivation."
                    },
                    {
                        title: "Språkcafé: Engelska",
                        desc: "Öva din engelska över en kopp kaffe. Alla nivåer välkomna."
                    },
                    {
                        title: "Grupparbete & Pizza",
                        desc: "Vi pluggar effektivt i 2 timmar, sen beställer vi pizza."
                    },
                    {
                        title: "Lär dig koda React",
                        desc: "Enkel intro för nybörjare. Ta med laptop!"
                    },
                    {
                        title: "Matte-stuga inför tentan",
                        desc: "Vi hjälps åt att räkna gamla tentor. Kaffe ingår."
                    },
                    {
                        title: "Uppsats-skrivande (Shut up & Write)",
                        desc: "45 min skrivande, 15 min paus. Upprepa."
                    },
                    {
                        title: "Bokcirkel: Kurslitteratur",
                        desc: "Vi diskuterar veckans läsning så det fastnar bättre."
                    }
                ],
                party: [
                    {
                        title: "Förfest innan kåren",
                        desc: "Vi ses och värmer upp inför kvällens släpp. Ta med egen dryck."
                    },
                    {
                        title: "Spontan hemmafest",
                        desc: "Öppet hus! Kom och häng, lyssna på musik och träffa folk."
                    },
                    {
                        title: "Utgång ikväll?",
                        desc: "Någon som är taggad på dansgolvet? Vi möts upp på torget."
                    },
                    {
                        title: "Pubkväll på nationen",
                        desc: "Billig öl och hamburgare. Kom och häng med oss!"
                    },
                    {
                        title: "Sittning: Tema 80-tal",
                        desc: "Vi har några biljetter över till sittningen. Först till kvarn!"
                    },
                    {
                        title: "Korridorsfest hos mig",
                        desc: "Trångt, varmt och sjukt kul. Alla får plats!"
                    },
                    {
                        title: "Karaokekväll på puben",
                        desc: "Vem vågar sjunga först? Vi bjuder på första rundan."
                    },
                    {
                        title: "Takfest (om vädret tillåter)",
                        desc: "Fantastisk utsikt och gott sällskap. Ta med filt."
                    }
                ],
                social: [
                    {
                        title: "Söndagsfika",
                        desc: "Kaffe och bulle på stans mysigaste café. Kom och snacka skit."
                    },
                    {
                        title: "Lunch på stan",
                        desc: "Vi testar det nya stället på hörnet. De har bra vegatariskt!"
                    },
                    {
                        title: "Afternoon Tea",
                        desc: "Lite lyxigare fika. Vi har bokat bord för 6 pers."
                    },
                    {
                        title: "After Work med branschen",
                        desc: "Mingel för oss som jobbar inom IT/Tech."
                    },
                    {
                        title: "Mingelkväll för nyinflyttade",
                        desc: "Ny i stan? Kom och lär känna folk!"
                    },
                    {
                        title: "Hundpromenad & Kaffe",
                        desc: "Ta med vovven (eller kom utan) så går vi en sväng."
                    },
                    {
                        title: "Glass i hamnen",
                        desc: "Bästa glassbaren har öppnat för säsongen. Häng med!"
                    }
                ],
                food: [
                    {
                        title: "Hemlagad Pizza-kväll",
                        desc: "Jag gör degen, ni tar med topping. Blir sjukt gott!"
                    },
                    {
                        title: "Knytkalas i parken",
                        desc: "Alla tar med sig en rätt var att bjuda på."
                    },
                    {
                        title: "Sushi-workshop",
                        desc: "Vi lär oss rulla sushi. Ingredienser köps in gemensamt."
                    },
                    {
                        title: "Korvgrillning vid sjön",
                        desc: "Vi tänder grillen kl 18. Ta med det du vill grilla."
                    },
                    {
                        title: "Kårfrukost",
                        desc: "Gratis frukost för medlemmar. Vi ses i kårhuset."
                    },
                    {
                        title: "Taco Tuesday",
                        desc: "Klassisk tacokväll. Guacamolen är 'on me'."
                    },
                    {
                        title: "Pannkaksbrunch",
                        desc: "Amerikanska pannkakor med lönnsirap och bär."
                    }
                ],
                market: [
                    {
                        title: "Klädbytardag",
                        desc: "Ta med plagg du inte använder, byt till dig nya favoriter."
                    },
                    {
                        title: "Bakluckeloppis",
                        desc: "Vi delar på en plats. Samling 09:00."
                    },
                    {
                        title: "Säljer kurslitteratur",
                        desc: "Möts upp för att köpa/sälja gamla böcker."
                    },
                    {
                        title: "Växtstickling-byte",
                        desc: "Har du för många Palettblad? Byt till dig en Monstera!"
                    }
                ],
                community: [
                    {
                        title: "Hjälp med flytt?",
                        desc: "Bjuder på pizza och öl till den som kan bära lite lådor."
                    },
                    {
                        title: "Städdag i parken",
                        desc: "Vi hjälps åt att snygga till i parken. Fika bjuds det på!"
                    },
                    {
                        title: "Volontärmöte",
                        desc: "Vill du engagera dig? Kom och lyssna på vad vi gör."
                    },
                    {
                        title: "Kattvakts-träff",
                        desc: "Vi som gillar katter ses och pratar."
                    },
                    {
                        title: "Fixar-kväll i cykelrummet",
                        desc: "Lär dig laga punka och smörja kedjan."
                    }
                ],
                creative: [
                    {
                        title: "Måla och skåla",
                        desc: "Vi målar akvarell och dricker lite bubbel. Material finns."
                    },
                    {
                        title: "Stickjunta",
                        desc: "Ta med din stickning/virkning. Vi fikar och handarbetar ihop."
                    },
                    {
                        title: "Kreativt skrivande",
                        desc: "Vi gör skrivövningar tillsammans. Penna och papper räcker."
                    },
                    {
                        title: "Fotokurs: Grunderna",
                        desc: "Lär dig din systemkamera. Vi går igenom ISO och slutartid."
                    },
                    {
                        title: "Impro-teater workshop",
                        desc: "Prova på teater! Inga förkunskaper krävs, bara glatt humör."
                    },
                    {
                        title: "Jam-session (Musik)",
                        desc: "Ta med instrument. Vi kör lite covers och improviserar."
                    }
                ],
                sport: [
                    {
                        title: "Fotbollsmatch 5-mot-5",
                        desc: "Vi behöver folk till en vänskapsmatch. Vi delar upp lagen på plats."
                    },
                    {
                        title: "Volleyboll på stranden",
                        desc: "Spontan volleyboll i solen. Vi har boll och nät."
                    },
                    {
                        title: "Padel-turnering (Amerikano)",
                        desc: "Vi kör en spontan Americano. Alla nivåer välkomna!"
                    },
                    {
                        title: "Brännboll med klassen",
                        desc: "Klassisk brännboll i parken. Ta med dryck!"
                    },
                    {
                        title: "Basket skills & game",
                        desc: "Vi tränar lite teknik och spelar match sen."
                    },
                    {
                        title: "Badminton i hallen",
                        desc: "Vi har bokat två banor. Racket finns att hyra."
                    }
                ],
                training: [
                    {
                        title: "Morgonjogg 5km",
                        desc: "Lugnt tempo, vi håller ihop gruppen. Startar vid utegymmet."
                    },
                    {
                        title: "Yoga i solnedgången",
                        desc: "Ta med egen matta. Vi kör ett pass för alla nivåer."
                    },
                    {
                        title: "Utomhusträning stationer",
                        desc: "Jag tar med redskap, vi kör cirkelträning i parken."
                    },
                    {
                        title: "Intervaller i backen",
                        desc: "Jobbigt men effektivt! Vi kör 10 vändor."
                    },
                    {
                        title: "Långpass Löpning (10km+)",
                        desc: "För dig som vill springa lite längre i prattempo."
                    }
                ],
                game: [
                    {
                        title: "LAN-party hela helgen",
                        desc: "Ta med burken och skärm. Vi har plats och nätverk."
                    },
                    {
                        title: "Mario Kart-turnering",
                        desc: "Vem är bäst på Rainbow Road? Pris till vinnaren!"
                    },
                    {
                        title: "CS:GO Matchkväll",
                        desc: "Vi behöver en femte spelare till vårt lag. Rank spelar ingen roll."
                    },
                    {
                        title: "Super Smash Bros Ultimate",
                        desc: "Vi kör turnering på storbildsskärm. Kontroller finns."
                    }
                ],
                boardgame: [
                    {
                        title: "Spelkväll: Catan & Ticket to Ride",
                        desc: "Klassiska brädspel. Vi förklarar reglerna."
                    },
                    {
                        title: "Dungeons & Dragons One-shot",
                        desc: "Ett äventyr på en kväll. Karaktärer finns färdiga."
                    },
                    {
                        title: "Schack-turnering",
                        desc: "Snabbschack 10 minuter. Alla möter alla."
                    },
                    {
                        title: "Komplexa Brädspel (Twilight Imperium)",
                        desc: "För dig som gillar tunga strategispel. Tar hela dagen!"
                    },
                    {
                        title: "Kortspel & Poker",
                        desc: "Vi spelar Texas Hold'em (utan riktiga pengar såklart)."
                    }
                ],
                play: [
                    {
                        title: "Kubb i parken",
                        desc: "Kom och spela kubb! Alla är välkomna, vi kör så länge vi orkar."
                    },
                    {
                        title: "Vattenkrig - Alla mot alla",
                        desc: "Ta med vattenpistol så kör vi! Samling vid fontänen."
                    },
                    {
                        title: "Kurragömma Extreme",
                        desc: "Kurragömma över hela campusområdet. Kom i oömma kläder."
                    },
                    {
                        title: "Tipspromenad",
                        desc: "Gå en runda och svara på kluriga frågor. Prisutdelning efteråt."
                    }
                ],
                outdoor: [
                    {
                        title: "Vandring i naturreservatet",
                        desc: "Ca 1 mil i lugnt tempo. Ta med matsäck."
                    },
                    {
                        title: "Fiske-tur",
                        desc: "Vi drar ut med båt och kastar lite. Flytvästar finns."
                    },
                    {
                        title: "Upptäcktsfärd i skogen",
                        desc: "Vi letar svamp och bara njuter av naturen."
                    },
                    {
                        title: "Grilla korv vid vindskyddet",
                        desc: "Mysig kväll vid elden. Ta med varma kläder."
                    },
                    {
                        title: "Kajakpaddling",
                        desc: "Vi hyr kajaker och paddlar en tur i ån."
                    }
                ],
                movie: [
                    {
                        title: "Bio: Nya Marvel-filmen",
                        desc: "Vi har bokat mittenplatserna. Häng med!"
                    },
                    {
                        title: "Filmkväll: Sagan om Ringen",
                        desc: "Maraton (Extended edition) hemma hos mig. Popcorn ingår."
                    },
                    {
                        title: "Utomhusbio i parken",
                        desc: "Ta med filt och stol. Filmen startar vid mörkrets inbrott."
                    },
                    {
                        title: "Skräckfilmskväll",
                        desc: "Vågar du? Vi kollar på klassiker och äter snacks."
                    }
                ],
                culture: [
                    {
                        title: "Konstutställning vernissage",
                        desc: "Vi går och kollar in den nya utställningen tillsammans."
                    },
                    {
                        title: "Livejazz på puben",
                        desc: "Lokalt band spelar ikväll. Skön stämning utlovas."
                    },
                    {
                        title: "Teaterbesök",
                        desc: "Vi ser den nya uppsättningen på stadsteatern."
                    },
                    {
                        title: "Museum: Gratis inträde",
                        desc: "Vi passar på när det är fri entré. Guidad tur kl 14."
                    }
                ],
                workshop: [
                    {
                        title: "Keramik-kurs",
                        desc: "Prova på att dreja! Lera ingår i priset."
                    },
                    {
                        title: "Lär dig dansa salsa",
                        desc: "Nybörjarkurs. Ingen partner krävs."
                    },
                    {
                        title: "Kryddväxt-plantering",
                        desc: "Plantera basilika och chili. Krukor och jord finns."
                    }
                ],
                campus: [
                    {
                        title: "Pubkväll på nationen",
                        desc: "Vi drar dit när de öppnar. Billig öl och gött häng."
                    },
                    {
                        title: "Kårtrappan-häng",
                        desc: "Vi sitter i solen på trappan och dricker kaffe."
                    },
                    {
                        title: "Campus-orientering",
                        desc: "Hitta rätt på campus. Bra för dig som är ny!"
                    }
                ],
                mingle: [
                    {
                        title: "Nätverksfrukost",
                        desc: "Träffa andra studenter och företagare. Frukost ingår."
                    },
                    {
                        title: "After School Mingle",
                        desc: "Vi ses efter föreläsningen och snackar."
                    },
                    {
                        title: "Speed-friending",
                        desc: "Lär känna 10 nya personer på en timme!"
                    }
                ],
                other: [
                    {
                        title: "Diskussionskväll: Klimat",
                        desc: "Hur kan vi leva mer hållbart? Öppen diskussion."
                    },
                    {
                        title: "Överrasknings-event",
                        desc: "Hemlig aktivitet! Samling vid statyn."
                    },
                    {
                        title: "Loppisrunda på stan",
                        desc: "Vi går runt till alla second hand-butiker."
                    }
                ]
            };
            let successCount = 0;
            let lastEventData = null;
            for(let i = 0; i < count; i++){
                const randomUser = users[Math.floor(Math.random() * users.length)];
                const location = getRandomLocationAroundVaxjo();
                const category = getRandomCategory(); // Hämta slumpmässig kategori (e.g. 'sport', 'social')
                // Look up templates properly
                // If exact match exists, user it. Else use 'other'.
                const templates = MOCKED_TEMPLATES[category] || MOCKED_TEMPLATES.other;
                const template = templates[Math.floor(Math.random() * templates.length)];
                const now = new Date();
                const futureDate = new Date();
                futureDate.setDate(now.getDate() + Math.floor(Math.random() * 60)); // 0-60 dagar framåt
                futureDate.setHours(10 + Math.floor(Math.random() * 12), 0, 0);
                const minPart = 2; // Minst 2 deltagare
                const maxPart = 5 + Math.floor(Math.random() * 20); // Som tidigare
                const eventData = {
                    title: template.title,
                    description: template.desc,
                    time: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(futureDate),
                    lat: location.lat,
                    lng: location.lng,
                    location: {
                        name: `Genererad plats, ${location.cityName}`,
                        distance: Math.floor(Math.random() * 5)
                    },
                    // Använd den slumpmässiga kategorin
                    type: category,
                    price: Math.floor(Math.random() * 10) === 0 ? 0 : 50 + Math.floor(Math.random() * 150),
                    minParticipants: minPart,
                    maxParticipants: maxPart,
                    minAge: 18,
                    maxAge: 99,
                    ageCategory: '18+',
                    host: {
                        uid: randomUser.uid,
                        email: randomUser.email || 'unknown@test.com',
                        displayName: randomUser.displayName || 'Anonym',
                        name: randomUser.displayName || 'Anonym Testare',
                        initials: randomUser.displayName ? randomUser.displayName.charAt(0).toUpperCase() : 'A',
                        verified: randomUser.isVerified || false,
                        rating: randomUser.rating || 3 + Math.random() * 2,
                        photoURL: randomUser.photoURL || `https://i.pravatar.cc/150?u=${randomUser.uid}`
                    },
                    attendees: [],
                    createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
                };
                lastEventData = eventData;
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'events'), eventData);
                successCount++;
                if (successCount % 10 === 0) addLog(`...skapat ${successCount} av ${count}`);
            }
            addLog(`✅ Klart! ${successCount} events skapades.`);
            // LOGGA FEILDS FÖR EN EVENT
            if (lastEventData) {
                addLog("--------------- SAMPLE EVENT ---------------");
                addLog(JSON.stringify(lastEventData, null, 2));
                // Also log keys clearly
                addLog("FIELDS: " + Object.keys(lastEventData).join(", "));
                addLog("--------------------------------------------");
            }
        } catch (error) {
            addLog(`❌ Fel: ${error.message}`);
        } finally{
            setLoading(false);
        }
    };
    // ---------------------------------------------------------
    // FUNKTION 2: SYNKA HOST BILDER
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // FUNKTION 2: SYNKA HOST BILDER
    // ---------------------------------------------------------
    const handleSyncHostImages = async ()=>{
        if (!confirm("Vill du uppdatera alla events med värdens nuvarande profilbild? Detta kan ta en stund.")) return;
        setLoading(true);
        addLog(`🔄 Startar synkronisering av profilbilder...`);
        try {
            // 1. Hämta alla events
            const eventsSnap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'events'));
            const events = eventsSnap.docs;
            addLog(`Hittade ${events.length} events.`);
            let updateCount = 0;
            let batchCount = 0;
            let currentBatch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
            let operationsInBatch = 0;
            const MAX_BATCH_SIZE = 400; // Firestore limit is 500, keeping safety margin
            // 2. Loopa och kolla mot users
            for (const docSnap of events){
                const eventData = docSnap.data();
                const hostUid = eventData.host?.uid;
                if (hostUid) {
                    const hostUser = users.find((u)=>u.uid === hostUid);
                    if (hostUser) {
                        // Använd 'photoURL' från user, ELLER null om det saknas.
                        const correctPhoto = hostUser.photoURL || null;
                        const currentEventPhoto = eventData.host.photoURL || null;
                        if (correctPhoto !== currentEventPhoto) {
                            const eventRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'events', docSnap.id);
                            currentBatch.update(eventRef, {
                                "host.photoURL": correctPhoto,
                                "host.name": hostUser.displayName || eventData.host.name,
                                "host.verified": hostUser.isVerified || false
                            });
                            updateCount++;
                            operationsInBatch++;
                            // Commit batch if full
                            if (operationsInBatch >= MAX_BATCH_SIZE) {
                                await currentBatch.commit();
                                batchCount++;
                                addLog(`💾 Sparade batch ${batchCount} (${operationsInBatch} ändringar)...`);
                                currentBatch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]); // Start new batch
                                operationsInBatch = 0;
                            }
                        }
                    }
                }
            }
            // Commit remaining operations
            if (operationsInBatch > 0) {
                await currentBatch.commit();
                batchCount++;
                addLog(`💾 Sparade sista batchen (${operationsInBatch} ändringar).`);
            }
            if (updateCount > 0) {
                addLog(`✅ KLART! Uppdaterade totalt ${updateCount} events.`);
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success(`Synkade ${updateCount} events!`);
            } else {
                addLog(`✅ Alla events är redan synkade.`);
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Allt är redan synkat!");
            }
        } catch (error) {
            console.error("Sync Error:", error);
            addLog(`❌ Svarar servern med fel? Kontrollera dina rättigheter.`);
            addLog(`❌ Felmeddelande: ${error.message}`);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Kunde inte synka. Se loggen för detaljer.");
        } finally{
            setLoading(false);
        }
    };
    // ---------------------------------------------------------
    // FUNKTION [NEW]: BLI ADMIN
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // FUNKTION [NEW]: BLI ADMIN / TA BORT ADMIN
    // ---------------------------------------------------------
    const handleToggleAdmin = async ()=>{
        if (!user) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Du måste vara inloggad först.");
            return;
        }
        const action = isAdmin ? "ta bort dina admin-rättigheter" : "ge dig själv admin-rättigheter";
        if (!confirm(`Vill du ${action}?`)) return;
        setLoading(true);
        const newStatus = !isAdmin;
        try {
            const userRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', user.uid);
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])(userRef, {
                isAdmin: newStatus
            });
            if (newStatus) {
                enableAdmin();
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Du är nu admin! 👑");
                addLog(`👑 ${user.email} aktiverade admin-läge.`);
            } else {
                disableAdmin();
                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Admin-läge avaktiverat.");
                addLog(`👤 ${user.email} avaktiverade admin-läge.`);
            }
        } catch (error) {
            addLog(`❌ Fel: ${error.message}`);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Kunde inte uppdatera rättigheter.");
        } finally{
            setLoading(false);
        }
    };
    // ---------------------------------------------------------
    // FUNKTION 3: VARNA ANVÄNDARE
    // ---------------------------------------------------------
    const handleSendWarning = async (e)=>{
        e.preventDefault();
        if (!selectedUserId || !warningMessage) return;
        setLoading(true);
        addLog(`📨 Skickar varning till användare ID: ${selectedUserId}...`);
        try {
            // Alternativ 1: Om du har en 'notifications' collection
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'notifications'), {
                userId: selectedUserId,
                message: warningMessage,
                type: 'warning',
                read: false,
                createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
            });
            // Alternativ 2: Om du vill spara direkt på user-objektet (avkommentera om du föredrar det)
            /*
      const userRef = doc(db, 'users', selectedUserId);
      await updateDoc(userRef, {
         lastWarning: warningMessage,
         warningCount: increment(1)
      });
      */ addLog(`✅ Varning skickad: "${warningMessage}"`);
            setWarningMessage(''); // Rensa input
        } catch (error) {
            addLog(`❌ Kunde inte skicka varning: ${error.message}`);
        } finally{
            setLoading(false);
        }
    };
    // ---------------------------------------------------------
    // FUNKTION 4: HANTERA VERIFIERINGAR
    // ---------------------------------------------------------
    const handleAcceptVerification = async (user)=>{
        if (!confirm(`Godkänn verifiering för ${user.displayName}?`)) return;
        setLoading(true);
        // Check if duplicate click / already processed
        if (user.verificationStatus === 'verified') {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Användaren är redan verifierad.");
            setLoading(false);
            return;
        }
        addLog(`🔍 Godkänner verifiering för ${user.displayName}...`);
        try {
            const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
            const userRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', user.uid);
            // 1. Update User
            batch.update(userRef, {
                isVerified: true,
                verificationStatus: 'verified'
            });
            // 2. Send Notification
            await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["notificationService"].send({
                recipientId: user.uid,
                type: 'system',
                message: 'Din identitet har verifierats! Du har nu en verifierad profil.',
                read: false,
                createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now() // Will be addressed by service logic but added here for clarity if needed
            });
            await batch.commit();
            addLog(`✅ ${user.displayName} är nu verifierad!`);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success(`${user.displayName} verifierad!`);
        } catch (error) {
            addLog(`❌ Fel vid godkännande: ${error.message}`);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Något gick fel");
        } finally{
            setLoading(false);
        }
    };
    const handleDenyVerification = async (userId)=>{
        if (!rejectReason) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Ange en anledning!");
            return;
        }
        setLoading(true);
        addLog(`🚫 Nekar verifiering för ID: ${userId}...`);
        try {
            const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
            const userRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', userId);
            batch.update(userRef, {
                isVerified: false,
                verificationStatus: 'rejected',
                rejectionReason: rejectReason
            });
            // Send Notification
            await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["notificationService"].send({
                recipientId: userId,
                type: 'system',
                message: `Din verifiering nekades. Anledning: ${rejectReason}`,
                read: false,
                createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
            });
            await batch.commit();
            addLog(`✅ Verifiering nekad.`);
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Verifiering nekad.");
            setRejectingId(null);
            setRejectReason('');
        } catch (error) {
            addLog(`❌ Fel vid nekande: ${error.message}`);
        } finally{
            setLoading(false);
        }
    };
    const handleDismissReport = async (reportId)=>{
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'reports', reportId), {
                status: 'resolved'
            });
            setReports((prev)=>prev.filter((r)=>r.id !== reportId));
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Rapport avfärdad.");
        } catch (e) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Kunde inte avfärda.");
        }
    };
    const handleDeleteReportedEvent = async (reportId, eventId)=>{
        if (!confirm("Vill du ta bort eventet och stänga rapporten?")) return;
        try {
            // Delete event
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deleteDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'events', eventId));
            // Resolve report
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'reports', reportId), {
                status: 'resolved',
                resolution: 'event_deleted'
            });
            setReports((prev)=>prev.filter((r)=>r.id !== reportId));
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Event borttaget och rapport stängd.");
        } catch (e) {
            __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Kunde inte ta bort eventet.");
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$components$2f$layout$2f$Layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen bg-slate-50 p-6",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-6xl mx-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                        className: "mb-8",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-3xl font-bold text-slate-900",
                                children: "Admin Dashboard"
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                lineNumber: 744,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-slate-500",
                                children: "Hantera testdata och användare"
                            }, void 0, false, {
                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                lineNumber: 745,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                        lineNumber: 743,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 lg:grid-cols-2 gap-8",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-6",
                                children: [
                                    reports.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-white p-6 rounded-xl shadow-sm border border-red-100 ring-4 ring-red-50",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl font-bold mb-4 text-red-900 flex items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flag$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Flag$3e$__["Flag"], {
                                                        className: "text-red-600"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 757,
                                                        columnNumber: 21
                                                    }, this),
                                                    "Rapporterade Events (",
                                                    reports.length,
                                                    ")"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 756,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-4",
                                                children: reports.map((report)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "border border-red-200 rounded-lg p-4 bg-red-50/50",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex flex-col gap-2 mb-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "font-bold text-red-900",
                                                                        children: report.eventTitle
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 764,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-sm text-red-800",
                                                                        children: [
                                                                            'Anledning: "',
                                                                            report.reason,
                                                                            '"'
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 765,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-xs text-red-600 flex gap-2",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: [
                                                                                    "Rapporterad av: ",
                                                                                    report.reporterEmail || 'Anonym'
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 767,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: "•"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 768,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: report.createdAt?.toDate().toLocaleDateString()
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 769,
                                                                                columnNumber: 29
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 766,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 763,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex gap-2",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                                        href: `/event/${report.eventId}`,
                                                                        target: "_blank",
                                                                        rel: "noreferrer",
                                                                        className: "flex-1 py-2 bg-white text-slate-700 font-bold rounded-lg text-sm border border-slate-300 hover:bg-slate-50 flex items-center justify-center",
                                                                        children: "Visa Event"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 773,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: ()=>handleDismissReport(report.id),
                                                                        className: "flex-1 py-2 bg-white text-slate-700 font-bold rounded-lg text-sm border border-slate-300 hover:bg-slate-50",
                                                                        children: "Avfärda"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 776,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: ()=>handleDeleteReportedEvent(report.id, report.eventId),
                                                                        className: "flex-1 py-2 bg-red-600 text-white font-bold rounded-lg text-sm hover:bg-red-700",
                                                                        children: "Ta bort"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 782,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 772,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, report.id, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 762,
                                                        columnNumber: 23
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 760,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 755,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-white p-6 rounded-xl shadow-sm border border-purple-100 ring-4 ring-purple-50",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl font-bold mb-4 text-purple-900 flex items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"], {
                                                        className: "text-purple-600"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 798,
                                                        columnNumber: 19
                                                    }, this),
                                                    "Senaste Feedback"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 797,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-4",
                                                children: feedback.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-muted-foreground italic",
                                                    children: "Ingen feedback än."
                                                }, void 0, false, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                    lineNumber: 803,
                                                    columnNumber: 21
                                                }, this) : feedback.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "border border-purple-100 rounded-lg p-4 bg-purple-50/50",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex justify-between items-start mb-2",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center gap-1",
                                                                        children: [
                                                                            ...Array(5)
                                                                        ].map((_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: `text-sm ${i < item.rating ? 'text-yellow-400' : 'text-gray-300'}`,
                                                                                children: "★"
                                                                            }, i, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 810,
                                                                                columnNumber: 31
                                                                            }, this))
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 808,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "text-xs text-muted-foreground",
                                                                        children: item.createdAt?.toDate().toLocaleDateString()
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 813,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 807,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-sm text-slate-800 italic",
                                                                children: [
                                                                    '"',
                                                                    item.message,
                                                                    '"'
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 817,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, item.id, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 806,
                                                        columnNumber: 23
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 801,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 796,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl font-bold mb-4 text-slate-800 flex items-center gap-2",
                                                children: "Inställningar"
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 826,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "font-bold text-slate-900",
                                                                children: "Visa Hall of Fame på startsidan"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 831,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-sm text-slate-500",
                                                                children: 'Om avstängd döljs "Månadens Event"-kortet.'
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 832,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 830,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: handleToggleHallOfFame,
                                                        className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${showHallOfFame ? 'bg-green-500' : 'bg-slate-300'}`,
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showHallOfFame ? 'translate-x-6' : 'translate-x-1'}`
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                            lineNumber: 838,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 834,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 829,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 825,
                                        columnNumber: 15
                                    }, this),
                                    pendingVerifications.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-white p-6 rounded-xl shadow-sm border border-indigo-100 ring-4 ring-indigo-50",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl font-bold mb-4 text-indigo-900 flex items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__["ShieldAlert"], {
                                                        className: "text-indigo-600"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 847,
                                                        columnNumber: 21
                                                    }, this),
                                                    "Verifieringsförfrågningar (",
                                                    pendingVerifications.length,
                                                    ")"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 846,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-4",
                                                children: pendingVerifications.map((u)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "border border-slate-200 rounded-lg p-4 bg-slate-50",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex items-start gap-4 mb-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "w-16 h-16 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0 border border-slate-300",
                                                                        children: u.verificationImage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                                            href: u.verificationImage,
                                                                            target: "_blank",
                                                                            rel: "noreferrer",
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                src: u.verificationImage,
                                                                                alt: "Verif",
                                                                                className: "w-full h-full object-cover"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 857,
                                                                                columnNumber: 33
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                            lineNumber: 856,
                                                                            columnNumber: 31
                                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "w-full h-full flex items-center justify-center text-slate-400",
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                                                                size: 24
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 861,
                                                                                columnNumber: 33
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                            lineNumber: 860,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 854,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex-1 min-w-0",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                className: "font-bold text-slate-900 truncate",
                                                                                children: u.displayName || 'Utan namn'
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 866,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                className: "text-xs text-slate-500 truncate",
                                                                                children: u.email
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 867,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                className: "text-xs text-slate-500 mt-1",
                                                                                children: [
                                                                                    "Ålder: ",
                                                                                    u.age || '?'
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 868,
                                                                                columnNumber: 29
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 865,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 853,
                                                                columnNumber: 25
                                                            }, this),
                                                            rejectingId === u.uid ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "bg-red-50 p-3 rounded-lg border border-red-100",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                        className: "text-xs font-bold text-red-700 block mb-1",
                                                                        children: "Anledning till nekande:"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 874,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                                        value: rejectReason,
                                                                        onChange: (e)=>setRejectReason(e.target.value),
                                                                        className: "w-full p-2 text-sm border border-red-200 rounded mb-2",
                                                                        placeholder: "T.ex. Bilden är för mörk..."
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 875,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex gap-2",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                onClick: ()=>handleDenyVerification(u.uid),
                                                                                className: "px-3 py-1 bg-red-600 text-white text-sm font-bold rounded hover:bg-red-700",
                                                                                children: "Neka"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 882,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                onClick: ()=>setRejectingId(null),
                                                                                className: "px-3 py-1 bg-slate-200 text-slate-700 text-sm font-bold rounded hover:bg-slate-300",
                                                                                children: "Avbryt"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 883,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 881,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 873,
                                                                columnNumber: 27
                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex gap-2",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: ()=>handleAcceptVerification(u),
                                                                        className: "flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm hover:bg-emerald-700 flex items-center justify-center gap-1",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                                                                                size: 16
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 892,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            " Godkänn"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 888,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: ()=>{
                                                                            setRejectingId(u.uid);
                                                                            setRejectReason('');
                                                                        },
                                                                        className: "flex-1 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg text-sm hover:bg-red-50 flex items-center justify-center gap-1",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XCircle$3e$__["XCircle"], {
                                                                                size: 16
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                                lineNumber: 898,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            " Neka"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 894,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 887,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, u.uid, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 852,
                                                        columnNumber: 23
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 850,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 845,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl font-semibold mb-4 text-green-700",
                                                children: "🌱 Testdata & Fixar"
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 910,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-sm text-slate-600 mb-4",
                                                        children: "Hantera testdata och rensa databasen."
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 912,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex gap-3",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>handleSeedEvents(40),
                                                                disabled: loading,
                                                                className: "flex-1 bg-green-100 text-green-800 py-2 px-4 rounded-lg font-medium hover:bg-green-200 transition disabled:opacity-50",
                                                                children: "+40 Events"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 918,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>handleSeedEvents(100),
                                                                disabled: loading,
                                                                className: "flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50",
                                                                children: "+100 Events"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 925,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 917,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("hr", {
                                                        className: "border-slate-100 my-2"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 934,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-100",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-xs font-bold text-slate-500 uppercase",
                                                                children: "Verktyg"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 938,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: handleMigrateGeohash,
                                                                disabled: loading,
                                                                className: "w-full bg-white text-indigo-700 border border-indigo-200 py-2 px-4 rounded-lg font-bold hover:bg-indigo-50 transition disabled:opacity-50 flex items-center justify-center gap-2",
                                                                children: "🌍 Fixa Geohashes (Kartan)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 940,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 937,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("hr", {
                                                        className: "border-slate-100 my-2"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 949,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: handleDeleteAllEvents,
                                                        disabled: loading,
                                                        className: "w-full bg-red-50 text-red-600 border border-red-200 py-2 px-4 rounded-lg font-bold hover:bg-red-100 transition disabled:opacity-50 flex items-center justify-center gap-2",
                                                        children: "🗑️ Radera ALLA events"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 951,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 911,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 909,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl font-semibold mb-4 text-blue-800",
                                                children: "🛠️ Underhåll"
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 963,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-sm text-slate-600 mb-4",
                                                        children: "Uppdatera alla events så att värdens bild matchar deras nuvarande profilbild (användbart om bilder ändrats eller saknas)."
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 965,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: handleSyncHostImages,
                                                        disabled: loading,
                                                        className: "w-full bg-blue-100 text-blue-800 py-2 px-4 rounded-lg font-medium hover:bg-blue-200 transition disabled:opacity-50 flex items-center justify-center gap-2 mb-2",
                                                        children: "🔄 Synka Profilbilder"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 968,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: handleToggleAdmin,
                                                        disabled: loading,
                                                        className: `w-full py-2 px-4 rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2
                        ${isAdmin ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}`,
                                                        children: isAdmin ? '👤 Avaktivera Admin-läge' : '👑 Bli Admin (Lös rättighetsproblem)'
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 976,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 964,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 962,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl font-semibold mb-4 text-slate-800",
                                                children: "📢 Skicka Varning"
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 992,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                                onSubmit: handleSendWarning,
                                                className: "space-y-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                className: "block text-sm font-medium text-slate-700 mb-1",
                                                                children: "Välj användare"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 995,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                                className: "w-full p-2 border border-slate-300 rounded-lg text-sm",
                                                                value: selectedUserId,
                                                                onChange: (e)=>setSelectedUserId(e.target.value),
                                                                children: users.map((u)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                        value: u.uid,
                                                                        children: [
                                                                            u.displayName || u.email,
                                                                            " (",
                                                                            u.uid.substring(0, 5),
                                                                            "...)"
                                                                        ]
                                                                    }, u.uid, true, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1002,
                                                                        columnNumber: 25
                                                                    }, this))
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 996,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 994,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                className: "block text-sm font-medium text-slate-700 mb-1",
                                                                children: "Meddelande"
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 1010,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "text",
                                                                className: "w-full p-2 border border-slate-300 rounded-lg",
                                                                placeholder: "T.ex. Vänligen följ våra regler...",
                                                                value: warningMessage,
                                                                onChange: (e)=>setWarningMessage(e.target.value)
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 1011,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 1009,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "submit",
                                                        disabled: loading || !warningMessage,
                                                        className: "w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50",
                                                        children: "Skicka Meddelande"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 1020,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 993,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 991,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                lineNumber: 751,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-6",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-[300px]",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "bg-slate-900 rounded-xl p-4 h-full flex flex-col shadow-lg",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex justify-between items-center border-b border-slate-700 pb-2 mb-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-green-400 font-mono font-bold",
                                                            children: "System Terminal"
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                            lineNumber: 1039,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-slate-500 text-xs",
                                                            children: loading ? 'ARBETAR...' : 'VÄNTAR'
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                            lineNumber: 1040,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                    lineNumber: 1038,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex-1 overflow-y-auto font-mono text-xs md:text-sm space-y-1 pr-2",
                                                    children: [
                                                        log.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-slate-600 italic",
                                                            children: "Ingen aktivitet än..."
                                                        }, void 0, false, {
                                                            fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                            lineNumber: 1043,
                                                            columnNumber: 42
                                                        }, this),
                                                        log.map((entry, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-green-300 border-l-2 border-slate-700 pl-2",
                                                                children: entry
                                                            }, i, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 1045,
                                                                columnNumber: 23
                                                            }, this))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                    lineNumber: 1042,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                            lineNumber: 1037,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 1036,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl font-bold mb-4 text-slate-800 flex items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                                        className: "text-slate-600"
                                                    }, void 0, false, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 1056,
                                                        columnNumber: 19
                                                    }, this),
                                                    "Alla Användare (",
                                                    users.length,
                                                    ")"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 1055,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-3",
                                                children: users.slice(0, visibleCount).map((u)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-col md:flex-row items-center gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50 transition-colors hover:bg-slate-100",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "w-16 h-16 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0 border border-slate-300 shadow-sm relative group",
                                                                children: u.verificationImage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                                    href: u.verificationImage,
                                                                    target: "_blank",
                                                                    rel: "noreferrer",
                                                                    className: "block w-full h-full",
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                        src: u.verificationImage,
                                                                        alt: "Verif",
                                                                        className: "w-full h-full object-cover transition-transform group-hover:scale-110"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1067,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                    lineNumber: 1066,
                                                                    columnNumber: 27
                                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "w-full h-full flex items-center justify-center text-slate-400",
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                                                        size: 24
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1071,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                    lineNumber: 1070,
                                                                    columnNumber: 27
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 1064,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex-1 min-w-0 text-center md:text-left",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "font-bold text-slate-900 truncate",
                                                                        children: u.displayName || 'John Doe'
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1077,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-xs text-slate-500 truncate",
                                                                        children: u.email
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1078,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-[10px] text-slate-400 font-mono mt-0.5",
                                                                        children: [
                                                                            "ID: ",
                                                                            u.uid.substring(0, 6),
                                                                            "..."
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1079,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 1076,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex items-center gap-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: `text-xs font-bold px-3 py-1 rounded-full ${u.isVerified ? 'bg-green-100 text-green-700 border border-green-200' : u.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-200 text-slate-500'}`,
                                                                        children: u.isVerified ? 'Verifierad' : u.verificationStatus === 'pending' ? 'Väntar' : 'Ej verifierad'
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1083,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    u.isVerified ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: async ()=>{
                                                                            const reason = prompt(`Vill du återkalla verifieringen för ${u.displayName}? Ange anledning:`, "Verifiering återkallad av admin.");
                                                                            if (!reason) return; // Cancelled
                                                                            setLoading(true);
                                                                            try {
                                                                                const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
                                                                                // 1. Update User to Rejected (so they can upload new)
                                                                                const userRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', u.uid);
                                                                                batch.update(userRef, {
                                                                                    isVerified: false,
                                                                                    verificationStatus: 'rejected',
                                                                                    rejectionReason: reason
                                                                                });
                                                                                // 2. Send Notification
                                                                                await __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$services$2f$notificationService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["notificationService"].send({
                                                                                    recipientId: u.uid,
                                                                                    type: 'system',
                                                                                    message: `Din verifiering har återkallats. Anledning: ${reason}. Du kan ladda upp en ny bild under Inställningar.`,
                                                                                    read: false,
                                                                                    createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Timestamp"].now()
                                                                                });
                                                                                await batch.commit();
                                                                                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Verifiering återkallad.");
                                                                                addLog(`Revoked verification for ${u.displayName}`);
                                                                                // Trigger fetch to update list & UI
                                                                                const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users'));
                                                                                setUsers(snap.docs.map((d)=>({
                                                                                        uid: d.id,
                                                                                        ...d.data()
                                                                                    })));
                                                                            } catch (e) {
                                                                                console.error(e);
                                                                                __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Kunde inte återkalla.");
                                                                            }
                                                                            setLoading(false);
                                                                        },
                                                                        className: "text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded-lg font-bold hover:bg-red-50 transition-colors",
                                                                        children: "Återkalla"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1090,
                                                                        columnNumber: 27
                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "w-20"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                        lineNumber: 1134,
                                                                        columnNumber: 30
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                                lineNumber: 1082,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, u.uid, true, {
                                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                        lineNumber: 1061,
                                                        columnNumber: 21
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 1059,
                                                columnNumber: 17
                                            }, this),
                                            visibleCount < users.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>setVisibleCount((prev)=>prev + 5),
                                                className: "w-full mt-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm",
                                                children: [
                                                    "Visa fler (",
                                                    users.length - visibleCount,
                                                    " kvar)"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                                lineNumber: 1142,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                        lineNumber: 1054,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                                lineNumber: 1033,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                        lineNumber: 748,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
                lineNumber: 741,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
            lineNumber: 740,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/views/AdminDashboard.tsx",
        lineNumber: 739,
        columnNumber: 5
    }, this);
}
_s(AdminDashboard, "5bSfU615T9AOJm4Q+gpcIgnRpVc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"],
        __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$context$2f$AdminContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAdmin"]
    ];
});
_c = AdminDashboard;
var _c;
__turbopack_context__.k.register(_c, "AdminDashboard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/source/repos/vadkul/src/views/AdminDashboard.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/source/repos/vadkul/src/views/AdminDashboard.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=source_repos_vadkul_src_82b64ac9._.js.map