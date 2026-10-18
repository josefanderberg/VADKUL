/**
 * Vän-inbjudningarnas tratt (18/10): hur många som delar sin inbjudningslänk
 * (profilens "Bjud in en vän", vadkul.se/?van=<uid>), hur många som landar på
 * den och hur många värvningar det blir.
 *
 *   delade  - friendInviteStats.shared (skrivs av inbjudaren i webben)
 *   landade - friendInviteStats.landed (länken öppnad; dedupe per webbläsare)
 *   värvade - friendInvites + friendInviters (skrivs av acceptFriendInvite)
 *
 * Läser med count() först och dokumenten bara när kollektionerna är små
 * (reads-budgeten, se CLAUDE.md). Kör: npm run inbjudningar
 */
import { db } from '../config/firebase';

/** Över det här läser vi inga dokument - då är featuren så stor att tratten
 *  behöver en riktig aggregering i stället för ett terminalskript. */
const MAX_DOCS = 500;

interface StatRad {
    uid: string;
    shared: number;
    landed: number;
    recruited: number;
}

async function main(): Promise<void> {
    if (!db) throw new Error('Ingen Firestore-anslutning - saknas service-account.json?');

    const [statsCount, inviterCount, inviteCount] = await Promise.all([
        db.collection('friendInviteStats').count().get(),
        db.collection('friendInviters').count().get(),
        db.collection('friendInvites').count().get(),
    ]);
    const antalStats = statsCount.data().count;
    const antalInbjudare = inviterCount.data().count;
    const antalVarvade = inviteCount.data().count;

    console.log('🔗 Vän-inbjudningarnas tratt\n');

    if (antalStats === 0 && antalInbjudare === 0 && antalVarvade === 0) {
        console.log('   Ingen har delat, öppnat eller fullföljt en inbjudningslänk ännu.');
        return;
    }
    if (antalStats > MAX_DOCS || antalInbjudare > MAX_DOCS) {
        console.log(`   För stort för detaljläsning (${antalStats} stats-dokument, ${antalInbjudare} inbjudare).`);
        console.log(`   Värvade konton: ${antalVarvade}`);
        return;
    }

    // Små kollektioner - läs dokumenten och bygg raderna per inbjudare.
    const rader = new Map<string, StatRad>();
    const rad = (uid: string): StatRad => {
        let r = rader.get(uid);
        if (!r) { r = { uid, shared: 0, landed: 0, recruited: 0 }; rader.set(uid, r); }
        return r;
    };
    const [statsSnap, inviterSnap] = await Promise.all([
        db.collection('friendInviteStats').get(),
        db.collection('friendInviters').get(),
    ]);
    let delare = 0, delningar = 0, landare = 0, landningar = 0, varvningar = 0, belonade = 0;
    for (const d of statsSnap.docs) {
        const r = rad(d.id);
        r.shared = Number(d.get('shared') ?? 0);
        r.landed = Number(d.get('landed') ?? 0);
        if (r.shared > 0) { delare++; delningar += r.shared; }
        if (r.landed > 0) { landare++; landningar += r.landed; }
    }
    for (const d of inviterSnap.docs) {
        const r = rad(d.id);
        r.recruited = Number(d.get('recruited') ?? 0);
        varvningar += r.recruited;
        belonade += Number(d.get('rewarded') ?? 0);
    }

    console.log(`   Delade länken:   ${delare} personer (${delningar} delningar)`);
    console.log(`   Länken öppnades: ${landningar} landningar i unika webbläsare, hos ${landare} inbjudare`);
    console.log(`   Värvade konton:  ${antalVarvade}`);
    console.log(`   Inbjudare med värvning: ${antalInbjudare} (${varvningar} värvningar, ${belonade} gav stjärna)\n`);

    // Topplistan med namn - en users-läsning per rad, max 10.
    const topp = [...rader.values()]
        .sort((a, b) => (b.recruited - a.recruited) || (b.landed - a.landed) || (b.shared - a.shared))
        .slice(0, 10);
    if (topp.length > 0) {
        const namn = await Promise.all(topp.map(async (r) => {
            const u = await db!.collection('users').doc(r.uid).get();
            const displayName = u.get('displayName');
            return typeof displayName === 'string' && displayName.trim() ? displayName.trim() : r.uid;
        }));
        console.log('   Per inbjudare (topp 10):');
        topp.forEach((r, i) => {
            console.log(`     ${namn[i]}: ${r.shared} delningar, ${r.landed} landningar, ${r.recruited} värvade`);
        });
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
