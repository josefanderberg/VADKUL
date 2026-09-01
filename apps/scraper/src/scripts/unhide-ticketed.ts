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

    /* ── FAS 2: växla tillbaka till affiliatelänken ─────────────────────────
     *
     * Dedupen valde fel kopia innan scoreOf fick +25 för affiliate (1/9), och
     * fixen gäller bara framåt — de grupper som redan dedupats står kvar med
     * fel vinnare. Mamma Mia 3/9: visitstockholm.com synlig, affiliate-URL:en
     * dold, klicket gick dit och provisionen uteblev.
     *
     * För varje (titel, dag) där en affiliatelänk är dold men en tvilling utan
     * provision är synlig: visa affiliaten och göm de andra. Antalet synliga
     * rader är oförändrat — det är bara VILKEN länk som visas som byts, så
     * ingen dubblett uppstår på kartan.
     */
    const nyckel = (r: Row) => `${normalizeTitle(r.title)}|${localDay(r.time)}`;
    const doldAffiliate = new Map<string, Row>();
    for (const r of alla) {
        if (r.hidden === 1 && isAffiliateLink(r.url) && !doldAffiliate.has(nyckel(r))) {
            doldAffiliate.set(nyckel(r), r);
        }
    }
    const vaxlingar: { fram: Row; undan: Row[] }[] = [];
    for (const [k, fram] of doldAffiliate) {
        const synligaUtanProvision = alla.filter(r =>
            r.hidden === 0 && nyckel(r) === k && !isAffiliateLink(r.url));
        if (synligaUtanProvision.length > 0) vaxlingar.push({ fram, undan: synligaUtanProvision });
    }

    if (vaxlingar.length > 0) {
        console.log(`\n${vaxlingar.length} grupper där affiliatelänken är dold men en tvillling utan provision syns:`);
        for (const v of vaxlingar.slice(0, 10)) {
            console.log(`   ${v.fram.time.slice(0, 10)}  ${v.fram.title.slice(0, 40).padEnd(40)} ← ersätter ${v.undan.map(u => u.hostName).join(', ').slice(0, 34)}`);
        }
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
    // Fas 2: fram med affiliaten FÖRST, sedan undan med de andra — ordningen
    // gör att gruppen aldrig står helt osynlig om körningen avbryts.
    let vaxlade = 0;
    for (const v of vaxlingar) {
        try {
            setHidden(v.fram.url, false);
            if (db && v.fram.firestoreId) {
                await db.collection('linkEvents').doc(v.fram.firestoreId).update(stamped({ hidden: 0 }));
            }
            for (const u of v.undan) {
                setHidden(u.url, true);
                if (db && u.firestoreId) {
                    await db.collection('linkEvents').doc(u.firestoreId).update(stamped({ hidden: 1 }));
                }
            }
            vaxlade++;
        } catch (e) {
            fel++;
            console.error(`   ❌ växling ${v.fram.title.slice(0, 36)}: ${(e as Error).message}`);
        }
    }

    console.log(`\n✅ ${sqliteOk} framtagna i SQLite, ${firestoreOk} speglade till Firestore.`);
    console.log(`✅ ${vaxlade} grupper växlade till affiliatelänken.`);
    if (fel > 0) console.log(`⚠️  ${fel} fel.`);
    console.log('Kör aggregate för att få ut dem på kartan.');
}

main().catch(e => { console.error(e); process.exit(1); });
