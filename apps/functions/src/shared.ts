/**
 * Delat fundament för alla Cloud Functions-moduler: admin-SDK:t initieras
 * EN gång här, och alla moduler hämtar db + region härifrån. Var index.ts
 * topp t.o.m. fas 0-styckningen (se docs/app-plattform-plan.md §5).
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();

export const db = admin.firestore();

// Sätt region till europa för lägre latency (matcha klienten)
// Använd 'europe-west1' (Belgien) typiskt för Firebase projekt i europa om inget annat valts
export const region = functions.region('europe-west1');

/**
 * Skrapade event har källans URL som id (url är primärnyckeln i hela
 * pipelinen); linkEvents-dokument har Firestore-id:n, som aldrig kan
 * innehålla snedstreck. Snedstrecket skiljer alltså spåren åt.
 * (Bodde i boost-sektionen; delas av boost + reminders sedan styckningen.)
 */
export const isScrapedEventId = (id: string): boolean => id.includes('/');
