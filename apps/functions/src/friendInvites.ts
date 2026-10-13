/** Vän-inbjudan från profilen: acceptFriendInvite. Besluten i utils/friendInvite. */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { db, region } from './shared';
import { availableStars } from './stars';
import {
    friendRowFields, inviteMessage, isInviteUid, isNewAccount, planFriendInvite,
} from './utils/friendInvite';

// Länken vadkul.se/?van=<inbjudarens uid> landar i webben. När mottagaren
// tackar ja blir de vänner DIREKT (båda raderna 'accepted') - det går inte
// från klienten, reglerna låter bara en förfrågan bli accepterad av den som
// fick den. Här har båda sagt ja: inbjudaren genom att dela länken,
// mottagaren genom att trycka "Bli vänner".
//
// Stjärnorna skrivs bara härifrån (admin-SDK) precis som redeemStarGift.
// Bokföringen ligger i två samlingar som SAKNAR match i firestore.rules och
// därför är stängda för klienter:
//   friendInvites/{vänUid}        - kontot är värvat (EN gång per konto)
//     { inviter, at, inviterRewarded }
//   friendInviters/{inbjudarUid}  - { rewarded, recruited, updatedAt }
//     rewarded räknar värvningar som gett inbjudaren en stjärna (tak 5)
export const acceptFriendInvite = region.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Logga in för att bli vänner.');
    }
    // En anonym session (tips/svar utan konto) har inget namn att visa i
    // vänlistan - och skulle kunna skapas i hur många exemplar som helst.
    if (context.auth.token.firebase?.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('failed-precondition', 'Skapa ett konto för att bli vänner.');
    }

    const uid = context.auth.uid;
    const fran = data?.fran;
    if (!isInviteUid(fran) || fran === uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Ogiltig inbjudan.');
    }

    // Kontots ålder ur Auth (inte users-dokumentet, som klienten skriver).
    let createdMs: number | null = null;
    try {
        const authUser = await admin.auth().getUser(uid);
        const t = Date.parse(authUser.metadata.creationTime);
        createdMs = Number.isFinite(t) ? t : null;
    } catch (error) {
        console.warn('[vän-inbjudan] Kunde inte läsa kontots ålder:', error);
    }
    const callerIsNew = isNewAccount(createdMs, Date.now());

    const users = db.collection('users');
    const callerRef = users.doc(uid);
    const inviterRef = users.doc(fran);
    const callerRowRef = callerRef.collection('friends').doc(fran);
    const inviterRowRef = inviterRef.collection('friends').doc(uid);
    const blockedByInviterRef = inviterRef.collection('blocked').doc(uid);
    const blockedByCallerRef = callerRef.collection('blocked').doc(fran);
    const recruitRef = db.collection('friendInvites').doc(uid);
    const inviterStatsRef = db.collection('friendInviters').doc(fran);

    try {
        let result = {
            success: false,
            vanner: false,
            vanStjarna: false,
            inbjudarStjarna: false,
            starsAvailable: 0,
            message: '',
        };

        await db.runTransaction(async (tx) => {
            // ALLA läsningar före första skrivningen (Firestore-krav).
            const [
                callerDoc, inviterDoc, callerRow, inviterRow,
                blockedByInviter, blockedByCaller, recruit, inviterStats,
            ] = await Promise.all([
                tx.get(callerRef), tx.get(inviterRef), tx.get(callerRowRef), tx.get(inviterRowRef),
                tx.get(blockedByInviterRef), tx.get(blockedByCallerRef), tx.get(recruitRef), tx.get(inviterStatsRef),
            ]);
            if (!inviterDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Inbjudan gäller inte längre.');
            }
            const callerData = callerDoc.exists ? (callerDoc.data() || {}) : {};
            const inviterData = inviterDoc.data() || {};
            // Ett helt nytt konto kan sakna users-dokumentet än - då får
            // inbjudarens vänrad namn och bild ur inloggningstoken.
            const token = context.auth!.token;
            const callerPerson = {
                displayName: callerData.displayName ?? token.name,
                photoURL: callerData.photoURL ?? token.picture,
            };

            const plan = planFriendInvite({
                blocked: blockedByInviter.exists || blockedByCaller.exists,
                callerIsNew,
                alreadyRecruited: recruit.exists,
                inviterRewarded: Number(inviterStats.data()?.rewarded ?? 0),
                callerRow: (callerRow.data()?.status as string | undefined) ?? null,
                inviterRow: (inviterRow.data()?.status as string | undefined) ?? null,
            });
            const inviterName = friendRowFields(inviterData).name ?? null;
            const callerStars = availableStars(callerData);
            result = {
                success: plan.ok,
                vanner: plan.ok,
                vanStjarna: plan.rewardFriend,
                inbjudarStjarna: plan.rewardInviter,
                starsAvailable: callerStars + (plan.rewardFriend ? 1 : 0),
                message: inviteMessage(plan, inviterName),
            };
            if (!plan.ok) return;

            const now = admin.firestore.Timestamp.now();
            if (plan.befriend) {
                // Samma form som webbens friendService (validFriendDoc):
                // status + den ANDRAS namn/bild + createdAt.
                tx.set(callerRowRef, { status: 'accepted', ...friendRowFields(inviterData), createdAt: now });
                tx.set(inviterRowRef, { status: 'accepted', ...friendRowFields(callerPerson), createdAt: now });
            }
            if (!plan.rewardFriend) return;

            tx.create(recruitRef, { inviter: fran, at: now, inviterRewarded: plan.rewardInviter });
            // users-dokumentet ska finnas (skapas vid registrering), men set
            // med merge täcker ett nytt konto vars dokument inte hunnit skrivas.
            // starGift = legacy-spegeln "har minst en oplacerad" (som redeemStarGift).
            tx.set(callerRef, { starsAvailable: callerStars + 1, starGift: 'unused' }, { merge: true });
            const stats = inviterStats.data() || {};
            tx.set(inviterStatsRef, {
                rewarded: Number(stats.rewarded ?? 0) + (plan.rewardInviter ? 1 : 0),
                recruited: Number(stats.recruited ?? 0) + 1,
                updatedAt: now,
            }, { merge: true });
            if (plan.rewardInviter) {
                tx.set(inviterRef, { starsAvailable: availableStars(inviterData) + 1, starGift: 'unused' }, { merge: true });
            }
        });

        return result;
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('[vän-inbjudan] Misslyckades:', error);
        throw new functions.https.HttpsError('internal', 'Ett fel uppstod. Försök igen.');
    }
});
