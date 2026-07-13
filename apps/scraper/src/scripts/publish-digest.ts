/**
 * publish-digest.ts — Daglig 10-event-lista som lockar engagemang.
 *
 * Flöde (v2 — rankat urval, alltid 10 med bild):
 *   1. Hämta dagens event ur events.db — bild (http/https-coverImage) KRÄVS,
 *      titel ≤ 40 tecken, inte hidden, verifierad plats.
 *   2. Ranka: kvällsevent först (kl 20 högst, 18–21 högt) + bildkvalitet
 *      (dimensioner probas över nätet — stora bilder och IG-vänlig aspekt
 *      vinner, oåtkomlig/trasig bild diskvalificerar).
 *   3. Välj OVERPICK_COUNT (14) i rankad ordning med spridningskvot
 *      (max 1/stad, max 2/kategori) — plats 11–14 är reserver så
 *      publiceringen fyller upp till EXAKT 10 slides även om Instagram
 *      avvisar någon bild.
 *   4. Räkna totalt antal event idag (för "minst X event"-headern)
 *   5. Skicka utkast till Telegram + approval-loop
 *      • "byt N"       → byt event N (rankat bästa ersättare)
 *      • "byt N,M,K"   → byt flera
 *      • "bild N URL"  → sätt bild för N (DB + Firestore)
 *      • "nytt"        → byt alla
 *      • "klar"        → 📲 publicera till Instagram + Facebook
 *      • "stopp"       → avbryt
 *
 * Körning:  npm run digest
 * Daemon:   /list10 spawnar detta script
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import probe from 'probe-image-size';
import { sendMessage, waitForReply, flushPendingUpdates, isTelegramConfigured } from '../utils/telegram';
import { setEventImage, isValidImageUrl } from '../utils/setEventImage';
import { postToInstagram, postToFacebook, isInstagramConfigured, isFacebookConfigured } from '../utils/socialPublish';

// ── Lock-fil ─────────────────────────────────────────────────────────────────
const LOCK_FILE = '/tmp/vadkul-publish-digest.lock';

function acquireLock(): boolean {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
            process.kill(pid, 0);
            console.log(`⛔ publish-digest redan igång (PID ${pid}). Avslutar.`);
            return false;
        } catch {
            try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ }
        }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ } };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(130); });
    process.on('SIGTERM', () => { cleanup(); process.exit(143); });
    return true;
}

// ── Ladda hemligheter (TG_BOT_TOKEN, TG_CHAT_ID) ─────────────────────────────
const secretFile = path.join(process.env.HOME || '~', '.vadkul-secrets/env');
if (fs.existsSync(secretFile)) {
    const raw = fs.readFileSync(secretFile, 'utf-8');
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/);
        if (m) process.env[m[1]] = m[2];
    }
}

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

const MAX_TITLE_LEN = 40;
const TARGET_COUNT  = 10;
// Över-välj: plats 11–14 är reserver som fyller upp karusellen till exakt
// TARGET_COUNT om Instagram avvisar någon bild (fel aspect ratio o.dyl.).
const OVERPICK_COUNT = 14;

// Bildprobning (dimensioner hämtas över nätet — bara headerbytes läses).
const PROBE_TIMEOUT_MS     = 8_000;
const PROBE_CONCURRENCY    = 6;
const PROBE_BATCH          = 40;   // proba så här många kandidater åt gången
const MAX_PROBES_PER_RUN   = 200;  // tak så en dag med många trasiga bilder inte drar iväg

// ── Typdefinitioner ──────────────────────────────────────────────────────────

interface EventRow {
    url: string;
    title: string;
    time: string;
    locationName: string;
    extractedAddress: string | null;
    geocodedQuery: string | null;
    category: string;
    hostName: string;
    lat: number;
    lng: number;
    coverImage: string | null;
}

interface DigestEvent extends EventRow {
    city: string;
    cleanTitle: string;
    /** Rankingpoäng (kvällstid + bildkvalitet). Sätts av rankByScore. */
    score?: number;
}

