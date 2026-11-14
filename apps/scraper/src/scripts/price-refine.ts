/**
 * price-refine.ts — pris ur DETALJSIDAN för event som saknar pris.
 *
 * Bakgrund (jämförelsen 14/11 2026): 80 % av de kommande eventen saknade
 * pris. Beskrivningens prisletare (backfill-content, K9) hittar bara det som
 * står i brödtexten; hos de flesta kommun-, besöks- och studieförbundskällor
 * står priset i sidans FAKTARUTA ("Pris: 90 kr", <dt>Kostnad</dt><dd>Gratis</dd>)
 * eller i JSON-LD, som ingen motor utom sitemap läser. Det här skriptet hämtar
 * detaljsidan och läser den med utils/priceFromMarkup — oavsett vilken motor
 * som skrapade eventet.
 *
 * Kandidater: framtida synliga event utan pris, priceRefineAttempts < 2, och
 * en adress som kan bära ett pris (utils/priceRefineTargets: inte SvK/FB/
 * Tickster/SPA-rutter). Snarast först, varvat mellan värdarna.
 *
 * Skydd:
 *   - En värd i taget får högst --per-host hämtningar per körning, en åt
 *     gången med paus emellan. Värdarna körs parallellt.
 *   - Ger en värds första 12 sidor inga träffar avbryts värden och vilar i
 *     30 dagar (sync_meta priceRefine.dry.<värd>) — sidmallen bär inget pris.
 *     Gäller bara värdar som ALDRIG gett ett pris (priceRefine.hits.<värd>).
 *     --host=<värd> provar ändå.
 *   - Samma BELOPP på nästan alla sidor hos en värd = sidmallens pris (museets
 *     entré), inte eventets: hålls tillbaka och rapporteras. Släpp fram med
 *     --trust-host=<värd> efter kontroll.
 *   - Nätfel och 5xx räknas inte som försök; 404/410 och sidor utan pris gör det.
 *
 *   - JSON-LD-flaggan isAccessibleForFree=true som ENDA belägg räknas först
 *     när värden också visat false på någon sida i körningen (Hörby sätter
 *     true på allt).
 *
 * Skriver SQLite + Firestore (stamped()). --apply krävs, annars dry-run.
 * Varje satt pris loggas i ~/Library/Logs/vadkul-scraper/price-refine.tsv.
 *
 *   npm run price-refine                          # dry-run, 2000 event
 *   npm run price-refine -- --sample              # dry-run, 6 sidor per värd (kartläggning)
 *   npm run price-refine -- --apply --limit=1500  # nattkedjans steg
 *   npm run price-refine -- --host=abf.se --apply
 *   npm run price-refine -- --recheck --apply     # ompröva redan satta priser efter en regeländring:
 *                                                 # hämtar spårloggens sidor igen, rättar eller tar bort
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { db } from '../config/firebase';
import { sqlite, setEventContent, bumpPriceRefineAttempts, getSyncMeta, setSyncMeta } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { readMarkupPrice, MarkupPrice, PriceVia } from '../utils/priceFromMarkup';
import { priceRefineFetchUrl, refineHost, templatePrice, roundRobin } from '../utils/priceRefineTargets';
import { mapPool } from '../utils/mapPool';

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const APPLY = argv.includes('--apply');
const SAMPLE = argv.includes('--sample');
/** Ompröva priser vi redan satt (ur spårloggen) mot dagens regler: rätta eller ta bort. */
const RECHECK = argv.includes('--recheck');
const LIMIT = parseInt(flag('limit') ?? (SAMPLE || RECHECK ? '100000' : '2000'), 10);
const PER_HOST = SAMPLE ? 6 : parseInt(flag('per-host') ?? (RECHECK ? '100000' : '300'), 10);
const ONLY_HOST = flag('host')?.replace(/^www\./, '').toLowerCase();
const TRUSTED = new Set((flag('trust-host') ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));

const MAX_ATTEMPTS = 2;
const HOST_CONCURRENCY = 6;
const HOST_PAUSE_MS = 600;
/** Så många sidor utan en enda träff innan värden avbryts för körningen. */
const DRY_HOST_AFTER = 12;
const MAX_HTML_BYTES = 4_000_000;
const UA = 'VadKul/1.0 (+https://vadkul.se)';
/** En värd utan träffar vilar så här länge innan den provas igen (sajten kan ha byggts om). */
const DRY_REST_DAYS = 30;
const dryKey = (host: string): string => `priceRefine.dry.${host}`;
/** Hur många priser värden gett genom åren. En värd som NÅGON gång gett pris är inte torr. */
const hitsKey = (host: string): string => `priceRefine.hits.${host}`;
const lifetimeHits = (host: string): number => parseInt(getSyncMeta(hitsKey(host)) ?? '0', 10) || 0;

