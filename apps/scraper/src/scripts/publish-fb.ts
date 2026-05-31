/**
 * publish-fb.ts — Daglig Facebook-publicering
 *
 * Flöde:
 *   1. Hämta de 5 bästa kommande events ur SQLite (nästa 7 dagar)
 *   2. Generera ett engagerande inlägg på svenska via Ollama (qwen3:8b)
 *   3. Fallback till fast mall om Ollama ej tillgängligt
 *   4. Publicera på VADKUL Facebook-sidan via Graph API
 *   5. Markera publiceringsdatum → undviker dubbelpost vid omstart
 *
 * Körning: npx tsx apps/scraper/src/scripts/publish-fb.ts
 * Schemaläggning: launchd kl 09:00 (se.vadkul.fb-publish.plist)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';

// Ladda hemligheter
const secretFile = path.join(process.env.HOME || '~', '.vadkul-secrets/env');
if (fs.existsSync(secretFile)) {
    const raw = fs.readFileSync(secretFile, 'utf-8');
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/);
        if (m) process.env[m[1]] = m[2];
    }
}
dotenv.config();

// ── Config ───────────────────────────────────────────────────────────────────

const FB_PAGE_ID    = process.env.FB_PAGE_ID    ?? '';
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN ?? '';
const OLLAMA_URL    = process.env.OLLAMA_URL    ?? 'http://localhost:11434';
const OLLAMA_MODEL  = process.env.OLLAMA_MODEL  ?? 'qwen3:8b';

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

// Fil som håller koll på senaste publiceringsdag (undviker dubbelpost)
const LAST_POST_FILE = path.join(process.env.HOME || '~', '.vadkul-secrets/fb-last-post.json');

// Kategorier sorterade efter engagementsvärde (högt → lågt)
const CATEGORY_SCORE: Record<string, number> = {
    music: 5,
    comedy: 5,
    'performing-arts': 4,
    sport: 4,
    market: 3,
    food_drink: 3,
    'food-drink': 3,
    art: 3,
    family: 3,
    social: 2,
    education: 2,
    other: 1,
};

// ── Typdefiniton ─────────────────────────────────────────────────────────────

interface EventRow {
    url: string;
    title: string;
    time: string;
    locationName: string;
    category: string;
    hostName: string;
    lat: number;
    lng: number;
    isLocationVerified: number;
}

interface ScoredEvent extends EventRow {
    score: number;
    city: string;         // heuristik: sista "ord" i locationName
}

// ── Guard: redan publicerat idag? ────────────────────────────────────────────

function alreadyPostedToday(): boolean {
    try {
        if (!fs.existsSync(LAST_POST_FILE)) return false;
        const data = JSON.parse(fs.readFileSync(LAST_POST_FILE, 'utf-8'));
        const today = new Date().toISOString().slice(0, 10);
        return data?.date === today;
    } catch {
        return false;
    }
}

function markPostedToday(postId: string) {
    const today = new Date().toISOString().slice(0, 10);
    try {
        fs.mkdirSync(path.dirname(LAST_POST_FILE), { recursive: true });
        fs.writeFileSync(LAST_POST_FILE, JSON.stringify({ date: today, postId }));
    } catch (e) {
        console.error('[FB] Kunde inte skriva last-post-fil:', e);
    }
}

// ── Hämta & ranka events ─────────────────────────────────────────────────────

function pickBestEvents(db: Database.Database): ScoredEvent[] {
    const now    = new Date();
    const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const rows = db.prepare(`
        SELECT url, title, time, locationName, category, hostName, lat, lng, isLocationVerified
        FROM link_events
        WHERE datetime(time) >= datetime(?)
          AND datetime(time) <= datetime(?)
          AND (hidden IS NULL OR hidden = 0)
          AND lat != 0
        ORDER BY time ASC
        LIMIT 200
    `).all(now.toISOString(), cutoff.toISOString()) as EventRow[];

    // Skore varje event
    const scored: ScoredEvent[] = rows.map(e => {
        let score = 0;
        score += (CATEGORY_SCORE[e.category] ?? 1);
        if (e.isLocationVerified) score += 2;
        // Idag/imorgon = bonus (mer akut/relevant)
        const hoursUntil = (new Date(e.time).getTime() - now.getTime()) / 3_600_000;
        if (hoursUntil < 24)  score += 3;
        else if (hoursUntil < 48) score += 1;
        // Titel av rimlig längd (inte för kort/lång)
        if (e.title.length >= 5 && e.title.length <= 80) score += 1;

        // Extrahera city-hint ur locationName (sista token efter komma/stad)
        const cityHint = e.locationName?.split(',').pop()?.trim() ?? '';

        return { ...e, score, city: cityHint };
    });

    // Sortera fallande
    scored.sort((a, b) => b.score - a.score);

    // Välj max 5 events — försök sprida ut på olika städer
    const chosen: ScoredEvent[] = [];
    const usedCities = new Set<string>();

    for (const ev of scored) {
        if (chosen.length >= 5) break;
        const cityKey = ev.city.toLowerCase().slice(0, 8);
        // Tillåt max 2 events per stad
        const cityCount = [...usedCities].filter(c => c === cityKey).length;
        if (cityCount >= 2) continue;
        usedCities.add(cityKey);
        chosen.push(ev);
    }

    // Om inte 5 events med spridning — fyll på med bästa resten
    if (chosen.length < 5) {
        for (const ev of scored) {
            if (chosen.length >= 5) break;
            if (!chosen.find(c => c.url === ev.url)) chosen.push(ev);
        }
    }

    return chosen;
}

// ── Ollama-anrop ─────────────────────────────────────────────────────────────

async function ollamaIsAvailable(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

async function generatePostWithOllama(events: ScoredEvent[]): Promise<string | null> {
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

    const eventLines = events.map(e => {
        const d = new Date(e.time);
        const day  = d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
        const time = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        return `- ${e.title} | ${e.locationName} | ${day} kl ${time} | kategori: ${e.category}`;
    }).join('\n');

    const prompt = `Du är social media-manager för Vadkul (vadkul.se) — en app som listar spontana events i Sverige.
Skriv ETT engagerande Facebook-inlägg på svenska (max 400 tecken inkl emojis) som:
- Lyfter fram 3–5 av de listade eventen på ett inspirerande sätt
- Använder 3–5 relevanta emojis (inte en emoji per rad — blanda in naturligt)
- Avslutar med "Hitta fler events → vadkul.se" och 3–4 svenska hashtags
- Håller en varm, inbjudande ton — inte reklam-stiff
- Anger stad/plats för varje event

Idag är ${todayStr}. Kommande events:
${eventLines}

Skriv BARA inläggstexten — ingen förklaring, inga citattecken runt texten.`;

    try {
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(60_000),
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                stream: false,
                think: false,
                options: { temperature: 0.7, num_predict: 300 },
                messages: [{ role: 'user', content: prompt }]
            })
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        return data?.message?.content?.trim() ?? null;
    } catch (e) {
        console.error('[Ollama] Fel:', e);
        return null;
    }
}

// ── Fallback-mall ─────────────────────────────────────────────────────────────

function generateFallbackPost(events: ScoredEvent[]): string {
    const lines = events.slice(0, 5).map(e => {
        const d = new Date(e.time);
        const day  = d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
        const time = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        const emoji = categoryEmoji(e.category);
        return `${emoji} ${e.title} @ ${e.locationName} — ${day} kl ${time}`;
    });

    return [
        '🗓️ Vad händer i Sverige den närmaste veckan?\n',
        ...lines,
        '\nHitta fler events → vadkul.se',
        '#vadkul #evenemang #sverige #upplevelser',
    ].join('\n');
}

function categoryEmoji(cat: string): string {
    switch (cat) {
        case 'music':          return '🎵';
        case 'comedy':         return '😂';
        case 'performing-arts': return '🎭';
        case 'sport':          return '⚽';
        case 'art':            return '🎨';
        case 'food-drink':
        case 'food_drink':     return '🍻';
        case 'family':         return '👨‍👩‍👧';
        case 'market':         return '🛍️';
        default:               return '📍';
    }
}

// ── Publicera till Facebook ───────────────────────────────────────────────────

async function postToFacebook(message: string): Promise<string> {
    const url = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, access_token: FB_PAGE_TOKEN }),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(`FB API ${data.error.code}: ${data.error.message}`);
    return data.id as string;
}

// ── Huvudfunktion ────────────────────────────────────────────────────────────

async function main() {
    console.log('[FB Publish] Startar…');

    if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
        console.error('❌ FB_PAGE_ID eller FB_PAGE_TOKEN saknas. Kontrollera ~/.vadkul-secrets/env');
        process.exit(1);
    }

    // Guard: publicera max 1 gång per dag
    if (alreadyPostedToday()) {
        console.log('ℹ️  Redan publicerat idag — avslutar.');
        process.exit(0);
    }

    // 1. Öppna DB
    if (!fs.existsSync(DB_PATH)) {
        console.error(`❌ DB hittades inte: ${DB_PATH}`);
        process.exit(1);
    }
    const db = new Database(DB_PATH, { readonly: true });

    // 2. Välj bästa events
    const events = pickBestEvents(db);
    db.close();

    if (events.length === 0) {
        console.log('ℹ️  Inga events i DB för nästa 7 dagar — avslutar.');
        process.exit(0);
    }

    console.log(`[FB Publish] Valda events (${events.length} st):`);
    events.forEach(e => console.log(`  • [score=${e.score}] ${e.title} @ ${e.locationName}`));

    // 3. Generera text
    let message: string;
    const ollamaOk = await ollamaIsAvailable();

    if (ollamaOk) {
        console.log(`[FB Publish] Genererar post med Ollama (${OLLAMA_MODEL})…`);
        const generated = await generatePostWithOllama(events);
        if (generated && generated.length > 30) {
            message = generated;
            console.log(`[FB Publish] Genererad text (${message.length} tecken):\n${message}`);
        } else {
            console.log('[FB Publish] Ollama returnerade inget bra — faller tillbaka på mall.');
            message = generateFallbackPost(events);
        }
    } else {
        console.log('[FB Publish] Ollama ej tillgänglig — använder mall.');
        message = generateFallbackPost(events);
    }

    // 4. Publicera
    console.log('[FB Publish] Publicerar…');
    try {
        const postId = await postToFacebook(message);
        console.log(`✅ Publicerat! Post-ID: ${postId}`);
        markPostedToday(postId);
    } catch (err) {
        console.error('❌ Fel vid publicering:', (err as Error).message);
        process.exit(1);
    }
}

main().catch(e => {
    console.error('❌ Oväntat fel:', e);
    process.exit(1);
});