// De ~150 vanligaste svenska tätorterna. Räcker för att matcha det mesta vi
// scrapar (Eventbrite, kommuners egna sajter, FB-events). Sorterad efter
// längd så vi matchar "Lidköping" före "Lid".
const SWEDISH_CITIES: string[] = [
    'Stockholm', 'Göteborg', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro',
    'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle',
    'Borås', 'Eskilstuna', 'Södertälje', 'Halmstad', 'Växjö', 'Karlstad', 'Sundsvall',
    'Östersund', 'Trollhättan', 'Luleå', 'Kalmar', 'Karlskrona', 'Kristianstad',
    'Skövde', 'Skellefteå', 'Uddevalla', 'Varberg', 'Motala', 'Falun', 'Landskrona',
    'Tumba', 'Nyköping', 'Borlänge', 'Trelleborg', 'Ystad', 'Kungsbacka', 'Sandviken',
    'Lidköping', 'Karlskoga', 'Visby', 'Piteå', 'Sollentuna', 'Hässleholm', 'Märsta',
    'Örnsköldsvik', 'Enköping', 'Alingsås', 'Lerum', 'Härnösand', 'Mariestad',
    'Köping', 'Kiruna', 'Falkenberg', 'Mölndal', 'Partille', 'Vänersborg', 'Ängelholm',
    'Nässjö', 'Värnamo', 'Kungälv', 'Strängnäs', 'Sala', 'Mjölby', 'Bollnäs', 'Boden',
    'Lindesberg', 'Eslöv', 'Tranås', 'Vetlanda', 'Vimmerby', 'Avesta', 'Söderhamn',
    'Hudiksvall', 'Hässelby', 'Hammarby', 'Solna', 'Sundbyberg', 'Lidingö', 'Täby',
    'Vallentuna', 'Åkersberga', 'Norrtälje', 'Värmdö', 'Nacka', 'Tyresö', 'Haninge',
    'Huddinge', 'Botkyrka', 'Järfälla', 'Upplands Väsby', 'Sigtuna', 'Vaxholm',
    'Sölvesborg', 'Olofström', 'Ronneby', 'Karlshamn', 'Tomelilla', 'Simrishamn',
    'Höör', 'Höganäs', 'Bjuv', 'Klippan', 'Perstorp', 'Skurup', 'Svedala', 'Vellinge',
    'Burlöv', 'Staffanstorp', 'Hörby', 'Sjöbo', 'Osby', 'Östra Göinge', 'Bromölla',
    'Åstorp', 'Båstad', 'Kungshamn', 'Lysekil', 'Strömstad', 'Tanum', 'Munkedal',
    'Sotenäs', 'Färgelanda', 'Mellerud', 'Bengtsfors', 'Dals-Ed', 'Åmål', 'Säffle',
    'Hagfors', 'Sunne', 'Torsby', 'Arvika', 'Filipstad', 'Storfors', 'Kil', 'Forshaga',
    'Munkfors', 'Grums', 'Hammarö', 'Årjäng', 'Eda', 'Hällefors', 'Nora', 'Askersund',
    'Ljusnarsberg', 'Hallsberg', 'Kumla', 'Laxå', 'Degerfors', 'Lekeberg', 'Pajala',
    'Gällivare', 'Jokkmokk', 'Arvidsjaur', 'Älvsbyn', 'Haparanda', 'Övertorneå',
    'Kalix', 'Överkalix', 'Robertsfors', 'Vindeln', 'Vännäs', 'Bjurholm', 'Nordmaling',
    'Lycksele', 'Storuman', 'Sorsele', 'Malå', 'Norsjö', 'Vilhelmina', 'Åsele',
    'Dorotea', 'Strömsund', 'Krokom', 'Ragunda', 'Bräcke', 'Berg', 'Härjedalen',
    'Åre', 'Tärnaby', 'Funäsdalen', 'Sveg', 'Mora', 'Orsa', 'Älvdalen', 'Malung',
    'Vansbro', 'Leksand', 'Rättvik', 'Gagnef', 'Smedjebacken', 'Hedemora', 'Säter',
    'Älmhult', 'Tingsryd', 'Lessebo', 'Markaryd', 'Älvkarleby', 'Heby', 'Knivsta',
    'Tierp', 'Östhammar', 'Håbo', 'Bjästa', 'Gnesta', 'Trosa', 'Vingåker', 'Katrineholm',
    'Flen', 'Oxelösund', 'Skärblacka', 'Ödeshög', 'Mjölby', 'Kinda', 'Boxholm',
    'Vadstena', 'Söderköping', 'Valdemarsvik', 'Finspång', 'Åtvidaberg',
    'Mariefred', 'Skara', 'Götene', 'Tibro', 'Tidaholm', 'Hjo', 'Karlsborg', 'Falköping',
    'Töreboda', 'Mullsjö', 'Habo', 'Aneby', 'Eksjö', 'Sävsjö', 'Gnosjö', 'Gislaved',
    'Vaggeryd', 'Ulricehamn', 'Tranemo', 'Svenljunga', 'Mark', 'Bollebygd', 'Herrljunga',
    'Vårgårda', 'Lilla Edet', 'Stenungsund', 'Tjörn', 'Skärhamn', 'Orust', 'Henån',
    'Kungsör', 'Hallstahammar', 'Surahammar', 'Skinnskatteberg', 'Fagersta', 'Norberg',
    'Arboga',
];

