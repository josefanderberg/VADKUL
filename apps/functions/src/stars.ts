/** Kampanjkoder + stjärngåvan: redeemCode, redeemStarGift, placeStar. */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { createHash } from "crypto";
import { db, region } from './shared';

export const redeemCode = region.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    // 1. Auth Check - Ensure user is logged in
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Du måste vara inloggad för att lösa in koder.'
        );
    }

    const { code } = data;
    const uid = context.auth.uid;

    if (!code || typeof code !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Ingen kod angiven.'
        );
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
                const newRedeemed = redeemed.filter((c: string) => c !== normalizedCode);
                transaction.update(userRef, {
                    redeemedCodes: newRedeemed
                });
                message = 'Koden godkänd. Premium avaktiverat.';
            } else {
                // TOGGLE ON
                transaction.update(userRef, {
                    redeemedCodes: [...redeemed, normalizedCode]
                });
                message = 'Koden godkänd. Premium aktiverat!';
            }
        });

        return { success: true, message };

    } catch (error) {
        console.error("Redeem error:", error);
        throw new functions.https.HttpsError(
            'internal',
            'Ett fel uppstod vid inlösning av koden.'
        );
    }
});

// ==============================
// STJÄRN-GÅVAN (tack-kampanj till de första användarna)
// ==============================
//
// En kampanjlänk (/?stjarna=<KOD>) ger EN stjärna ⭐ som kan sättas på VALFRITT
// event. eventStars/{docId} och stjärn-fälten på users/{uid} skrivs ENBART
// härifrån via admin-SDK:t — Firestore-reglerna blockerar all klientskrivning
// av dem, annars vore gåvan förfalskbar.
//
// SPÄRREN LIGGER PER (KONTO, KOD) sedan 22/8 (Josef: "kan vi inte göra så att
// man kan få fler med olika länkar?"). Förut var den per konto, så ett konto
// kunde bara någonsin få EN stjärna oavsett hur många kampanjer det fick.
// Nu gäller: varje kod kan lösas in en gång per konto, och stjärnorna
// STAPLAS — vill du ge någon tre stjärnor skickar du tre olika koder.
//
// users/{uid}:
//   starsAvailable: number   — ohämtade/oplacerade stjärnor (räknaren som gäller)
//   starGiftCodes:  string[] — koder kontot redan löst in (spärren)
//   starGiftCode:   string   — SENAST inlösta koden (attribution, som förut)
//   starGift:       'unused' | 'placed' — LEGACY-spegel av räknaren, hålls kvar
//                              så gamla klienter och gamla dokument funkar
//   starEventId:    string   — senast stjärnmärkta eventet (attribution)

// Giltiga kampanjkoder. Listan är MEDVETET explicit (ingen STJARNA<N>-regel):
// koderna är publika så fort de skickats, och ett gissningsbart MÖNSTER hade
// låtit ett konto skörda hur många stjärnor som helst — att en enskild kod går
// att gissa gör mindre (Josef 22/8), men listan sätter taket. Ny kampanj = ny
// kod här + functions-deploy. STJARNA1 = publika kampanjer (FB-grupper m.m.),
// ARRANGOR1 = arrangörs-outreachen (docs/outreach/), MEDLEM1 = medlems-
// utskicket via Zoho Campaigns, STJARNA2 = mejlutskicket aug -26,
// STJARNA3 = mejlutskicket sep -26.
const STAR_GIFT_CODES = ['STJARNA1', 'ARRANGOR1', 'MEDLEM1', 'STJARNA2', 'STJARNA3'];

