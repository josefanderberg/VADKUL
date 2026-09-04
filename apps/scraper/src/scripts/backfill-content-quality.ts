/**
 * backfill-content-quality.ts — laga innehållskvalitet i BEFINTLIGA event.
 *
 * Kvalitetsrevisionen 2026-09-03 (45 312 publicerade event) visade:
 *   - 81 % saknar pris, men i 900+ beskrivningar STÅR priset i texten
 *     (FB 222, PRO 177, Svenska kyrkan 60, Göteborg 32 …).
 *   - 25 FB-beskrivningar bär ersättningstecken (�) där emoji stod.
 *   - 1 509 beskrivningar är kapade EXAKT vid 500 tecken (gamla taket i
 *     cleanDescription), 300+ vid 600, mitt i ett ord.
 *   - 159 beskrivningar saknar å/ä/ö (buggen före 2026-07-09).
 *
 * Det här skriptet gör det som går att göra LOKALT, deterministiskt och
 * idempotent:
 *   1. Pris ur beskrivningstexten där prisfältet är tomt (utils/priceFromText
 *      — bara säkra träffar: etiketterat belopp, entré-fras, per person).
 *   2. Ersättningstecken/trasiga surrogat bort, FB-sidfot-"beskrivning" →
 *      tom (utils/normalizeEvent) — bara rader som faktiskt bär skadan.
 *   3. RAPPORT över kapade/å-ä-ö-lösa beskrivningar per domän. De lagas
 *      inte här — texten finns bara hos källan — utan av runnerns refresh-
 *      gren (utils/contentRefresh) nästa full-refresh, eller direkt med
 *        SCRAPE_FORCE_REFRESH=1 npm run sources -- --engine=<engine>
 *      (svenskakyrkan, nortic, pro, hembygd, rotary, bibliotek …).
 *
 * Skriver SQLite + Firestore (stamped()). --apply krävs, annars dry-run.
 * Körs i nattkedjan (run-daily.sh, steg K9) före K4/LLM så Ollama bara får
 * de event som texten inte kunde prissätta.
 *
 *   npm run backfill-content              # dry-run
 *   npm run backfill-content -- --apply
 */

import { db } from '../config/firebase';
import { sqlite, setEventContent } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { extractPriceFromText } from '../utils/priceFromText';
import { normalizeDescription, sanitizePriceField } from '../utils/normalizeEvent';
import { looksStripped } from '../utils/contentRefresh';
import { looksLikeCinema, CINEMA_EMOJI } from '../utils/cinema';

const APPLY = process.argv.includes('--apply');

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    description: string | null;
    price: string | null;
    locationName: string | null;
    emoji: string | null;
}

const BROKEN_CHARS_RE = /�|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const FB_FOOTER_RE = /^\s*Integritet\s*[·•]?\s*(?:\n\s*)?·?\s*Användarvillkor/i;
const READ_MORE_TAIL_RE = /\s*(?:läs mer|read more|visa mer|see more)(?:\s+här)?\s*[»›→…]*\s*$/i;
/** Gamla hårda tak: cleanDescription 500, engines 600/800. Avslut saknas → kapad. */
const OLD_CAPS = new Set([500, 600, 800]);

function host(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return '?'; }
}