// Bygg en case-insensitive sökning. Sortera efter längd så längre städer
// (ex "Lidköping") matchas före kortare ("Lid").
// OBS: inte \b — JS ordgränser är ASCII-baserade, så städer som börjar/slutar
// på å/ä/ö (Malmö, Umeå, Örebro, Luleå, Växjö…) matchade aldrig med \bstad\b.
// Lookarounds med svenskt bokstavsspann ger riktiga ordgränser.
const CITY_INDEX = [...SWEDISH_CITIES].sort((a, b) => b.length - a.length);
const SWEDISH_LETTER = 'A-Za-zÅÄÖåäöÉé';
const CITY_REGEX = new RegExp(
    `(?<![${SWEDISH_LETTER}])(${CITY_INDEX.map(c => c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})(?![${SWEDISH_LETTER}])`,
    'i'
);

// Kanonisk form (för dedupering — "Gothenburg" → "Göteborg")
const CITY_ALIAS: Record<string, string> = {
    gothenburg: 'Göteborg',
};

function canonicalCity(match: string): string {
    const k = match.toLowerCase();
    if (CITY_ALIAS[k]) return CITY_ALIAS[k];
    // Hitta original-casing i index
    const exact = CITY_INDEX.find(c => c.toLowerCase() === k);
    return exact || match;
}

// ── Datum-helper ─────────────────────────────────────────────────────────────

function todayBounds(): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
}

// ── Stad-heuristik ───────────────────────────────────────────────────────────

/**
 * Plocka stad genom att leta efter en känd svensk stad i något av fälten.
 * Letar i prioritetsordning: geocodedQuery → extractedAddress → locationName
 * → hostName → title. Första match vinner. Returnerar '' om ingen träff.
 */
function extractCity(row: {
    locationName?: string | null;
    extractedAddress?: string | null;
    geocodedQuery?: string | null;
    hostName?: string | null;
    title?: string | null;
}): string {
    const candidates = [
        row.geocodedQuery,
        row.extractedAddress,
        row.locationName,
        row.hostName,
        row.title,
    ];
    for (const c of candidates) {
        if (!c) continue;
        const m = c.match(CITY_REGEX);
        if (m) return canonicalCity(m[1]);
    }
    return '';
}

/** Trimma titel — ta bort vanliga skräppattern, klipp om för lång. */
function cleanTitle(raw: string): string {
    let t = raw.trim();
    // Vanliga ändelser vi inte vill se ("- Eventbrite", "| Tickster")
    t = t.replace(/\s*[-–|]\s*(Eventbrite|Tickster|Meetup|Eventim|Upplev)\s*$/i, '');
    // Kollapsa whitespace
    t = t.replace(/\s+/g, ' ').trim();
    return t;
}

// ── Hämta & filtrera kandidater ──────────────────────────────────────────────