// KORTFORMER (22/8): länkarna ska vara korta i mejl och inlägg —
// vadkul.se/s/2 i stället för vadkul.se/?stjarna=STJARNA2&utm_…
// Kortformen är ett ALIAS, inte en egen kampanj: den normaliseras till samma
// kanoniska kod, så /s/2 och /?stjarna=STJARNA2 räknas som SAMMA inlösen och
// ger tillsammans EN stjärna. Gamla långa länkar fortsätter alltså funka.
const STAR_CODE_ALIASES: Record<string, string> = {
    '1': 'STJARNA1', 'S1': 'STJARNA1',
    '2': 'STJARNA2', 'S2': 'STJARNA2',
    '3': 'STJARNA3', 'S3': 'STJARNA3',
    'A1': 'ARRANGOR1',
    'M1': 'MEDLEM1',
};

/** Rå kod ur länken → kanonisk kampanjkod, eller null om den inte finns. */
function canonicalStarCode(raw: string): string | null {
    const v = raw.toUpperCase().trim();
    if (STAR_GIFT_CODES.includes(v)) return v;
    return STAR_CODE_ALIASES[v] ?? null;
}

/** Koder kontot redan löst in. Gamla dokument har bara starGiftCode (skrevs
 *  först 16/7) — och de som hämtade sin stjärna dessförinnan kan bara ha fått
 *  den från STJARNA1, den enda kod som fanns då. Utan den fallbacken hade de
 *  kontona kunnat klicka samma gamla länk igen och få en extra stjärna. */
function redeemedCodes(data: Record<string, any>): string[] {
    if (Array.isArray(data.starGiftCodes)) return data.starGiftCodes.filter((c: unknown) => typeof c === 'string');
    if (typeof data.starGiftCode === 'string') return [data.starGiftCode];
    if (data.starGift === 'unused' || data.starGift === 'placed') return ['STJARNA1'];
    return [];
}

/** Oplacerade stjärnor. Saknas räknaren är dokumentet från före 22/8 → läs
 *  legacy-flaggan (en enda stjärna, hämtad = 1, placerad = 0). */
function availableStars(data: Record<string, any>): number {
    if (typeof data.starsAvailable === 'number' && Number.isFinite(data.starsAvailable)) {
        return Math.max(0, Math.floor(data.starsAvailable));
    }
    return data.starGift === 'unused' ? 1 : 0;
}

/** Lös in stjärn-gåvan: +1 stjärna på kontot, en gång per kod. */
export const redeemStarGift = region.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Du måste vara inloggad för att hämta din stjärna.'
        );
    }

    const { code } = data;
    const uid = context.auth.uid;

    if (!code || typeof code !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Ingen kod angiven.');
    }
    const normalizedCode = canonicalStarCode(code);
    if (!normalizedCode) {
        return { success: false, message: 'Ogiltig gåvolänk.' };
    }

    const userRef = db.collection('users').doc(uid);

    try {
        let result: {
            success: boolean;
            status: 'unused' | 'placed';
            message: string;
            starsAvailable: number;
        } = { success: true, status: 'unused', message: 'Du har en stjärna! ⭐', starsAvailable: 1 };

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.exists ? (userDoc.data() || {}) : {};
            const redeemed = redeemedCodes(userData);
            const available = availableStars(userData);

            // Spärren: EN inlösen per kod och konto. En annan kod ger en till
            // stjärna — det är hela poängen med flera länkar.
            if (redeemed.includes(normalizedCode)) {
                result = available > 0
                    ? {
                        success: false, status: 'unused', starsAvailable: available,
                        message: available > 1
                            ? `Du har redan hämtat stjärnan från den här länken — och har ${available} stjärnor kvar att sätta. ⭐`
                            : 'Du har redan hämtat stjärnan från den här länken — öppna ett event och tryck på ⭐.',
                    }
                    : {
                        success: false, status: 'placed', starsAvailable: 0,
                        message: 'Stjärnan från den här länken är redan använd — den sitter på ett event. ⭐',
                    };
                return;
            }

            const next = available + 1;
            result = {
                success: true,
                status: 'unused',
                starsAvailable: next,
                message: next > 1
                    ? `Du har ${next} stjärnor att sätta! ⭐`
                    : 'Du har en stjärna! ⭐',
            };
            // users-dokumentet ska finnas (skapas vid registrering), men gamla
            // konton utan doc får inte fastna → set med merge täcker båda.
            // starGiftCode = SENASTE kampanjen (attributionen som outreach-
            // konsolen läser), starGiftCodes = hela spärrlistan.
            transaction.set(userRef, {
                starsAvailable: next,
                starGiftCodes: [...redeemed, normalizedCode],
                starGiftCode: normalizedCode,
                starGift: 'unused', // legacy-spegel: "har minst en oplacerad"
            }, { merge: true });
        });

        return result;
    } catch (error) {
        console.error('[stjärna] Inlösen misslyckades:', error);
        throw new functions.https.HttpsError('internal', 'Ett fel uppstod. Försök igen.');
    }
});

