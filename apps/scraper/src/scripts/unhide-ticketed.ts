/**
 * unhide-ticketed.ts — ta fram biljettevent som gömts på felaktiga grunder.
 *
 * BAKGRUNDEN (2026-09-01): 697 framtida event från Ticketmaster, Tickster,
 * Billetto och Nortic låg dolda. Två orsaker, båda åtgärdade i koden:
 *
 *  1. AUTO-HIDE PÅ AUDIT-VERDIKT. Den lokala LLM:en junk-dömde 270
 *     Ticketmaster-event med HÖG konfidens — "ASKEPOT – The Musical" på
 *     Operaen i København, "Orgelsommer i Oslo domkirke". Villkoret
 *     `!result.inSweden` slog dessutom hårdare mot NO/DK, som per ägarbeslut
 *     SKA visas: de bär affiliatelänkar vi tjänar pengar på.
 *     → audit-skripten hoppar nu över betrodda biljettkällor.
 *
 *  2. DUBBLETTVALET. scoreOf saknade poäng för affiliatelänk, så en turistsajt
 *     med snyggare bild vann. → +25 för affiliate-wrappad URL.
 *
 * Det här skriptet städar det som redan hunnit gömmas. Det avslöjar BARA
 * event utan synlig tvilling — en korrekt dedupad dubblett ska förbli dold,
 * annars står samma konsert två gånger på kartan.
 *
 * Körning (från apps/scraper):
 *   npx ts-node src/scripts/unhide-ticketed.ts            # dry-run
 *   npx ts-node src/scripts/unhide-ticketed.ts --apply
 *   npx ts-node src/scripts/unhide-ticketed.ts --apply --alla   # även passerade
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { setHidden } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { isTrustedTicketSource, isAffiliateLink } from '../utils/ticketSources';
import { normalizeTitle, localDay } from './dedupe-cross-source';

const APPLY = process.argv.includes('--apply');
const ALLA = process.argv.includes('--alla');

interface Row {
    url: string; title: string; time: string; locationName: string;
    hidden: number; aiVerdict: string | null; hostName: string; firestoreId: string | null;
}

async function main() {
    const sqlite = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    const tidsvillkor = ALLA ? '1=1' : "datetime(time) >= datetime('now')";
    const alla = sqlite.prepare(`
        SELECT url, title, time, locationName, hidden, aiVerdict, hostName, firestoreId
        FROM link_events WHERE ${tidsvillkor}
    `).all() as Row[];
    sqlite.close();

    // Synliga tvillingar per (titel, dag) — samma nyckel som dedupen använder,
    // fast utan platsdelen: en dubblett kan ha geokodats till olika koordinater
    // och ska ändå räknas som samma event här.
    const synliga = new Set<string>();
    for (const r of alla) {
        if (r.hidden) continue;
        synliga.add(`${normalizeTitle(r.title)}|${localDay(r.time)}`);
    }

    const kandidater = alla.filter(r =>
        r.hidden === 1 &&
        isTrustedTicketSource(r.url) &&
        !synliga.has(`${normalizeTitle(r.title)}|${localDay(r.time)}`));

    const perKalla = new Map<string, number>();
    for (const r of kandidater) perKalla.set(r.hostName, (perKalla.get(r.hostName) ?? 0) + 1);

    const dolda = alla.filter(r => r.hidden === 1 && isTrustedTicketSource(r.url));
    console.log(`\n${dolda.length} dolda biljettevent${ALLA ? '' : ' (framtida)'}.`);
    console.log(`${dolda.length - kandidater.length} har en synlig tvilling — de lämnas dolda (korrekt dedup).`);
    console.log(`${kandidater.length} saknar synlig tvilling och tas fram${APPLY ? '' : ' (DRY-RUN)'}:\n`);
    for (const [k, n] of [...perKalla].sort((a, b) => b[1] - a[1])) {
        console.log(`   ${String(n).padStart(4)}  ${k}`);
    }
    console.log(`\n   varav affiliate-wrappade: ${kandidater.filter(r => isAffiliateLink(r.url)).length}`);
    console.log('\nExempel:');
    for (const r of kandidater.slice(0, 12)) {
        console.log(`   ${r.time.slice(0, 10)}  ${(r.aiVerdict ?? '-').padEnd(12)} ${r.title.slice(0, 46).padEnd(46)} ${(r.locationName ?? '').slice(0, 24)}`);
    }

    if (!APPLY) {
        console.log('\nKör om med --apply för att ta fram dem.');
        return;
    }

    let sqliteOk = 0, firestoreOk = 0, fel = 0;
    for (const r of kandidater) {
        try {
            setHidden(r.url, false);
            sqliteOk++;
            // Firestore måste med — aggregatet byggs från spegeln, men kartan
            // och stadssidorna läser Firestore. ALLA skrivningar via stamped().
            if (db && r.firestoreId) {
                await db.collection('linkEvents').doc(r.firestoreId).update(stamped({ hidden: 0 }));
                firestoreOk++;
            }
        } catch (e) {
            fel++;
            console.error(`   ❌ ${r.title.slice(0, 40)}: ${(e as Error).message}`);
        }
    }
    console.log(`\n✅ ${sqliteOk} framtagna i SQLite, ${firestoreOk} speglade till Firestore, ${fel} fel.`);
    console.log('Kör aggregate för att få ut dem på kartan.');
}

main().catch(e => { console.error(e); process.exit(1); });
