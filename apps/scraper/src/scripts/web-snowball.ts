/**
 * web-snowball.ts — snöboll för webben: venues/arrangörer som dyker upp i vår
 * egen eventdata probas automatiskt för egna eventkalendrar. Webbens motsvarighet
 * till FB-snöbollen (tools/fb-snowball), fast för sajter.
 *
 *   npm run web-snowball                 # full veckokörning
 *   npm run web-snowball -- --dry        # proba + smoke, skriv INGEN registry-fil
 *   npm run web-snowball -- --max=10     # cappa antal kandidater (default 40)
 *   npm run web-snowball -- --candidates=fil.txt   # riktat svep: egen lista i
 *       stället för skörd; rad = "Namn|region|https://bas|Stad" (stad valfri)
 *
 * Kedjan (allt måste passera innan en källa går live):
 *   1. SKÖRD    — domäner ur event-beskrivningarnas länkar (hög precision:
 *                 arrangören hänvisar själv dit) + slug-gissning för
 *                 återkommande hostNames utan känd domän (låg precision,
 *                 verifieras hårt i steg 2-3).
 *   2. PROBE    — bulk-probe (Tribe / wp-v2 / sitemap+JSON-LD): finns
 *                 strukturerad eventdata med riktiga startdatum?
 *   3. SMOKE    — motorn körs PÅ RIKTIGT (ingen DB-skrivning) och eventen
 *                 rimlighetskontrolleras: antal, datumspridning, titelkvalitet
 *                 (längd, unikhet, junk-ord), Sverige-signal. Detta är svaret
 *                 på "titlar kan vara vad som helst på en okänd sida".
 *   4. GENERATE — godkända skrivs till sources/registry-snowball.ts som
 *                 status 'experimental' + tsc-vakt (failar typkollen rullas
 *                 filen tillbaka).
 *
 * Skyddsnät i drift: nattens AI-audit/hide-junk städar innehåll, och
 * auto-karantänen pausar källor som slutar leverera.
 *
 * Minne: web-snowball-state.json — varje probad domän får verdikt + datum så
 * samma FAIL inte re-probas varje vecka (re-probe efter RETRY_FAILED_DAYS).
 *
 * Loggmarkörer (för Teams/log-grep): "🕸️ SNÖBOLL:"-rader.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import Database from 'better-sqlite3';
import { ENGINES } from '../sources';
import { SOURCES } from '../sources/registry';
import { SNOWBALL_SOURCES } from '../sources/registry-snowball';
import { Source, RawEvent, EngineContext } from '../sources/types';
import { getSqlitePath } from '../utils/sqliteHelper';
import { closeJsonLdBrowser } from '../sources/engines/json-ld';
import { closeXhrDiscoveryBrowser } from '../sources/engines/xhr-discovery';
import { closeSitemapBrowser } from '../sources/engines/sitemap';

const SCRAPER_DIR = path.resolve(__dirname, '../..');
const STATE_PATH = path.join(SCRAPER_DIR, 'web-snowball-state.json');
const SNOWBALL_TS = path.join(SCRAPER_DIR, 'src/sources/registry-snowball.ts');

const MAX_CANDIDATES = 40;        // per veckokörning
const MAX_SLUG_GUESSES = 12;      // lågprecisions-delen cappas hårdare
const RETRY_FAILED_DAYS = 90;     // re-proba FAIL-domäner först efter ~kvartal
const SMOKE_WINDOW_DAYS = 180;
const SMOKE_MIN_EVENTS = 3;

// Domäner som aldrig är kandidater: sociala medier, biljett-plattformar vi
// redan täcker via egna källor, länkkortare, kartor, myndighets-generiskt.
const DOMAIN_BLOCKLIST = /(?:^|\.)(facebook|fb|instagram|youtube|youtu|spotify|tiktok|linkedin|twitter|x|google|goo|maps|bit|tinyurl|mailchi|forms|docs|drive|apple|microsoft|teams|zoom|live|eventbrite|ticketmaster|tickster|billetto|nortic|axs|dice|visitsweden|wikipedia|eduadmin|sportadmin|hembygd|svenskakyrkan|naturskyddsforeningen|rodakorset|friluftsframjandet|korpen|riksteatern|bilda|medborgarskolan|studieframjandet|raceid|pro|abf|sv|kulturhusetstadsteatern)\.(?:com|se|nu|org|net|ly|be|fm|me|co)$/i;

interface StateEntry { verdict: 'PASS' | 'FAIL' | 'DUPE' | 'SMOKE-FAIL'; date: string; note?: string }
interface StateFile { version: 1; domains: Record<string, StateEntry> }

function loadState(): StateFile {
    try {
        const p = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
        if (p?.version === 1) return p;
    } catch { /* tom */ }
    return { version: 1, domains: {} };
}
function saveState(s: StateFile) {
    s.domains = Object.fromEntries(Object.entries(s.domains).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n');
}

function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysSince(iso: string): number {
    return Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86_400_000);
}