/**
 * Sätt EN stjärna på ett event: kräver minst en oplacerad stjärna. Skapar
 * eventStars/{safeEventKey__uid} + räknar ner starsAvailable i SAMMA
 * transaction, så samma stjärna aldrig kan placeras två gånger. Flera
 * användares stjärnor på samma event är ok (uid ingår i doc-id:t), men EN
 * användare kan bara stjärnmärka ett event en gång — doc-id:t rymmer inte
 * fler, och en andra stjärna på samma event syns inte heller för någon.
 */
export const placeStar = region.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Du måste vara inloggad för att sätta din stjärna.'
        );
    }

    const { eventId } = data;
    const uid = context.auth.uid;

    if (!eventId || typeof eventId !== 'string' || eventId.length > 1000) {
        throw new functions.https.HttpsError('invalid-argument', 'Ogiltigt event.');
    }

    // Doc-id får inte innehålla '/' (skrapade event-id:n kan vara URL:ar) —
    // hasha sådana till en kort hex-nyckel. Själva eventId ligger orört i fältet.
    const safeEventKey = eventId.includes('/')
        ? createHash('sha256').update(eventId).digest('hex').slice(0, 32)
        : eventId;
    const starRef = db.collection('eventStars').doc(`${safeEventKey}__${uid}`);
    const userRef = db.collection('users').doc(uid);

    try {
        let result: { success: boolean; message: string; starsLeft: number } = {
            success: true, message: 'Din stjärna sitter! ⭐', starsLeft: 0
        };

        await db.runTransaction(async (transaction) => {
            // ALLA läsningar före första skrivningen (Firestore-krav).
            const userDoc = await transaction.get(userRef);
            const existingStar = await transaction.get(starRef);
            const userData = userDoc.exists ? (userDoc.data() || {}) : {};
            const available = availableStars(userData);

            if (available <= 0) {
                result = {
                    success: false, starsLeft: 0,
                    message: 'Du har ingen stjärna att sätta. Har du klickat på gåvolänken?',
                };
                return;
            }
            // Med flera stjärnor på kontot kan man råka välja samma event igen
            // — det hade bara bränt en stjärna utan att synas.
            if (existingStar.exists) {
                result = {
                    success: false, starsLeft: available,
                    message: 'Du har redan en stjärna på det här eventet — välj ett annat. ⭐',
                };
                return;
            }

            const left = available - 1;
            transaction.create(starRef, {
                eventId,
                uid,
                createdAt: admin.firestore.Timestamp.now(),
            });
            transaction.set(userRef, {
                starsAvailable: left,
                starEventId: eventId,
                starGift: left > 0 ? 'unused' : 'placed', // legacy-spegel
            }, { merge: true });
            result = {
                success: true,
                starsLeft: left,
                message: left > 0
                    ? `Din stjärna sitter! ⭐ Du har ${left} kvar att sätta.`
                    : 'Din stjärna sitter! ⭐',
            };
        });

        return result;
    } catch (error) {
        console.error('[stjärna] Placering misslyckades:', error);
        throw new functions.https.HttpsError('internal', 'Ett fel uppstod. Försök igen.');
    }
});
