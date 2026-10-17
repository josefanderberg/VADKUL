/** Anmälningsnotisen: reportAlert - push till admin vid ny anmälan i reports. */
import * as admin from "firebase-admin";
import { db, region } from './shared';
import { sendPushToUser } from './utils/push';
import { reportPushText } from './utils/reportAlert';

// ==============================
// ANMÄLNINGSNOTISEN (App Store-regel 1.2)
// ==============================

/** Ägar-adminens konto - samma hårdkodning som isAdmin() i firestore.rules. */
const ÄGAR_ADMIN_EPOST = 'admin@admin.com';

/**
 * Riktlinje 1.2 kräver att anmält användarinnehåll hanteras inom 24 timmar -
 * det förutsätter att vi får veta att anmälan finns. Triggern ligger på
 * reports/{id} (dit webben och appen skriver chattanmälningar, formen är
 * FRYST i utils/chatModeration resp. lib/moderering) och pushar till admin-
 * kontona: samma definition som reglernas isAdmin() - ägarkontot
 * admin@admin.com plus alla users med isAdmin == true.
 *
 * Läsbudgeten: en select()-query på isAdmin (träffar ~1 dokument) + en
 * auth-uppslagning per anmälan - anmälningar är sällsynta, inget att väga.
 * TTL ett dygn i stället för pushens vanliga timme: notisen är lika viktig
 * när mobilen vaknar på morgonen, och 24-timmarsklockan tickar.
 */
export const reportAlert = region.firestore
    .document('reports/{reportId}')
    .onCreate(async (snap) => {
        const text = reportPushText(snap.data());

        const mottagare = new Set<string>();
        try {
            const adminsSnap = await db.collection('users').where('isAdmin', '==', true).select().get();
            adminsSnap.docs.forEach(d => mottagare.add(d.id));
        } catch (e) {
            console.error('[reportAlert] Kunde inte lista isAdmin-konton:', e);
        }
        try {
            const ägare = await admin.auth().getUserByEmail(ÄGAR_ADMIN_EPOST);
            mottagare.add(ägare.uid);
        } catch {
            // Ägarkontot kanske inte finns i den här miljön - de andra räcker.
        }

        if (mottagare.size === 0) {
            console.warn('[reportAlert] Ingen admin att notifiera - anmälan ligger kvar oläst i reports.');
            return;
        }

        let levererade = 0;
        for (const uid of mottagare) {
            try {
                levererade += await sendPushToUser(uid, {
                    ...text,
                    url: '/',
                    type: 'report',
                }, { ttlSeconds: 24 * 3600 });
            } catch (e) {
                console.error(`[reportAlert] Push till ${uid} misslyckades:`, e);
            }
        }
        console.log(`[reportAlert] Anmälan ${snap.id}: push till ${mottagare.size} admin(s), ${levererade} enheter nådda.`);
    });