/** Alla domäner som redan finns i registry/snowball — samma teknik som bulk-probe. */
function existingDomains(): Set<string> {
    const out = new Set<string>();
    for (const f of ['registry.ts', 'registry-snowball.ts']) {
        const txt = fs.readFileSync(path.join(SCRAPER_DIR, 'src/sources', f), 'utf8');
        for (const m of txt.matchAll(/https?:\/\/(?:www\.)?([a-z0-9.-]+)/gi)) {
            const host = m[1].split('/')[0].toLowerCase();
            out.add(host);
            out.add(baseDomain(host));   // "visit.norrkoping.se" täcker även "norrkoping.se"-basen
        }
    }
    return out;
}

function baseDomain(host: string): string {
    // "www.foo.se" → "foo.se"; behåll subdomän för t.ex. "kalender.foo.se"? Nej —
    // proben körs mot roten; event-sitemaps ligger nästan alltid där.
    const parts = host.toLowerCase().replace(/^www\./, '').split('.');
    return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.');
}

/** Full URL eller host(+path) → basdomän ("https://www.foo.se/bar.xml" → "foo.se"). */
function domainFromUrl(url: string): string {
    return baseDomain(String(url).replace(/^https?:\/\//, '').split('/')[0]);
}

/** Probe-configens huvud-URL oavsett engine-typ (wp-rest: baseUrl, sitemap: sitemapUrl, sitevision: urls[0]). */
function configMainUrl(config: any): string {
    return String(config?.baseUrl ?? config?.sitemapUrl ?? config?.urls?.[0] ?? '');
}

/** "vastsverige.com" → "Vastsverige" — visningsnamn när sajten själv är okänd. */
function prettyName(domain: string): string {
    const stem = domain.split('.')[0];
    return stem.charAt(0).toUpperCase() + stem.slice(1);
}

interface Candidate { name: string; region: string; base: string; domain: string; refs: number; via: 'beskrivning' | 'slug-gissning' | 'fil'; sample?: string; city?: string }

// ─── 1. SKÖRD ────────────────────────────────────────────────────────────────

function harvestCandidates(max: number): Candidate[] {
    const db = new Database(getSqlitePath(), { readonly: true });
    const existing = existingDomains();
    const state = loadState();
    const seen = new Map<string, Candidate>();

    const skip = (domain: string): boolean => {
        if (existing.has(domain) || existing.has('www.' + domain)) return true;
        if (DOMAIN_BLOCKLIST.test(domain)) return true;
        const st = state.domains[domain];
        if (st && (st.verdict === 'DUPE' || daysSince(st.date) < RETRY_FAILED_DAYS)) return true;
        return false;
    };

    // 1a. Länkar i beskrivningar (framtida, ej dolda event)
    const rows = db.prepare(`
        SELECT description, title, hostName, locationName
        FROM link_events
        WHERE hidden = 0 AND time > datetime('now')
          AND (description LIKE '%http%' OR description LIKE '%www.%')
    `).all() as { description: string; title: string; hostName: string; locationName: string }[];

    for (const r of rows) {
        const urls = r.description.matchAll(/(?:https?:\/\/|www\.)([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi);
        for (const m of urls) {
            const domain = baseDomain(m[1]);
            if (!/\.(se|nu|com|org|net)$/.test(domain) || skip(domain)) continue;
            const c = seen.get(domain);
            if (c) { c.refs++; continue; }
            seen.set(domain, {
                name: r.hostName || r.locationName || domain.split('.')[0],
                region: 'national',
                base: `https://${domain}`,
                domain, refs: 1, via: 'beskrivning',
                sample: r.title?.slice(0, 60),
            });
        }
    }

    // 1b. Slug-gissning: arrangörer vi ENBART känner via Facebook (≥5 framtida
    // event, ≥80% FB-URL:er). Arrangörer med webbkällor skrapas ju redan —
    // FB-only-arrangörernas sajter är de vi saknar.
    const hosts = db.prepare(`
        SELECT hostName, COUNT(*) AS n
        FROM link_events
        WHERE hidden = 0 AND time > datetime('now')
          AND hostName IS NOT NULL AND hostName != ''
        GROUP BY hostName
        HAVING n >= 5
           AND SUM(CASE WHEN url LIKE '%facebook.com%' THEN 1 ELSE 0 END) * 1.0 / COUNT(*) >= 0.8
        ORDER BY n DESC LIMIT 300
    `).all() as { hostName: string; n: number }[];

    let guesses = 0;
    for (const h of hosts) {
        if (guesses >= MAX_SLUG_GUESSES) break;
        const slug = h.hostName.toLowerCase()
            .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
            .replace(/[^a-z0-9]+/g, '');
        if (slug.length < 4 || slug.length > 30) continue;
        const domain = `${slug}.se`;
        if (seen.has(domain) || skip(domain)) continue;
        seen.set(domain, {
            name: h.hostName, region: 'national', base: `https://${domain}`,
            domain, refs: h.n, via: 'slug-gissning',
        });
        guesses++;
    }

    db.close();
    return [...seen.values()]
        .sort((a, b) => (b.via === 'beskrivning' ? b.refs : b.refs / 10) - (a.via === 'beskrivning' ? a.refs : a.refs / 10))
        .slice(0, max);
}

/**
 * Kandidater ur fil (--candidates=fil): rad = "Namn|region|https://bas|Stad".
 * Stad (kolumn 4, valfri) blir defaultCity — för riktade stads-sveper vet vi
 * ju staden, till skillnad från snöbollens egna fynd. Samma dedup/blocklist/
 * state-filter som skörden, så redan täckta domäner och färska FAILs hoppas.
 */
function candidatesFromFile(file: string, max: number): Candidate[] {
    const existing = existingDomains();
    const state = loadState();
    const out: Candidate[] = [];
    const lines = fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    for (const line of lines) {
        const [name, region, base, city] = line.split('|').map((p) => p.trim());
        if (!base) { console.log(`   hoppar rad utan bas-URL: "${line}"`); continue; }
        const domain = domainFromUrl(base);
        if (existing.has(domain) || existing.has('www.' + domain)) { console.log(`   redan i registry: ${domain}`); continue; }
        if (DOMAIN_BLOCKLIST.test(domain)) { console.log(`   blocklistad: ${domain}`); continue; }
        const st = state.domains[domain];
        if (st && (st.verdict === 'DUPE' || daysSince(st.date) < RETRY_FAILED_DAYS)) { console.log(`   nyligen probad (${st.verdict} ${st.date}): ${domain}`); continue; }
        out.push({ name: name || prettyName(domain), region: region || 'national', base, domain, refs: 0, via: 'fil', city: city || undefined });
    }
    return out.slice(0, max);
}

// ─── 3. SMOKE ────────────────────────────────────────────────────────────────

/** "/foo/i"-sträng → RegExp (bulk-probes sitemap-pattern-format). */
function parseRegexLiteral(s: unknown): RegExp | unknown {
    if (typeof s !== 'string') return s;
    const m = s.match(/^\/(.*)\/([a-z]*)$/s);
    return m ? new RegExp(m[1], m[2]) : s;
}

interface SmokeVerdict { ok: boolean; reasons: string[]; events: number; sampleTitles: string[]; allTitles: string[] }

export function judgeEvents(raw: RawEvent[], windowStart: Date, windowEnd: Date, domain: string): SmokeVerdict {
    const reasons: string[] = [];
    const future = raw.filter((e) => e.startDate instanceof Date && !isNaN(+e.startDate)
        && e.startDate >= windowStart && e.startDate < windowEnd);

    if (future.length < SMOKE_MIN_EVENTS) {
        return { ok: false, reasons: [`bara ${future.length} framtida event (kräver ≥${SMOKE_MIN_EVENTS})`], events: future.length, sampleTitles: [], allTitles: [] };
    }
    const titles = future.map((e) => (e.title ?? '').trim());

    const okLen = titles.filter((t) => t.length >= 3 && t.length <= 120).length;
    if (okLen / titles.length < 0.8) reasons.push(`titellängder orimliga (${okLen}/${titles.length} inom 3–120 tecken)`);

    const hasLetters = titles.filter((t) => /\p{L}{2}/u.test(t)).length;
    if (hasLetters / titles.length < 0.9) reasons.push('titlar utan bokstäver');

    const distinct = new Set(titles.map((t) => t.toLowerCase())).size;
    if (distinct / titles.length < 0.5) reasons.push(`titlar repeteras (${distinct} unika av ${titles.length})`);

    const JUNK = /cookie|integritetspolicy|personuppgift|logga in|meny|sök|404|not found|error|javascript|until\b|read more|läs mer$/i;
    const junky = titles.filter((t) => JUNK.test(t)).length;
    if (junky / titles.length > 0.2) reasons.push(`junk-ord i ${junky} titlar (navigation/cookies?)`);

    // Sverige-signal: .se/.nu-domän räcker; annars kräv svenska tecken/ord i innehållet
    const swedishDomain = /\.(se|nu)$/.test(domain);
    if (!swedishDomain) {
        const sv = future.filter((e) =>
            /[åäöÅÄÖ]/.test(`${e.title} ${e.city ?? ''} ${e.address ?? ''} ${e.description ?? ''}`)).length;
        if (sv / future.length < 0.3) reasons.push('ingen Sverige-signal (utländsk domän + inga svenska tecken)');
    }

    // Datumspridning: allt på exakt samma timestamp ⇒ trolig parse-artefakt
    const stamps = new Set(future.map((e) => +e.startDate));
    if (stamps.size === 1 && future.length >= 5) reasons.push('alla event på samma timestamp (datumparse trasig?)');

    return { ok: reasons.length === 0, reasons, events: future.length, sampleTitles: titles.slice(0, 3), allTitles: titles };
}

async function smokeTest(suggestion: any): Promise<SmokeVerdict> {
    const engine = ENGINES[suggestion.engine as keyof typeof ENGINES];
    if (!engine) return { ok: false, reasons: [`okänd engine ${suggestion.engine}`], events: 0, sampleTitles: [], allTitles: [] };

    const config = { ...suggestion.config };
    if (Array.isArray(config.urlPatterns)) config.urlPatterns = config.urlPatterns.map(parseRegexLiteral);
    if (typeof config.detailPattern === 'string') config.detailPattern = parseRegexLiteral(config.detailPattern);
    if (config.maxUrls) config.maxUrls = Math.min(config.maxUrls, 60);   // smoke ska vara snabb
    if (config.maxPages) config.maxPages = Math.min(config.maxPages, 1);

    const windowStart = new Date(); windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart.getTime() + SMOKE_WINDOW_DAYS * 86_400_000);
    const ctx: EngineContext = { windowStart, windowEnd, log: () => { /* tyst */ } };

    try {
        const raw = await Promise.race([
            engine(config, ctx),
            new Promise<RawEvent[]>((_, rej) => setTimeout(() => rej(new Error('smoke-timeout 150s')), 150_000)),
        ]);
        const domain = domainFromUrl(configMainUrl(suggestion.config));
        return judgeEvents(raw, windowStart, windowEnd, domain);
    } catch (e: any) {
        return { ok: false, reasons: [`motorn kraschade: ${e?.message ?? e}`], events: 0, sampleTitles: [], allTitles: [] };
    }
}

// ─── 4. GENERATE ─────────────────────────────────────────────────────────────

function tsString(s: string): string {
    return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function configToTs(config: Record<string, any>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(config)) {
        if (k === 'urlPatterns' && Array.isArray(v)) {
            parts.push(`${k}: [${v.map((p) => (typeof p === 'string' && /^\/.*\/[a-z]*$/s.test(p) ? p : tsString(String(p)))).join(', ')}]`);
        } else if (k === 'detailPattern' && typeof v === 'string' && /^\/.*\/[a-z]*$/s.test(v)) {
            parts.push(`${k}: ${v}`);   // regex-literal som sträng → skriv rått
        } else if (typeof v === 'string') parts.push(`${k}: ${tsString(v)}`);
        else parts.push(`${k}: ${JSON.stringify(v)}`);
    }
    return `{ ${parts.join(', ')} }`;
}

function sourceToTs(s: {
    id: string; hostName: string; region: string; engine: string; config: Record<string, any>;
    probeUrl: string; rawEventCount: number; note: string;
}): string {
    const today = todayISO();
    return [
        '    {',
        `        id: ${tsString(s.id)},`,
        `        hostName: ${tsString(s.hostName)},`,
        `        region: ${tsString(s.region)},`,
        `        engine: ${tsString(s.engine)} as const,`,
        `        config: ${configToTs(s.config)},`,
        `        updateFrequency: 'every-3d' as const,`,
        `        status: 'experimental' as const,`,
        '        discovery: {',
        `            method: 'hint' as const,`,
        `            probeUrl: ${tsString(s.probeUrl)},`,
        `            date: ${tsString(today)},`,
        `            rawEventCount: ${s.rawEventCount},`,
        '        },',
        `        notes: ${tsString(s.note)},`,
        `        lastVerified: ${tsString(today)},`,
        '    },',
    ].join('\n');
}

function writeSnowballFile(newBlocks: string[]) {
    const current = fs.readFileSync(SNOWBALL_TS, 'utf8');
    const updated = current.replace(/\n\];\s*$/, '\n\n' + newBlocks.join('\n') + '\n];\n');
    fs.writeFileSync(SNOWBALL_TS, updated);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
    const dry = process.argv.includes('--dry');
    const maxArg = process.argv.find((a) => a.startsWith('--max='));
    const max = maxArg ? parseInt(maxArg.split('=')[1], 10) : MAX_CANDIDATES;
    const fileArg = process.argv.find((a) => a.startsWith('--candidates='));

    console.log(`🕸️ Webb-snöboll ${todayISO()} — max ${max} kandidater${dry ? ' (DRY-RUN)' : ''}${fileArg ? ` (fil: ${fileArg.split('=')[1]})` : ''}`);

    // 1. SKÖRD (eller manuell kandidatlista)
    const candidates = fileArg
        ? candidatesFromFile(fileArg.split('=')[1], max)
        : harvestCandidates(max);
    console.log(`🕸️ SNÖBOLL: ${candidates.length} kandidater (${candidates.filter((c) => c.via === 'beskrivning').length} ur beskrivningar, ${candidates.filter((c) => c.via === 'slug-gissning').length} slug-gissningar, ${candidates.filter((c) => c.via === 'fil').length} ur fil)`);
    if (!candidates.length) { console.log('Inget att göra.'); return; }
    for (const c of candidates.slice(0, 15)) console.log(`   ${c.domain.padEnd(32)} ${String(c.refs).padStart(3)} refs (${c.via})`);

    // 2. PROBE (via bulk-probe som subprocess — återanvänder dess hela logik)
    const candFile = path.join(SCRAPER_DIR, '.web-snowball-candidates.txt');
    const outFile = path.join(SCRAPER_DIR, '.web-snowball-suggestions.json');
    fs.writeFileSync(candFile, candidates.map((c) => `${c.name}|${c.region}|${c.base}`).join('\n') + '\n');
    try {
        execFileSync('npx', ['ts-node', 'src/scripts/bulk-probe.ts', candFile, '--json', outFile], {
            cwd: SCRAPER_DIR, stdio: 'inherit', timeout: 20 * 60_000,
            env: { ...process.env, BULK_MIN_EVENTS: '5' },
        });
    } catch (e: any) {
        console.error(`🕸️ SNÖBOLL-FEL: bulk-probe kraschade: ${e?.message}`);
    }
    const suggestions: any[] = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : [];
    console.log(`🕸️ SNÖBOLL: ${suggestions.length} klarade proben`);

    // Verdikt-bokföring för alla probade
    const state = loadState();
    const passedDomains = new Set(suggestions.map((s: any) =>
        domainFromUrl(configMainUrl(s.config))));
    for (const c of candidates) {
        state.domains[c.domain] = passedDomains.has(c.domain)
            ? { verdict: 'PASS', date: todayISO() }
            : { verdict: 'FAIL', date: todayISO(), note: 'bulk-probe' };
    }

    // 3. SMOKE — sekventiellt (snällt mot sajterna, enkel felsökning)
    const approved: string[] = [];
    const existingIds = new Set([...SOURCES, ...SNOWBALL_SOURCES].map((s: Source) => s.id));
    // Innehålls-fingeravtryck: samma SiteVision-installation kan svara på flera
    // domäner (norraberget.se == visitsundsvall.se) — jämför titeluppsättningar
    // mellan godkända i samma körning och avvisa innehålls-dubbletter.
    const approvedTitleSets: { id: string; titles: Set<string> }[] = [];
    for (const sug of suggestions) {
        const domain = domainFromUrl(configMainUrl(sug.config));
        const cand = candidates.find((c) => c.domain === domain);
        let id = `sb-${domain.replace(/\./g, '-')}`;
        if (existingIds.has(id)) id = `${id}-2`;

        // Hänvisande eventets hostName/stad säger inget om SAJTENS namn/stad —
        // neutralt domännamn + tom defaultCity (geokodningen tar eventadressen).
        // Undantag: fil-kandidater där vi angett stad explicit.
        const displayName = cand?.via === 'beskrivning' ? prettyName(domain) : (cand?.name ?? prettyName(domain));
        sug.config = { ...sug.config, defaultCity: cand?.city ?? '' };

        process.stdout.write(`   smoke: ${domain.padEnd(32)} `);
        const v = await smokeTest(sug);
        if (!v.ok) {
            console.log(`❌ ${v.reasons.join('; ')}`);
            state.domains[domain] = { verdict: 'SMOKE-FAIL', date: todayISO(), note: v.reasons[0] };
            continue;
        }
        const mine = new Set(v.allTitles.map((t) => t.toLowerCase()));
        const dupOf = approvedTitleSets.find((a) => {
            const inter = [...mine].filter((t) => a.titles.has(t)).length;
            return inter / Math.min(mine.size, a.titles.size) >= 0.6;
        });
        if (dupOf) {
            console.log(`❌ innehålls-dubblett av ${dupOf.id} (samma kalender på flera domäner)`);
            state.domains[domain] = { verdict: 'DUPE', date: todayISO(), note: `samma innehåll som ${dupOf.id}` };
            continue;
        }
        approvedTitleSets.push({ id, titles: mine });
        console.log(`✅ ${v.events} event, t.ex. ${v.sampleTitles.map((t) => `"${t.slice(0, 40)}"`).join(', ')}`);

        const note = `web-snöboll ${todayISO()}: ${sug.method}, smoke ${v.events} event ok. ` +
            (cand?.via === 'beskrivning' ? `Hänvisad av ${cand.refs} event i DB (t.ex. "${cand.sample ?? ''}").`
                : cand?.via === 'fil' ? `Manuell kandidatlista (stads-svep).`
                : `Slug-gissning från arrangör "${cand?.name}" (${cand?.refs} event i DB).`);
        approved.push(sourceToTs({
            id, hostName: displayName, region: cand?.region ?? 'national',
            engine: sug.engine, config: sug.config,
            probeUrl: configMainUrl(sug.config),
            rawEventCount: v.events, note,
        }));
        existingIds.add(id);
    }

    await Promise.allSettled([closeJsonLdBrowser?.(), closeXhrDiscoveryBrowser?.(), closeSitemapBrowser?.()]);
    if (!dry) saveState(state);       // dry-run lämnar inga spår
    fs.rmSync(candFile, { force: true }); fs.rmSync(outFile, { force: true });

    // 4. GENERATE + tsc-vakt
    if (!approved.length) {
        console.log('🕸️ SNÖBOLL: 0 nya källor denna vecka (allt föll i probe/smoke)');
        return;
    }
    if (dry) {
        console.log(`🕸️ SNÖBOLL (dry): ${approved.length} källor SKULLE lagts till:`);
        console.log(approved.join('\n'));
        return;
    }
    writeSnowballFile(approved);
    try {
        execFileSync('npx', ['tsc', '--noEmit'], { cwd: SCRAPER_DIR, stdio: 'pipe', timeout: 5 * 60_000 });
    } catch (e: any) {
        console.error('🕸️ SNÖBOLL-FEL: tsc-vakten fällde genererade filen — rullar tillbaka.');
        console.error(String(e?.stdout ?? e?.message).slice(0, 2000));
        execFileSync('git', ['checkout', '--', SNOWBALL_TS], { cwd: SCRAPER_DIR });
        process.exit(1);
    }
    const ids = approved.map((b) => b.match(/id: '([^']+)'/)?.[1]).filter(Boolean);
    console.log(`🕸️ SNÖBOLL: +${approved.length} nya källor live (${ids.join(', ')}) — status experimental, live från nästa nattkörning`);
}

main().catch((e) => { console.error('🕸️ SNÖBOLL-FEL (fatal):', e); process.exit(1); });