async function writePatch(r: Row, patch: { description?: string; price?: string; emoji?: string }): Promise<void> {
    setEventContent(r.url, patch);
    if (db && r.firestoreId) {
        try {
            await db.collection('linkEvents').doc(r.firestoreId).update(stamped(patch));
        } catch (e: any) {
            // NOT_FOUND (kod 5) = dokumentet rensat ur Firestore — SQLite räcker.
            if (e?.code !== 5) console.error(`  ❌ Firestore ${r.url.slice(0, 60)}: ${e?.message}`);
        }
    }
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN (kör med --apply för att skriva)');
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, description, price, locationName, emoji
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now')
    `).all() as Row[];
    console.log(`${rows.length} framtida synliga event`);

    const stats = { price: 0, priceCleaned: 0, cleaned: 0, emptied: 0, cinema: 0 };
    const priceSamples: string[] = [];
    const priceByHost: Record<string, number> = {};
    const capped: Record<string, number> = {};
    const stripped: Record<string, number> = {};

    for (const r of rows) {
        const desc = r.description ?? '';
        const patch: { description?: string; price?: string; emoji?: string } = {};

        // 0) Biovisning utan filmsymbol → 🎬 (473 hade 🎭/🎉/🧸, 2026-09-04).
        if (looksLikeCinema(r.title, r.locationName) && (r.emoji ?? '') !== CINEMA_EMOJI) { patch.emoji = CINEMA_EMOJI; stats.cinema++; }

        // 1) Trasiga tecken / FB-sidfot / "Läs mer"-svans → städa (bara rader som bär skadan).
        if (desc && (BROKEN_CHARS_RE.test(desc) || FB_FOOTER_RE.test(desc) || READ_MORE_TAIL_RE.test(desc))) {
            const fixed = normalizeDescription(desc);
            if (fixed !== desc) {
                patch.description = fixed;
                if (fixed) stats.cleaned++; else stats.emptied++;
            }
        }

        // 2a) Skräp/långtext i prisfältet ("P", "ordi", "Pris: 100 kr, Ungdom …
        //     Biljetter via …") → tomt resp. intervall.
        const storedPrice = (r.price ?? '').trim();
        const sanitized = storedPrice ? (sanitizePriceField(storedPrice) ?? '') : '';
        if (storedPrice && sanitized !== storedPrice) { patch.price = sanitized; stats.priceCleaned++; }
        const effectivePrice = storedPrice ? sanitized : '';

        // 2b) Pris ur texten där prisfältet är (eller just blev) tomt. Tickster
        //     undantas: deras sidtext bär Ticksters egen serviceavgift ("800 kr").
        const text = patch.description ?? desc;
        if (!effectivePrice && text && !/tickster\.com/i.test(r.url)) {
            const p = extractPriceFromText(text);
            if (p) {
                patch.price = p;
                stats.price++;
                const h = host(r.url);
                priceByHost[h] = (priceByHost[h] || 0) + 1;
                if (priceSamples.length < 15) priceSamples.push(`  ${p.padEnd(12)} ${r.title.slice(0, 45).padEnd(45)} ${h}`);
            }
        }

        // 3) Rapport: kapade vid gammalt tak / å-ä-ö-lösa (lagas av refresh-körning).
        if (desc && OLD_CAPS.has(desc.length) && !/[.!?…)"”]\s*$/.test(desc)) {
            const h = host(r.url);
            capped[h] = (capped[h] || 0) + 1;
        }
        if (desc && !/[åäöÅÄÖ]/.test(desc) && looksStripped(desc)) {
            const h = host(r.url);
            stripped[h] = (stripped[h] || 0) + 1;
        }

        if (Object.keys(patch).length && APPLY) await writePatch(r, patch);
    }

    console.log(`\n💰 Pris ur texten: ${stats.price} event ${APPLY ? 'uppdaterade' : 'skulle uppdateras'}`);
    console.log(Object.entries(priceByHost).sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([h, n]) => `  ${String(n).padStart(5)}  ${h}`).join('\n'));
    if (priceSamples.length) console.log('  exempel:\n' + priceSamples.join('\n'));
    console.log(`\n🧹 Beskrivningar städade från �/sidfot/"Läs mer": ${stats.cleaned} (${stats.emptied} tömda)`);
    console.log(`🏷️  Prisfält sanerade (skräp tömt / långtext → intervall): ${stats.priceCleaned}`);
    console.log(`🎬 Biovisningar som fick filmsymbol: ${stats.cinema}`);

    const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([h, n]) => `  ${String(n).padStart(5)}  ${h}`).join('\n') || '  (inga)';
    console.log(`\n✂️  Kapade vid gammalt tak (500/600/800, utan avslut) — lagas av SCRAPE_FORCE_REFRESH=1 npm run sources -- --engine=<x>:\n${top(capped)}`);
    console.log(`\n🔤 Saknar å/ä/ö (mellanslagshål) — samma refresh-väg, eller npm run repair-stripped:\n${top(stripped)}`);
    if (!APPLY) console.log('\nDry-run — inget skrivet.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