/**
 * Vilar värden? Bara värdar som aldrig gett ett pris kan vila. Första skarpa
 * körningen 14/11 vilomärkte Studiefrämjandet, Borås & Co och Visit Linköping
 * efter att de gett hundratals priser: deras KVARVARANDE prislösa event (redan
 * provade en gång) gav tolv missar i rad. Missarna begränsas av försöken per
 * event — värden ska fortsätta provas för nya event.
 */
function isResting(host: string): boolean {
    if (lifetimeHits(host) > 0) return false;
    const since = getSyncMeta(dryKey(host));
    if (!since) return false;
    return Date.now() - new Date(since).getTime() < DRY_REST_DAYS * 86_400_000;
}

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    time: string;
    /** --recheck: priset spårloggen säger att vi satte (och som fortfarande står kvar). */
    written?: string;
}

interface Target extends Row { fetchUrl: string; host: string }

type FetchResult = { html: string } | { gone: true } | { error: string };

async function fetchPage(url: string): Promise<FetchResult> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
            signal: AbortSignal.timeout(20_000),
            redirect: 'follow',
        });
        if (res.status === 404 || res.status === 410) return { gone: true };
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const type = res.headers.get('content-type') ?? '';
        if (type && !/html|xml/i.test(type)) return { gone: true };
        const html = await res.text();
        if (html.length > MAX_HTML_BYTES) return { error: 'för stor sida' };
        return { html };
    } catch (e) {
        return { error: (e as Error).message };
    }
}

/**
 * Spårlogg: en rad per satt pris (datum, pris, väg, adress, titel). Ett fel
 * pris ska gå att spåra till sin sida och sin regel — och en hel värd gå att
 * backa. --apply skriver till nattloggarnas mapp, --audit=<fil> väljer fil
 * (även i dry-run).
 */
const AUDIT_FILE = flag('audit')
    ?? (APPLY ? path.join(os.homedir(), 'Library/Logs/vadkul-scraper/price-refine.tsv') : undefined);

function audit(t: Target, price: string, via: PriceVia): void {
    // En torrkörd omprövning läser loggen — den får inte skriva "skulle"-rader i den.
    if (!AUDIT_FILE || (RECHECK && !APPLY)) return;
    try {
        fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
        fs.appendFileSync(AUDIT_FILE, [new Date().toISOString().slice(0, 10), price, via, t.url, t.title.replace(/\s+/g, ' ')].join('\t') + '\n');
    } catch { /* spårloggen får aldrig fälla körningen */ }
}

/** Sätt priset — eller ta bort det (null), när en omprövning inte längre står för det. */
async function writePrice(r: Row, price: string | null): Promise<void> {
    setEventContent(r.url, { price: price ?? '' });
    if (db && r.firestoreId) {
        try {
            await db.collection('linkEvents').doc(r.firestoreId).update(stamped({ price }));
        } catch (e: any) {
            // NOT_FOUND (kod 5) = dokumentet rensat ur Firestore — SQLite räcker.
            if (e?.code !== 5) console.error(`  ❌ Firestore ${r.url.slice(0, 60)}: ${e?.message}`);
        }
    }
}

/** --recheck: spårloggens senaste pris per adress. */
function loadAudit(file: string): Map<string, string> {
    const out = new Map<string, string>();
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const [, price, , url] = line.split('\t');
        if (url) out.set(url, price ?? '');
    }
    return out;
}

interface HostStats {
    host: string;
    /** Hämtade sidor / sidor med ett pris i markupen. */
    tried: number; hits: number;
    /** Event som fick (eller i dry-run skulle få) pris. I --recheck: ändrat pris. */
    written: number;
    /** --recheck: priset höll / priset togs bort. */
    kept: number; cleared: number;
    errors: number;
    /** Belopp som hölls tillbaka som sidmall. */
    held: string | null;
    /** Event vars enda prisbelägg var en obevisad gratisflagga. */
    flagHeld: number;
    stoppedDry: boolean;
}

