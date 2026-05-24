"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventExistsInDb = eventExistsInDb;
exports.addEventToDb = addEventToDb;
const admin = __importStar(require("firebase-admin"));
// Initialize in case it hasn't been (though it should be in index.ts)
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
async function eventExistsInDb(url) {
    const snapshot = await db.collection('linkEvents').where('url', '==', url).get();
    return !snapshot.empty;
}
async function addEventToDb(eventData) {
    try {
        if (await eventExistsInDb(eventData.url)) {
            console.log(`Event already exists: ${eventData.title}`);
            return;
        }
        await db.collection('linkEvents').add(eventData);
        console.log(`Successfully added to DB: ${eventData.title}`);
    }
    catch (error) {
        console.error('Failed to add event to DB:', error);
    }
}
//# sourceMappingURL=dbHelper.js.map