function loadCandidates(db: Database.Database, excludedUrls: Set<string>): DigestEvent[] {
    const { start, end } = todayBounds();
    const rows = db.prepare(`
        SELECT url, title, time, locationName, extractedAddress, geocodedQuery,
               category, hostName, lat, lng, coverImage
        FROM link_events
        WHERE datetime(time) >= datetime(?)
          AND datetime(time) <= datetime(?)
          AND (hidden IS NULL OR hidden = 0)
          AND isLocationVerified = 1
          AND lat BETWEEN 54.5 AND 71.5
          AND lng BETWEEN 4.5 AND 24.5
        ORDER BY time ASC
    `).all(start, end) as EventRow[];

    const mapped: DigestEvent[] = rows
        .filter(r => !excludedUrls.has(r.url))
        // Bild är ett HÅRT krav (beslut: alltid 10 slides med bild) — bildlösa
        // event ska aldrig ta en plats i listan bara för att droppas vid publicering.
        .filter(r => !!r.coverImage && /^https?:\/\//i.test(r.coverImage.trim()))
        .map(r => ({ ...r, city: extractCity(r), cleanTitle: cleanTitle(r.title || '') }))
        .filter(e => e.city.length > 0)
        .filter(e => e.cleanTitle.length >= 3 && e.cleanTitle.length <= MAX_TITLE_LEN);

    // Tabort dubbletter (samma titel + stad)
    const seen = new Set<string>();
    return mapped.filter(e => {
        const key = `${e.city.toLowerCase()}::${e.cleanTitle.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** Total-räknare: alla event idag (vidare än filtret för listan — för "imponerande siffra"). */
function countTodayTotal(db: Database.Database): number {
    const { start, end } = todayBounds();
    const row = db.prepare(`
        SELECT COUNT(*) AS n
        FROM link_events
        WHERE datetime(time) >= datetime(?)
          AND datetime(time) <= datetime(?)
          AND (hidden IS NULL OR hidden = 0)
    `).get(start, end) as { n: number };
    return row?.n ?? 0;
}

// ── Ranking: kvällstid + bildkvalitet ────────────────────────────────────────

/**
 * Kvällspoäng (0–60): prioritet 1 i urvalet. Kl 20 är bäst, 18–21 högt,
 * sen fallande. Midnatt/tidig morgon är oftast heldagsposter utan riktigt
 * klockslag — lägst.
 */
function timeScore(e: DigestEvent): number {
    const h = new Date(e.time).getHours();
    if (h === 20) return 60;
    if (h >= 18 && h <= 21) return 50;
    if (h === 17 || h === 22) return 30;
    if (h >= 11 && h <= 16) return 15;
    return 5;
}

/** Bild i vår egen Firebase Storage? Metas servrar kan ALLTID hämta dem,
 *  medan externa URL:er är det som brukar avvisas (fel format, hotlink-skydd,
 *  döda länkar). Ger en fetchbarhets-bonus i rankningen (Mac Mini-insikt). */
function isStorageImage(url: string | null | undefined): boolean {
    return !!url && /storage\.googleapis\.com|firebasestorage/i.test(url);
}
// Poäng-bonus för Storage-bild — väger ungefär som ett steg i kvällstid, så en
// säkert hämtbar bild kan gå före en marginellt bättre men riskabel extern bild.
const STORAGE_BONUS = 12;

interface ImageDim { width: number; height: number }

// Cache per URL så approval-loopens omval ("byt N"/"nytt") inte probar om.
// null = oåtkomlig/trasig → diskvalificerad.
const probeCache = new Map<string, ImageDim | null>();

/** Proba bilddimensioner (bara headerbytes hämtas). Timeout/fel → null. */
async function probeImage(url: string): Promise<ImageDim | null> {
    if (probeCache.has(url)) return probeCache.get(url)!;
    let result: ImageDim | null = null;
    try {
        const r = await Promise.race([
            // Needle-timeouts stänger sockets; racen är bältet+hängslen så en
            // hängd probe aldrig blockerar hela urvalet.
            probe(url, { open_timeout: PROBE_TIMEOUT_MS, response_timeout: PROBE_TIMEOUT_MS, read_timeout: PROBE_TIMEOUT_MS }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('probe timeout')), PROBE_TIMEOUT_MS).unref?.()),
        ]);
        if (r && r.width > 0 && r.height > 0) result = { width: r.width, height: r.height };
    } catch { /* trasig/oåtkomlig bild → null */ }
    probeCache.set(url, result);
    return result;
}

/** Proba en uppsättning URL:er med begränsad parallellism. */
async function probeAll(urls: string[]): Promise<void> {
    const queue = [...new Set(urls)];
    await Promise.all(
        Array.from({ length: PROBE_CONCURRENCY }, async () => {
            while (queue.length > 0) {
                await probeImage(queue.shift()!);
            }
        }),
    );
}

/**
 * Bildpoäng (0–40): prioritet 2. Stora bilder (≥800 px breda) och IG-vänlig
 * aspekt vinner. IG kräver 0.8–1.91:1 för karusell-slides; nära 4:5–1:1 är
 * bäst. Utanför spannet ⇒ 0 aspektpoäng (IG avvisar troligen sliden).
 */
function imageScore(dim: ImageDim): number {
    const widthPts = (Math.min(dim.width, 1600) / 1600) * 14 + (dim.width >= 800 ? 6 : 0);
    const a = dim.width / dim.height;
    let aspectPts = 0;
    if (a >= 0.8 && a <= 1.0) aspectPts = 20;
    else if (a > 1.0 && a <= 1.91) aspectPts = 20 - ((a - 1.0) / 0.91) * 12;
    return widthPts + aspectPts;
}

/**
 * Proba bilder i kvällspoängs-ordning (batchvis — vi vill inte proba hundratals
 * bilder när de bästa räcker) tills minst `minCount` godkända kandidater finns,
 * kandidaterna är slut eller probe-taket nåtts. Trasig/oåtkomlig bild ⇒ bortfall.
 * Returnerar kandidaterna sorterade på totalpoäng (kvällstid + bild).
 */
async function rankByScore(candidates: DigestEvent[], minCount: number): Promise<DigestEvent[]> {
    const byTime = [...candidates].sort((a, b) => timeScore(b) - timeScore(a));
    const ranked: DigestEvent[] = [];
    let cursor = 0;
    while (cursor < byTime.length && ranked.length < minCount && cursor < MAX_PROBES_PER_RUN) {
        const batch = byTime.slice(cursor, cursor + PROBE_BATCH);
        cursor += batch.length;
        await probeAll(batch.map(e => e.coverImage!.trim()));
        for (const e of batch) {
            const dim = probeCache.get(e.coverImage!.trim());
            if (!dim) continue;
            e.score = timeScore(e) + imageScore(dim) + (isStorageImage(e.coverImage) ? STORAGE_BONUS : 0);
            ranked.push(e);
        }
    }
    return ranked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// ── Välj event i rankad ordning (en per stad, kategori-spridning) ────────────

function pickRanked(ranked: DigestEvent[], n: number): DigestEvent[] {
    const usedCities = new Set<string>();
    const categoryCount: Record<string, number> = {};
    const picks: DigestEvent[] = [];

    // Pass 1: max 1 per stad + favorisera kategori-spridning (max 2 per kategori i första svepet)
    for (const e of ranked) {
        if (picks.length >= n) break;
        const cityKey = e.city.toLowerCase();
        if (usedCities.has(cityKey)) continue;
        const catCount = categoryCount[e.category] ?? 0;
        if (catCount >= 2) continue;
        picks.push(e);
        usedCities.add(cityKey);
        categoryCount[e.category] = catCount + 1;
    }

    // Pass 2: om vi inte fick n, släpp kategori-cap men håll städer unika
    if (picks.length < n) {
        for (const e of ranked) {
            if (picks.length >= n) break;
            const cityKey = e.city.toLowerCase();
            if (usedCities.has(cityKey)) continue;
            picks.push(e);
            usedCities.add(cityKey);
        }
    }

    // Pass 3: om vi STILL inte fick n (för få unika städer idag) — släpp city-cap också
    if (picks.length < n) {
        const usedUrls = new Set(picks.map(p => p.url));
        for (const e of ranked) {
            if (picks.length >= n) break;
            if (usedUrls.has(e.url)) continue;
            picks.push(e);
        }
    }

    return picks;
}

/**
 * Hela urvalet: kandidater → ranking (bildprober) → kvot-plock. Över-rankar
 * 3× kvoten så stads-/kategorispridningen har spelrum; räcker inte det
 * (kvoterna åt upp poolen) rankas allt som finns i ett andra försök.
 */
async function selectDigest(
    db: Database.Database,
    excludedUrls: Set<string>,
    n: number = OVERPICK_COUNT,
): Promise<DigestEvent[]> {
    const candidates = loadCandidates(db, excludedUrls);
    let picks = pickRanked(await rankByScore(candidates, n * 3), n);
    if (picks.length < n && candidates.length > n) {
        picks = pickRanked(await rankByScore(candidates, Infinity), n);
    }
    return picks;
}

// ── Bygg Telegram-text ───────────────────────────────────────────────────────

/** "kl 20:00" för preview-raden — utelämnas för midnattstider (heldag/utan klockslag). */
function previewTime(e: DigestEvent): string {
    const d = new Date(e.time);
    if (d.getHours() === 0 && d.getMinutes() === 0) return '';
    return ` · kl ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildDigestText(picks: DigestEvent[], totalToday: number): string {
    const todayStr = new Date().toLocaleDateString('sv-SE', {
        weekday: 'long', day: 'numeric', month: 'long',
    });

    const header = `📋 <b>${todayStr}</b>\nIdag händer det minst <b>${totalToday}</b> unika event i Sverige.\n`;

    const row = (e: DigestEvent, i: number): string => {
        const num = String(i + 1).padStart(2, ' ');
        const head = ` ${num}. <b>${escapeHtml(e.city)}</b> — ${escapeHtml(e.cleanTitle)}${previewTime(e)}`;
        // Bildrad: klickbar länk Josef kan öppna/spara för Instagram. Saknas bild
        // (kan bara hända om en manuell bild tagits bort) → påminn om kommandot.
        const img = e.coverImage && e.coverImage.trim()
            ? `\n      🖼 <a href="${escapeHtml(e.coverImage.trim())}">bild</a>`
            : `\n      🖼 <i>saknas — skriv</i> <code>bild ${i + 1} &lt;URL&gt;</code>`;
        return head + img;
    };

    // Rankad ordning: 1–10 är dagens lista, resten reserver som rycker in om
    // Instagram avvisar någon slide vid publiceringen.
    const main    = picks.slice(0, TARGET_COUNT);
    const reserve = picks.slice(TARGET_COUNT);

    const lines = main.map(row).join('\n');
    const reserveBlock = reserve.length > 0
        ? `\n\n🎟 <b>Reserver</b> (fyller upp till ${TARGET_COUNT} om IG nobbar en bild):\n`
          + reserve.map((e, i) => row(e, TARGET_COUNT + i)).join('\n')
        : '';

    const footer = '\n\n<i>Vilket hade du helst velat gå på?</i>';

    return `${header}\n${lines}${reserveBlock}${footer}`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * REN bildtext för Instagram/Facebook (ingen HTML, inga Telegram-bildlänkar).
 * Numreringen matchar carousel-slidesen 1:1 — så `picks` här ska vara exakt de
 * event som blir slides (de med publik bild), i samma ordning.
 */
function buildCaptionPlain(picks: DigestEvent[], totalToday: number): string {
    const todayStr = new Date().toLocaleDateString('sv-SE', {
        weekday: 'long', day: 'numeric', month: 'long',
    });
    const header = `📋 ${todayStr}\nIdag händer minst ${totalToday} unika event i Sverige — här är ${picks.length} av dem:`;
    const lines = picks.map((e, i) => `${i + 1}. ${e.city} — ${e.cleanTitle}`).join('\n');
    const footer = 'Vilket hade du helst velat gå på? 👇\n\nFler tips → vadkul.se\n#vadkul #sverige #evenemang #görnågot #helgtips';
    return `${header}\n\n${lines}\n\n${footer}`;
}

/**
 * Publicera listan till Instagram (karusell) + Facebook. Kön = hela den rankade
 * över-listan (state.picks, upp till OVERPICK_COUNT — alla har bild via
 * loadCandidates): de TARGET_COUNT bästa blir slides, resten är reserver som
 * fyller på när Meta avvisar en bild. Varje plattform bygger sin EGEN bildtext
 * från de bilder som FAKTISKT kom med (keptIdx → 1:1-numrering) och publicerar
 * OBEROENDE av den andra — fallerar IG postar FB ändå (Mac Mini-strukturen).
 */
async function publishDigest(state: DigestState): Promise<void> {
    if (!isInstagramConfigured() && !isFacebookConfigured()) {
        await sendMessage('⚠️ Varken Instagram eller Facebook är konfigurerat (FB_PAGE_TOKEN/IG_USER_ID saknas i ~/.vadkul-secrets/env).');
        return;
    }

    // Hela den rankade listan är kön: topp-TARGET_COUNT + reserver, alla med bild.
    const queue = state.picks.filter(p => p.coverImage && /^https?:\/\//.test(p.coverImage.trim()));
    const imageUrls = queue.map(p => p.coverImage!.trim());

    if (imageUrls.length === 0) {
        await sendMessage(
            '🚫 Kan inte publicera — inget av eventen har en bild.\n' +
            'Sätt bilder med <code>bild N &lt;URL&gt;</code> och skriv <code>klar</code> igen.'
        );
        return;
    }

    const reserves = Math.max(0, queue.length - TARGET_COUNT);
    await sendMessage(
        `🚀 Publicerar (mål ${TARGET_COUNT} event, ${reserves} reserver i kön) till` +
        `${isInstagramConfigured() ? ' Instagram' : ''}${isInstagramConfigured() && isFacebookConfigured() ? ' +' : ''}${isFacebookConfigured() ? ' Facebook' : ''}…`
    );

    // Bildtexten byggs FÖRST när plattformen bekräftat vilka bilder som kom med
    // (keptIdx pekar in i `queue`), så numreringen matchar 1:1.
    const captionFor = (keptIdx: number[]): string =>
        buildCaptionPlain(keptIdx.map(i => queue[i]), state.totalToday);

    let lastCaption: string | null = null;
    if (isInstagramConfigured()) {
        let igCount = 0;
        try {
            const igId = await postToInstagram(keptIdx => {
                igCount = keptIdx.length;
                lastCaption = captionFor(keptIdx);
                return lastCaption;
            }, imageUrls, TARGET_COUNT);
            await sendMessage(
                `✅ Instagram: ${igCount} event publicerade (id ${escapeHtml(igId)})` +
                (igCount < TARGET_COUNT ? `\n♻️ Nådde inte ${TARGET_COUNT} — kön (${queue.length} kandidater) tog slut på godkända bilder.` : '')
            );
        } catch (e) {
            await sendMessage(`⚠️ Instagram misslyckades: ${escapeHtml((e as Error).message)}`);
        }
    }
    if (isFacebookConfigured()) {
        let fbCount = 0;
        try {
            await postToFacebook(keptIdx => {
                fbCount = keptIdx.length;
                lastCaption = captionFor(keptIdx);
                return lastCaption;
            }, imageUrls, TARGET_COUNT);
            await sendMessage(
                `✅ Facebook: ${fbCount} event publicerade` +
                (fbCount < TARGET_COUNT ? `\n♻️ Nådde inte ${TARGET_COUNT} — kön (${queue.length} kandidater) tog slut på godkända bilder.` : '')
            );
        } catch (e) {
            await sendMessage(`⚠️ Facebook misslyckades: ${escapeHtml((e as Error).message)}`);
        }
    }

    console.log('[Digest] Publicerat:');
    console.log(lastCaption ?? buildCaptionPlain(queue.slice(0, TARGET_COUNT), state.totalToday));
}

const HELP = `
— Svara:
  <code>byt 5</code>          = byt event #5 (även reserverna 11–${OVERPICK_COUNT})
  <code>byt 3,7,12</code>     = byt flera
  <code>bild 5 &lt;URL&gt;</code>   = sätt bild för #5 (DB + Firestore)
  <code>nytt</code>           = byt alla
  <code>klar</code>           = 📲 PUBLICERA till Instagram + Facebook
  <code>stopp</code>          = avbryt`;

// ── Approval-loop ────────────────────────────────────────────────────────────

interface DigestState {
    picks: DigestEvent[];
    totalToday: number;
    excludedUrls: Set<string>;
}

async function sendDraft(state: DigestState): Promise<void> {
    const body = buildDigestText(state.picks, state.totalToday);
    await sendMessage(body + HELP);
}

/** Tolka "bild 5 https://..." / "setimage 5 https://..." → { slot, url } (1-indexerat). */
function parseSetImage(cmd: string): { slot: number; url: string } | null {
    const m = cmd.match(/^(?:bild|setimage|sätt\s*bild)\s+(\d+)\s+(\S+)$/i);
    if (!m) return null;
    const slot = parseInt(m[1], 10);
    if (isNaN(slot) || slot < 1 || slot > OVERPICK_COUNT) return null;
    return { slot, url: m[2] };
}

/** Tolka "byt 5" / "byt 3,7,10" / "byt 3 7" → [3,7,10] (1-indexerat) */
function parseSwapIndices(cmd: string): number[] | null {
    const m = cmd.match(/^(?:byt|swap|replace)\s+([\d,\s]+)$/i);
    if (!m) return null;
    const digits = m[1].split(/[,\s]+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    const valid = digits.filter(n => n >= 1 && n <= OVERPICK_COUNT);
    return [...new Set(valid)].sort((a, b) => a - b);
}

async function runApprovalLoop(db: Database.Database): Promise<void> {
    const totalToday = countTodayTotal(db);
    const excludedUrls = new Set<string>();
    const picks = await selectDigest(db, excludedUrls);

    if (picks.length === 0) {
        await sendMessage('🤷 Inga event idag som matchar filtren (fungerande bild, titel ≤ 40 tecken, verifierad plats, en per stad).');
        return;
    }

    const state: DigestState = { picks, totalToday, excludedUrls };
    await flushPendingUpdates();
    await sendDraft(state);

    const TIMEOUT_MS = 60 * 60 * 1000; // 1 h
    const deadline = Date.now() + TIMEOUT_MS;

    while (Date.now() < deadline) {
        const reply = await waitForReply(deadline - Date.now());
        if (!reply) {
            await sendMessage('⏰ Timeout — avslutar.');
            return;
        }
        const cmd = reply.toLowerCase().trim();

        // OBS: "bild N <URL>" tolkas från reply i ORIGINAL-case — URL:er är
        // case-känsliga och får inte lowercasas.
        const setImg = parseSetImage(reply.trim());
        if (setImg) {
            const target = state.picks[setImg.slot - 1];
            if (!target) {
                await sendMessage(`🤷 Det finns inget event #${setImg.slot} i listan.`);
                continue;
            }
            if (!isValidImageUrl(setImg.url)) {
                await sendMessage('⚠️ Det ser inte ut som en giltig bild-URL (måste börja med http:// eller https://).');
                continue;
            }
            await sendMessage(`🖼 Sätter bild för #${setImg.slot} (${escapeHtml(target.city)})…`);
            try {
                const res = await setEventImage(target.url, setImg.url);
                if (!res.found) {
                    await sendMessage('🚫 Hittade inte eventet i databasen — bilden sattes inte.');
                    continue;
                }
                target.coverImage = setImg.url; // uppdatera utkastet direkt
                const fsNote = res.firestoreUpdated
                    ? 'DB + Firestore'
                    : (res.error ? `DB ✓, Firestore-fel (${escapeHtml(res.error)})` : 'DB ✓, Firestore ej tillgängligt');
                await sendMessage(`✅ Bild satt för #${setImg.slot} (${fsNote}).`);
            } catch (e) {
                await sendMessage(`⚠️ Kunde inte sätta bild: ${escapeHtml((e as Error).message)}`);
            }
            await sendDraft(state);
            continue;
        }

        if (['klar', 'ok', '👍', '✅', 'publicera'].includes(cmd)) {
            await publishDigest(state);
            return;
        }

        if (['stopp', 'avbryt', 'cancel', 'nej', '❌'].includes(cmd)) {
            await sendMessage('🛑 Avbryter.');
            return;
        }

        if (['nytt', 'allt', 'omstart'].includes(cmd)) {
            await sendMessage('🔄 Byter alla…');
            // Lägg nuvarande i excluded och kör om
            for (const e of state.picks) state.excludedUrls.add(e.url);
            const fresh = await selectDigest(db, state.excludedUrls);
            if (fresh.length === 0) {
                await sendMessage('🚫 Inga fler event att välja mellan — behåller nuvarande.');
                await sendDraft(state);
                continue;
            }
            state.picks = fresh;
            await sendDraft(state);
            continue;
        }

        const swapIdx = (parseSwapIndices(cmd) ?? []).filter(n => n <= state.picks.length);
        if (swapIdx.length > 0) {
            // Lägg de valda i excluded, ranka kandidaterna och fyll på med de
            // poängbästa ersättarna (samma kvällstid+bild-ranking som urvalet).
            const targetSet = new Set(swapIdx);
            for (let i = 0; i < state.picks.length; i++) {
                if (targetSet.has(i + 1)) state.excludedUrls.add(state.picks[i].url);
            }
            const ranked = await rankByScore(
                loadCandidates(db, state.excludedUrls),
                swapIdx.length * 3 + 10,
            );
            const usedCities = new Set(
                state.picks
                    .filter((_, i) => !targetSet.has(i + 1))
                    .map(e => e.city.toLowerCase())
            );
            const replacements: (DigestEvent | null)[] = swapIdx.map(() => null);
            let rIdx = 0;
            for (const cand of ranked) {
                if (rIdx >= swapIdx.length) break;
                const cityKey = cand.city.toLowerCase();
                if (usedCities.has(cityKey)) continue;
                replacements[rIdx++] = cand;
                usedCities.add(cityKey);
            }
            // Sätt in på rätt plats
            const newPicks = [...state.picks];
            swapIdx.forEach((slot, i) => {
                if (replacements[i]) newPicks[slot - 1] = replacements[i]!;
            });
            const swapped = swapIdx.filter((_, i) => !!replacements[i]);
            const failed = swapIdx.filter((_, i) => !replacements[i]);
            state.picks = newPicks;
            if (swapped.length > 0) {
                await sendMessage(`🔄 Bytte #${swapped.join(', #')}${failed.length ? ` (#${failed.join(', #')} hittade inget alternativ)` : ''}`);
            } else {
                await sendMessage('🚫 Hittade inga alternativ för de slotsen.');
            }
            await sendDraft(state);
            continue;
        }

        // Okänt — visa hjälpen
        await sendMessage('❓ Förstod inte. Försök igen.' + HELP);
    }

    await sendMessage('⏰ Timeout — avslutar.');
}

// ── Auto-läge (schemalagt: bygg → leverera → publicera utan approval) ────────

/**
 * Icke-interaktivt läge för det dagliga 07:00-jobbet. Bygger 10-listan,
 * skickar den till Telegram (så Josef får dagens lista i handen), och
 * publicerar sedan DIREKT till Instagram-karusell + Facebook utan att vänta
 * på "klar". Ingen approval-loop, inga inkommande kommandon.
 */
async function runAuto(db: Database.Database): Promise<void> {
    const totalToday = countTodayTotal(db);
    const picks = await selectDigest(db, new Set<string>());

    if (picks.length === 0) {
        await sendMessage('🤷 <b>Dagens 10-lista</b> — inga event idag som matchar filtren (fungerande bild, titel ≤ 40 tecken, verifierad plats, en per stad). Inget publiceras.');
        return;
    }

    const state: DigestState = { picks, totalToday, excludedUrls: new Set<string>() };

    // Leverera listan till Telegram (utan interaktiv HELP-fot — inget att svara på).
    await sendMessage('🌅 <b>Dagens 10-lista</b> — auto-publiceras till Instagram + Facebook nu.');
    await sendMessage(buildDigestText(state.picks, state.totalToday));

    // Publicera direkt (samma väg som "klar" i det manuella flödet).
    await publishDigest(state);
}

// ── Main ─────────────────────────────────────────────────────────────────────

/** Smoke-test: bygg listan (inkl. bildprober) och skriv ut den utan att röra Telegram. */
async function runDry(db: Database.Database): Promise<void> {
    const totalToday = countTodayTotal(db);
    const picks = await selectDigest(db, new Set<string>());
    if (picks.length === 0) {
        console.log('🤷 Inga event idag som matchar filtren.');
        return;
    }
    console.log(buildDigestText(picks, totalToday));
    for (const [i, e] of picks.entries()) {
        const dim = probeCache.get(e.coverImage!.trim());
        console.log(`   #${i + 1} poäng=${e.score?.toFixed(1)} bild=${dim ? `${dim.width}×${dim.height}` : '?'} ${e.city} — ${e.cleanTitle}`);
    }
    console.log(HELP);
}

async function main() {
    const dry  = process.argv.includes('--dry');
    const auto = process.argv.includes('--auto');

    if (!dry && !isTelegramConfigured()) {
        console.error('❌ TG_BOT_TOKEN / TG_CHAT_ID saknas');
        process.exit(1);
    }
    if (!fs.existsSync(DB_PATH)) {
        console.error(`❌ DB saknas: ${DB_PATH}`);
        process.exit(1);
    }

    if (dry) {
        const db = new Database(DB_PATH, { readonly: true });
        try { await runDry(db); } finally { db.close(); }
        return;
    }

    if (!acquireLock()) process.exit(0);
    const db = new Database(DB_PATH, { readonly: true });
    try {
        if (auto) {
            await runAuto(db);
        } else {
            await runApprovalLoop(db);
        }
    } finally {
        db.close();
    }
}

main().catch(e => {
    console.error('[Digest] Fatal:', e);
    process.exit(1);
});