async function refineHostTargets(host: string, targets: Target[], samples: string[]): Promise<HostStats> {
    const stats: HostStats = { host, tried: 0, hits: 0, written: 0, kept: 0, cleared: 0, errors: 0, held: null, flagHeld: 0, stoppedDry: false };
    // En hämtning per sida: speldatum på samma produktionssida delar svaret.
    const pages = new Map<string, MarkupPrice>();
    const found: Array<{ t: Target; price: string; via: PriceVia }> = [];
    const missed: Target[] = [];
    // Torr-stoppet gäller bara värdar som aldrig gett ett pris (se isResting).
    const neverHit = lifetimeHits(host) === 0;

    for (const t of targets) {
        if (!pages.has(t.fetchUrl)) {
            // Omprövningen måste se varje sida — annars står gamla priser kvar oprövade.
            if (!RECHECK && neverHit && stats.tried >= DRY_HOST_AFTER && stats.hits === 0) { stats.stoppedDry = true; break; }
            if (stats.tried > 0) await new Promise((r) => setTimeout(r, HOST_PAUSE_MS));
            const res = await fetchPage(t.fetchUrl);
            if ('error' in res) {
                stats.errors++;
                // Värden svarar inte — sluta hamra, och räkna inget som försök.
                if (stats.errors >= 5 && stats.hits === 0) { stats.stoppedDry = true; break; }
                continue;
            }
            stats.tried++;
            const read = 'html' in res ? readMarkupPrice(res.html) : {};
            pages.set(t.fetchUrl, read);
            if (read.price) stats.hits++;
        }
        const read = pages.get(t.fetchUrl)!;
        if (read.price && read.via) found.push({ t, price: read.price, via: read.via }); else missed.push(t);
    }

    const trusted = TRUSTED.has(host);
    const all = [...pages.values()];
    // Sidmallens belopp (samma på nästan alla sidor) är inte eventets pris.
    const held = trusted ? null : templatePrice(found.map((f) => ({ price: f.price, title: f.t.title })));
    stats.held = held;
    // JSON-LD-flaggan ensam räknas först när värden också visat false på någon
    // sida — annars kan true vara sajtens förval (Hörby: true på allt).
    const flagProven = trusted || all.some((p) => p.flagFalse);
    for (const { t, price, via } of found) {
        if (held && price === held) { missed.push(t); continue; }
        if (via === 'ld-gratisflagga' && !flagProven) { stats.flagHeld++; missed.push(t); continue; }
        if (RECHECK && price === t.written) { stats.kept++; continue; }   // priset håller
        stats.written++;
        const note = RECHECK ? ` (var ${t.written})` : '';
        if (samples.length < 40) samples.push(`  ${price.padEnd(13)} ${t.title.slice(0, 44).padEnd(44)} ${host}${note}`);
        audit(t, price, via);
        if (APPLY) await writePrice(t, price);
    }
    if (RECHECK) {
        // Sidan ger inget pris med dagens regler: det gamla står vi inte för.
        for (const t of missed) {
            stats.cleared++;
            if (samples.length < 40) samples.push(`  ${'(tas bort)'.padEnd(13)} ${t.title.slice(0, 44).padEnd(44)} ${host} (var ${t.written})`);
            if (AUDIT_FILE && APPLY) {
                try { fs.appendFileSync(AUDIT_FILE, [new Date().toISOString().slice(0, 10), '', 'omprövad-bort', t.url, t.title.replace(/\s+/g, ' ')].join('\t') + '\n'); } catch { /* spårloggen fäller inget */ }
            }
            if (APPLY) await writePrice(t, null);
        }
    } else if (APPLY) {
        for (const t of missed) bumpPriceRefineAttempts(t.url);
        if (stats.written > 0) setSyncMeta(hitsKey(host), String(lifetimeHits(host) + stats.written));
        else if (neverHit && stats.stoppedDry && stats.tried >= DRY_HOST_AFTER) setSyncMeta(dryKey(host), new Date().toISOString());
    }
    return stats;
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : `🔍 DRY-RUN${SAMPLE ? ' (--sample: 6 sidor per värd)' : ''} — kör med --apply för att skriva`);
    let rows: Row[];
    if (RECHECK) {
        // Omprövning: de event spårloggen säger att vi prissatt, och där det
        // priset fortfarande står kvar (ett pris någon annan satt rörs inte).
        if (!AUDIT_FILE || !fs.existsSync(AUDIT_FILE)) throw new Error('--recheck kräver en spårlogg (--audit=<fil>, eller --apply för standardloggen)');
        const audited = loadAudit(AUDIT_FILE);
        const get = sqlite.prepare('SELECT url, firestoreId, title, time, price FROM link_events WHERE url = ? AND hidden = 0 AND time >= ?');
        const now = new Date().toISOString();
        rows = [];
        for (const [url, price] of audited) {
            const r = get.get(url, now) as (Row & { price: string | null }) | undefined;
            if (r && price && (r.price ?? '').trim() === price) rows.push({ ...r, written: price });
        }
        console.log(`♻️  OMPRÖVNING: ${audited.size} adresser i spårloggen, ${rows.length} bär fortfarande priset vi satte`);
    } else {
        rows = sqlite.prepare(`
            SELECT url, firestoreId, title, time
            FROM link_events
            WHERE hidden = 0 AND time >= ?
              AND (price IS NULL OR TRIM(price) = '')
              AND COALESCE(priceRefineAttempts, 0) < ${MAX_ATTEMPTS}
            ORDER BY time ASC
        `).all(new Date().toISOString()) as Row[];
    }

    const byHost = new Map<string, Target[]>();
    const resting = new Set<string>();
    let skipped = 0;
    for (const r of rows) {
        const fetchUrl = priceRefineFetchUrl(r.url);
        const host = fetchUrl ? refineHost(fetchUrl) : null;
        if (!fetchUrl || !host || (ONLY_HOST && host !== ONLY_HOST)) { skipped++; continue; }
        if (!ONLY_HOST && !RECHECK && !resting.has(host) && isResting(host)) resting.add(host);
        if (resting.has(host)) { skipped++; continue; }
        const list = byHost.get(host) ?? [];
        if (list.length < PER_HOST) list.push({ ...r, fetchUrl, host });
        byHost.set(host, list);
    }
    console.log(`${rows.length} ${RECHECK ? 'event att ompröva' : 'framtida synliga event utan pris'} · ${skipped} hoppas (värd/SPA/filter, ${resting.size} vilande värdar) · ${byHost.size} värdar att prova`);

    // Budgeten varvas mellan värdarna, sedan körs varje värd för sig.
    const budget = roundRobin([...byHost.values()], LIMIT);
    const plan = new Map<string, Target[]>();
    for (const t of budget) plan.set(t.host, [...(plan.get(t.host) ?? []), t]);
    console.log(`Hämtar för ${budget.length} event hos ${plan.size} värdar (högst ${PER_HOST} per värd)\n`);

    const samples: string[] = [];
    const all = await mapPool([...plan.entries()], HOST_CONCURRENCY, ([host, targets]) => refineHostTargets(host, targets, samples));

    const withHits = all.filter((s) => s.hits > 0).sort((a, b) => b.written - a.written);
    const tried = all.reduce((n, s) => n + s.tried, 0);
    const hits = all.reduce((n, s) => n + s.hits, 0);
    const written = all.reduce((n, s) => n + s.written, 0);
    if (RECHECK) {
        const kept = all.reduce((n, s) => n + s.kept, 0);
        const cleared = all.reduce((n, s) => n + s.cleared, 0);
        console.log(`♻️  Omprövat: ${kept} priser håller · ${written} ${APPLY ? 'ändrade' : 'skulle ändras'} · ${cleared} ${APPLY ? 'borttagna' : 'skulle tas bort'}`);
        for (const s of all.filter((x) => x.written + x.cleared > 0).sort((a, b) => (b.written + b.cleared) - (a.written + a.cleared)).slice(0, 40)) {
            console.log(`  ${s.host}: ${s.kept} håller, ${s.written} ändras, ${s.cleared} tas bort`);
        }
    }
    console.log(`💰 Pris på ${hits} av ${tried} hämtade sidor → ${written} event ${APPLY ? 'fick pris' : 'skulle få pris (dry-run)'}`);
    console.log('  sidor träff event  värd');
    for (const s of withHits.slice(0, 80)) {
        const notes = [
            s.held ? `⚠️ hålls tillbaka: "${s.held}" på nästan alla sidor (sidmall?)` : '',
            s.flagHeld ? `⚠️ ${s.flagHeld} event med bara gratisflagga, värden har aldrig visat false` : '',
        ].filter(Boolean).join(' · ');
        console.log(`  ${String(s.tried).padStart(5)} ${String(s.hits).padStart(5)} ${String(s.written).padStart(5)}  ${s.host}${notes ? `   ${notes}` : ''}`);
    }
    const dry = all.filter((s) => s.hits === 0 && s.tried > 0).sort((a, b) => b.tried - a.tried);
    console.log(`\n🚫 Värdar utan en enda träff (${dry.length}): ${dry.slice(0, 40).map((s) => `${s.host} ${s.tried}`).join(', ')}`);
    const failing = all.filter((s) => s.errors > 0).sort((a, b) => b.errors - a.errors);
    if (failing.length) console.log(`\n⚠️ Nätfel: ${failing.slice(0, 20).map((s) => `${s.host} ${s.errors}`).join(', ')}`);
    if (samples.length) console.log('\nExempel:\n' + samples.join('\n'));
    if (!APPLY) console.log('\nDry-run — inget skrivet.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
