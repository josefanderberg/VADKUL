/**
 * publish-fb.ts — Daglig publicering på Facebook + Instagram
 *
 * Flöde:
 *   1. Hämta de 5 bästa kommande events ur SQLite (nästa 7 dagar)
 *   2. Generera ett engagerande inlägg på svenska via Ollama (qwen3:8b)
 *   3. Fallback till fast mall om Ollama ej tillgängligt
 *   4. Publicera på Facebook-sidan via Graph API
 *   5. Publicera på Instagram (om IG_USER_ID finns + bild tillgänglig)
 *   6. Markera publiceringsdatum → undviker dubbelpost vid omstart
 *
 * Körning: npx tsx apps/scraper/src/scripts/publish-fb.ts
 * Schemaläggning: launchd kl 11:00 (se.vadkul.fb-publish.plist)
 *
 * Instagram-krav: token måste ha instagram_basic + instagram_content_publish
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';
import { approveDraft } from '../utils/approvalFlow';
import { isTelegramConfigured } from '../utils/telegram';

// ── Lock-fil — säkerställer att bara EN instans körs i taget ──────────────────
const LOCK_FILE = '/tmp/vadkul-publish-fb.lock';

function acquireLock(): boolean {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
            // Kolla om PID:en faktiskt lever
            process.kill(pid, 0);
            console.log(`⛔ publish-fb redan igång (PID ${pid}). Avslutar.`);
            return false;
        } catch {
            // Process är död, lock är stale — ta bort och fortsätt
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
const IG_USER_ID    = process.env.IG_USER_ID    ?? '';   // Instagram Business Account ID
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
    coverImage: string | null;
}

interface ScoredEvent extends EventRow {
    score: number;
    city: string;    // heuristik: sista "ord" i locationName
    image: string;   // normaliserad bild-URL (tom sträng om ingen)
}

// ── Guard: redan publicerat idag? ────────────────────────────────────────────

function localDateString(): string {
    // Använd lokal tid (inte UTC) så att körningar kring midnatt inte bryter guarden
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function alreadyPostedToday(): boolean {
    try {
        if (!fs.existsSync(LAST_POST_FILE)) return false;
        const data = JSON.parse(fs.readFileSync(LAST_POST_FILE, 'utf-8'));
        return data?.date === localDateString();
    } catch {
        return false;
    }
}

function markPostedToday(postId: string) {
    const today = localDateString();
    try {
        fs.mkdirSync(path.dirname(LAST_POST_FILE), { recursive: true });
        fs.writeFileSync(LAST_POST_FILE, JSON.stringify({ date: today, postId }));
    } catch (e) {
        console.error('[FB] Kunde inte skriva last-post-fil:', e);
    }
}

// ── Hämta & ranka events ─────────────────────────────────────────────────────

/**
 * Bygg en kronologisk "dagsresa" — 5 events i samma region som spänner över
 * dagen från morgon till kväll. Tanken: läsaren ska kunna föreställa sig att
 * åka mellan alla på en heldag.
 *
 * Steg:
 *   1. Hämta alla events idag (eller imorgon om inget passar idag)
 *   2. Klustra dem efter geo (~50 km celler — en rimlig dagsresa-radie)
 *   3. Välj klustret som har bäst täckning över dagens 5 tidsfönster
 *   4. Plocka ett event per fönster (högst score vinner inom fönstret)
 */
function pickBestEvents(db: Database.Database, opts: { excludedUrls?: Set<string> } = {}): ScoredEvent[] {
    const excluded = opts.excludedUrls ?? new Set<string>();
    const now = new Date();
    // Vi börjar leta från ~kl 07 idag — om jobbet kör 07:00 är vi precis vakna
    const dayStart = new Date(now); dayStart.setHours(7, 0, 0, 0);
    const dayEnd   = new Date(now); dayEnd.setHours(23, 59, 59, 999);

    let rows = db.prepare(`
        SELECT url, title, time, locationName, category, hostName, lat, lng, isLocationVerified, coverImage
        FROM link_events
        WHERE datetime(time) >= datetime(?)
          AND datetime(time) <= datetime(?)
          AND (hidden IS NULL OR hidden = 0)
          AND lat BETWEEN 54.5 AND 71.5
          AND lng BETWEEN 4.5 AND 24.5
          AND isLocationVerified = 1
        ORDER BY time ASC
    `).all(dayStart.toISOString(), dayEnd.toISOString()) as EventRow[];
    rows = rows.filter(r => !excluded.has(r.url));

    // Om idag är ovanligt tomt (typ <10 events), använd imorgon istället
    if (rows.length < 10) {
        const tomorrowStart = new Date(now); tomorrowStart.setDate(tomorrowStart.getDate() + 1); tomorrowStart.setHours(7, 0, 0, 0);
        const tomorrowEnd   = new Date(now); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); tomorrowEnd.setHours(23, 59, 59, 999);
        rows = (db.prepare(`
            SELECT url, title, time, locationName, category, hostName, lat, lng, isLocationVerified, coverImage
            FROM link_events
            WHERE datetime(time) >= datetime(?)
              AND datetime(time) <= datetime(?)
              AND (hidden IS NULL OR hidden = 0)
              AND lat BETWEEN 54.5 AND 71.5
              AND lng BETWEEN 4.5 AND 24.5
              AND isLocationVerified = 1
            ORDER BY time ASC
        `).all(tomorrowStart.toISOString(), tomorrowEnd.toISOString()) as EventRow[])
            .filter(r => !excluded.has(r.url));
    }

    const scored: ScoredEvent[] = rows.map(e => {
        let score = 0;
        score += (CATEGORY_SCORE[e.category] ?? 1);
        if (e.isLocationVerified) score += 2;
        if (e.title.length >= 5 && e.title.length <= 80) score += 1;
        if (e.coverImage && e.coverImage.trim().length > 10) score += 2;
        const cityHint = e.locationName?.split(',').pop()?.trim() ?? '';
        return { ...e, score, city: cityHint, image: e.coverImage?.trim() || '' };
    });

    // Tre tidsfönster för en dagsresa — håller storyn enkel och tydlig
    const SLOTS: { label: string; from: number; to: number }[] = [
        { label: 'morgon',  from:  7, to: 12 },
        { label: 'dag',     from: 12, to: 17 },
        { label: 'kväll',   from: 17, to: 24 },
    ];

    // Klustra på ~50 km (rounding lat/lng till 0.5°)
    const clusterKey = (e: ScoredEvent) => `${Math.round(e.lat * 2) / 2},${Math.round(e.lng * 2) / 2}`;
    const clusters = new Map<string, ScoredEvent[]>();
    for (const e of scored) {
        const k = clusterKey(e);
        if (!clusters.has(k)) clusters.set(k, []);
        clusters.get(k)!.push(e);
    }

    // För varje kluster: räkna hur många slots vi kan fylla + summa-score
    interface ClusterFit { key: string; events: ScoredEvent[]; slotsFilled: number; totalScore: number }
    const fits: ClusterFit[] = [];
    for (const [key, evs] of clusters) {
        if (evs.length < 2) continue; // måste täcka åtminstone 2 av 3 slots
        let slotsFilled = 0;
        let totalScore = 0;
        const picked: ScoredEvent[] = [];
        for (const slot of SLOTS) {
            const cand = evs.filter(e => {
                const h = new Date(e.time).getHours();
                return h >= slot.from && h < slot.to && !picked.find(p => p.url === e.url);
            }).sort((a, b) => b.score - a.score);
            if (cand.length > 0) {
                picked.push(cand[0]);
                slotsFilled++;
                totalScore += cand[0].score;
            }
        }
        if (picked.length >= 2) {
            fits.push({ key, events: picked, slotsFilled, totalScore });
        }
    }

    // Välj klustret med flest fyllda slots, sen högst score (slumpa lite mellan likadana för variation)
    fits.sort((a, b) => {
        if (b.slotsFilled !== a.slotsFilled) return b.slotsFilled - a.slotsFilled;
        return b.totalScore - a.totalScore;
    });

    // Bland topp-3 kluster, slumpa för variation dag-till-dag
    const topCandidates = fits.slice(0, Math.min(3, fits.length));
    const chosenCluster = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    if (chosenCluster && chosenCluster.events.length >= 2) {
        // Sortera kronologiskt
        return chosenCluster.events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }

    // Fallback: ingen dagsresa möjlig — ta 3 topp-score-events kronologiskt
    return scored.sort((a, b) => b.score - a.score).slice(0, 3)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/**
 * Byt ut specifika events i en befintlig uppsättning (för "nytt1", "nytt23" etc).
 * Behåller övriga events + försöker hitta nya som ligger nära dem geografiskt
 * (för att bevara dagsrese-känslan).
 *
 * @param slotsToReplace  0-indexed: 0=morgon, 1=dag, 2=kväll
 */
function swapEventSlots(
    db: Database.Database,
    currentEvents: ScoredEvent[],
    slotsToReplace: number[],
    excludedUrls: Set<string>,
): ScoredEvent[] {
    const SLOTS: { from: number; to: number }[] = [
        { from:  7, to: 12 },
        { from: 12, to: 17 },
        { from: 17, to: 24 },
    ];

    // Sortera kronologiskt och säkerställ att slotsToReplace är giltig
    const sorted = [...currentEvents].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const result: (ScoredEvent | null)[] = [...sorted];

    // Lägg till de events vi vill byta ut i excluded
    for (const idx of slotsToReplace) {
        if (sorted[idx]) excludedUrls.add(sorted[idx].url);
        result[idx] = null;
    }

    // Anchors = de events vi BEHÅLLER. Vi vill att nya event hamnar nära dem.
    const anchors = result.filter((e): e is ScoredEvent => !!e);
    const anchorLat = anchors.length > 0
        ? anchors.reduce((s, e) => s + e.lat, 0) / anchors.length
        : (sorted[0]?.lat ?? 0);
    const anchorLng = anchors.length > 0
        ? anchors.reduce((s, e) => s + e.lng, 0) / anchors.length
        : (sorted[0]?.lng ?? 0);

    // Hämta kandidater för idag (samma fönster som pickBestEvents)
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(7, 0, 0, 0);
    const dayEnd   = new Date(now); dayEnd.setHours(23, 59, 59, 999);
    const rows = (db.prepare(`
        SELECT url, title, time, locationName, category, hostName, lat, lng, isLocationVerified, coverImage
        FROM link_events
        WHERE datetime(time) >= datetime(?)
          AND datetime(time) <= datetime(?)
          AND (hidden IS NULL OR hidden = 0)
          AND lat BETWEEN 54.5 AND 71.5
          AND lng BETWEEN 4.5 AND 24.5
          AND isLocationVerified = 1
    `).all(dayStart.toISOString(), dayEnd.toISOString()) as EventRow[])
        .filter(r => !excludedUrls.has(r.url));

    const candidates: ScoredEvent[] = rows.map(e => {
        let score = 0;
        score += (CATEGORY_SCORE[e.category] ?? 1);
        if (e.isLocationVerified) score += 2;
        if (e.title.length >= 5 && e.title.length <= 80) score += 1;
        if (e.coverImage && e.coverImage.trim().length > 10) score += 2;
        const cityHint = e.locationName?.split(',').pop()?.trim() ?? '';
        return { ...e, score, city: cityHint, image: e.coverImage?.trim() || '' };
    });

    // För varje slot vi ska fylla, hitta bästa kandidat
    for (const idx of slotsToReplace) {
        const slot = SLOTS[idx];
        const inSlot = candidates.filter(e => {
            const h = new Date(e.time).getHours();
            return h >= slot.from && h < slot.to
                && !result.some(r => r?.url === e.url);
        });
        if (inSlot.length === 0) continue;

        // Sortera: först närliggande till anchors (inom ~10 km), sen score
        inSlot.sort((a, b) => {
            const dA = Math.hypot(a.lat - anchorLat, a.lng - anchorLng);
            const dB = Math.hypot(b.lat - anchorLat, b.lng - anchorLng);
            // Båda inom 0.5° → score avgör; annars distance
            if (dA < 0.5 && dB < 0.5) return b.score - a.score;
            if (Math.abs(dA - dB) > 0.1) return dA - dB;
            return b.score - a.score;
        });
        result[idx] = inSlot[0];
    }

    // Filtrera bort eventuella null (om inget gick att hitta för en slot)
    return result.filter((e): e is ScoredEvent => !!e)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
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

/** Öppningsmönster — slumpas så texten varierar dag-till-dag. */
const OPENING_STYLES = [
    'Sätt scenen i ${city}. Bestäm dig i första meningen — en specifik observation om platsen/dagen, inte en allmän fras.',
    'Börja med en kort scen ("Solen är ute, vi har plats i kalendern…") som direkt leder in på dagens första event.',
    'Inled med en fråga som faktiskt försöker locka fram en bild i läsarens huvud (inte "Är du redo?").',
    'Skriv som en kompis som tjusig SMS:ar förslaget — direkt, småprat-aktig, inga klyschor.',
    'Börja med en avundsjuk-vibb: "Den som är i ${city} idag har det förspänt." Stick ut en udd.',
    'Bekräfta vad dagen handlar om: en heldag i ${city} med tre stopp. Skriv det rakt, men med smak.',
    'En aning torr humor — som någon som sett dagen redan och vet att den blir bra.',
];

/** Fraser modellen tenderar att börja med (klyschor) — uttryckligen förbjudna. */
const FORBIDDEN_OPENINGS = [
    'Häng med', 'Ta chansen', 'Passa på', 'Missa inte', 'Häng på',
    'Är du redo', 'Här kommer', 'Här är dagens', 'Idag firar vi',
    'Dags att', 'Glöm inte', 'Vi har koll',
];

async function generatePostWithOllama(events: ScoredEvent[]): Promise<string | null> {
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
    const weekday = now.getDay(); // 0=sön, 5=fre, 6=lör
    const isWeekend = weekday === 5 || weekday === 6 || weekday === 0;

    // Sortera kronologiskt så listan flödar morgon → kväll
    const sortedEvents = [...events].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const eventLines = sortedEvents.map(e => {
        const d = new Date(e.time);
        const time = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        // Slot-etikett baserat på timme
        const h = d.getHours();
        const slot = h < 12 ? 'MORGON' : h < 17 ? 'DAG' : 'KVÄLL';
        return `[${slot} kl ${time}] ${e.title} — ${e.locationName} (${e.category})`;
    }).join('\n');

    const cityCounts: Record<string, number> = {};
    for (const e of events) {
        const c = e.city || e.locationName?.split(',').pop()?.trim() || '';
        if (c) cityCounts[c] = (cityCounts[c] || 0) + 1;
    }
    const dominantCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Slumpa öppningsstil — variation över tid (substituera ${city})
    const openingHintRaw = OPENING_STYLES[Math.floor(Math.random() * OPENING_STYLES.length)];
    const openingHint = openingHintRaw.replace(/\$\{city\}/g, dominantCity || 'staden');

    const prompt = `Du är social-media-skribenten för VADKUL — en svensk app för "hitta-på-grejer". Skriv ett inlägg för Instagram + Facebook.

──────────────────────────────────────
DAGENS UPPLÄGG: En heldag i ${dominantCity || 'samma område'}
──────────────────────────────────────
Tre events kurerade som en resa över dagen — morgon, dag, kväll. Läsaren ska kunna föreställa sig att åka mellan dem.

TONFALL:
• Direkt, smarrigt, lite cool. Som en kompis som tipsar — INTE som reklam.
• Inte överdrivet glad. Inte korrekt formell. Tänk Vice/Lonely Planet light.
• Korta meningar. Pulserande rytm.
• Svenska, vardagligt. Använd hellre "kollar" än "tar del av".
• Bygg en mini-känsla, en mini-scen. Inte bara en lista.

GENOMSNITTLIG STRUKTUR (~420 tecken):
1. En öppning som SÄTTER SCENEN (1-2 rader) — INTE "Här är dagens events"
2. De tre eventen — i ordning, med klockslag, korta beskrivningar
3. En liten avslutning som löfter eller utmanar
4. "Hitta fler events → vadkul.se" + 2-3 relevanta hashtags

ÖPPNINGEN — Detta är där det avgörs:
• Riktning idag: ${openingHint}
• ⛔ ABSOLUT FÖRBJUDET att börja med: ${FORBIDDEN_OPENINGS.map(x => `"${x}"`).join(', ')}.
• Försök att hänvisa till ${dominantCity || 'platsen'}, dagen, ljuset, säsongen — något specifikt.

EXEMPEL PÅ BRA RYTM (för referens, kopiera inte):
> Vaknat i Malmö och vet inte vad du ska göra? Här kommer planen:
> ☀️ 09:00 — Yoga i Slottsparken
> 🎨 14:00 — Vernissage på Form/Design Center
> 🍷 19:30 — Tapas + live jazz på Plan B
> Tre platser, en dag, noll dötid.
> Fler tips → vadkul.se #malmö #vadkul

EXEMPEL PÅ DÅLIG RYTM (gör INTE så här):
> Häng med! Här är dagens events 🎉
> Idag har vi tre häftiga events att tipsa om!
> Yoga 09:00, vernissage 14:00, jazz 19:30!
> Glöm inte att kika på vadkul.se! 🎉🎉

KONTEXT:
Datum: ${todayStr}${isWeekend ? ' (HELG — mer avslappnad ton)' : ''}
Plats: ${dominantCity || 'blandat'}
Schema:
${eventLines}

Skriv NU. Bara inläggstexten — ingen förklaring, inga citattecken, ingen rubrik.`;

    try {
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(60_000),
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                stream: false,
                think: false,
                // Höjer temperature för mer variation; top_p lite lägre för fokus
                options: { temperature: 0.95, top_p: 0.92, num_predict: 320 },
                messages: [{ role: 'user', content: prompt }]
            })
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        let text = (data?.message?.content?.trim() ?? '').replace(/^"|"$/g, '');

        // Säkerhetsnät: om modellen ändå råkade börja med förbjuden fras, klipp bort den
        for (const ban of FORBIDDEN_OPENINGS) {
            const re = new RegExp(`^\\s*${ban.replace(/[.*+?^${}()|[\\\]\\\\]/g, '\\\\$&')}[!,.\\s]*`, 'i');
            text = text.replace(re, '').trimStart();
        }
        return text || null;
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

/**
 * Publicera till Facebook.
 *   - Ingen bild         → vanligt feed-inlägg
 *   - 1 bild             → /photos med caption (carousel av 1)
 *   - 2+ bilder          → multi-photo: ladda upp varje opublicerad + feed med attached_media
 */
async function postToFacebook(message: string, imageUrls: string[]): Promise<string> {
    const validImages = imageUrls.filter((u) => !!u && u.startsWith('http'));

    if (validImages.length === 0) {
        const res = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, access_token: FB_PAGE_TOKEN }),
        });
        const data = await res.json() as any;
        if (data.error) throw new Error(`FB API ${data.error.code}: ${data.error.message}`);
        return data.id as string;
    }

    if (validImages.length === 1) {
        const res = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption: message, url: validImages[0], access_token: FB_PAGE_TOKEN }),
        });
        const data = await res.json() as any;
        if (data.error) {
            console.warn(`[FB] Bildpost misslyckades (${data.error.message}) — försöker utan bild`);
            return postToFacebook(message, []);
        }
        return data.id as string;
    }

    // Multi-photo: ladda upp varje som unpublished, sen skapa feed-post med attached_media
    const mediaIds: string[] = [];
    for (const url of validImages) {
        const res = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, published: false, access_token: FB_PAGE_TOKEN }),
        });
        const data = await res.json() as any;
        if (data.error) {
            console.warn(`[FB] Upload av bild misslyckades (${data.error.message}) — skippar denna`);
            continue;
        }
        mediaIds.push(data.id as string);
    }
    if (mediaIds.length === 0) {
        console.warn('[FB] Inga bilder gick att ladda upp — postar utan');
        return postToFacebook(message, []);
    }
    const attachedMedia = mediaIds.map((id) => ({ media_fbid: id }));
    const feedRes = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            attached_media: attachedMedia,
            access_token: FB_PAGE_TOKEN,
        }),
    });
    const feedData = await feedRes.json() as any;
    if (feedData.error) throw new Error(`FB feed: ${feedData.error.message}`);
    console.log(`[FB] Multi-photo post med ${mediaIds.length} bilder`);
    return feedData.id as string;
}

// ── Publicera till Instagram ──────────────────────────────────────────────────

/**
 * Vänta på att en IG-container har status_code=FINISHED.
 * IG behöver tid (5-30s) för att processa bilden innan den kan publiceras.
 */
async function waitForIgContainerReady(containerId: string, maxSec: number = 60): Promise<void> {
    const start = Date.now();
    while ((Date.now() - start) / 1000 < maxSec) {
        const res = await fetch(
            `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${FB_PAGE_TOKEN}`
        );
        const data = await res.json() as any;
        const status = data.status_code;
        if (status === 'FINISHED') return;
        if (status === 'ERROR' || status === 'EXPIRED') {
            throw new Error(`IG container ${containerId} status=${status}: ${data.status || ''}`);
        }
        // IN_PROGRESS eller PUBLISHED → vänta lite
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`IG container ${containerId} timeout efter ${maxSec}s`);
}

/**
 * Publicera till Instagram. 1 bild = single post, 2-10 bilder = carousel.
 */
async function postToInstagram(caption: string, imageUrls: string[]): Promise<string> {
    const valid = imageUrls.filter((u) => !!u && u.startsWith('http'));
    if (valid.length === 0) throw new Error('IG: ingen bild att posta');

    if (valid.length === 1) {
        const cRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: valid[0], caption, access_token: FB_PAGE_TOKEN }),
        });
        const cData = await cRes.json() as any;
        if (cData.error) throw new Error(`IG container: ${cData.error.message}`);
        console.log(`[IG] Container skapad: ${cData.id}, väntar på FINISHED…`);
        await waitForIgContainerReady(cData.id);
        const pRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media_publish`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: cData.id, access_token: FB_PAGE_TOKEN }),
        });
        const pData = await pRes.json() as any;
        if (pData.error) throw new Error(`IG publish: ${pData.error.message}`);
        return pData.id as string;
    }

    // Carousel: skapa item-containers + vänta på FINISHED per styck
    const childIds: string[] = [];
    for (const url of valid.slice(0, 10)) {
        const cRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: FB_PAGE_TOKEN }),
        });
        const cData = await cRes.json() as any;
        if (cData.error) {
            console.warn(`[IG] Carousel-item misslyckades (${cData.error.message}) — skippar`);
            continue;
        }
        childIds.push(cData.id as string);
    }
    if (childIds.length < 2) {
        throw new Error('IG carousel kräver minst 2 giltiga bilder');
    }
    console.log(`[IG] ${childIds.length} carousel-items skapade, väntar på FINISHED…`);

    // Vänta på att ALLA items är FINISHED innan vi skapar wrappern
    for (const childId of childIds) {
        await waitForIgContainerReady(childId);
    }
    console.log(`[IG] Alla items klara — skapar carousel-wrapper…`);

    const wrapperRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            media_type: 'CAROUSEL',
            children: childIds.join(','),
            caption,
            access_token: FB_PAGE_TOKEN,
        }),
    });
    const wrapperData = await wrapperRes.json() as any;
    if (wrapperData.error) throw new Error(`IG carousel container: ${wrapperData.error.message}`);

    console.log(`[IG] Wrapper skapad: ${wrapperData.id}, väntar på FINISHED…`);
    await waitForIgContainerReady(wrapperData.id);

    const pRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media_publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: wrapperData.id, access_token: FB_PAGE_TOKEN }),
    });
    const pData = await pRes.json() as any;
    if (pData.error) throw new Error(`IG carousel publish: ${pData.error.message}`);
    return pData.id as string;
}

// ── Huvudfunktion ────────────────────────────────────────────────────────────

async function main() {
    console.log('[FB Publish] Startar…');

    if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
        console.error('❌ FB_PAGE_ID eller FB_PAGE_TOKEN saknas. Kontrollera ~/.vadkul-secrets/env');
        process.exit(1);
    }

    // Guard 1: lock-fil — bara EN publish-fb körs i taget
    if (!acquireLock()) {
        process.exit(0);
    }

    // Guard 2: publicera max 1 gång per dag (--force kringgår)
    const isForce = process.argv.includes('--force');
    if (alreadyPostedToday() && !isForce) {
        console.log('ℹ️  Redan publicerat idag — avslutar. (Använd --force för att köra ändå.)');
        process.exit(0);
    }
    if (isForce) console.log('⚠️  --force: kringgår "redan publicerat idag"-spärr.');

    // 1. Öppna DB
    if (!fs.existsSync(DB_PATH)) {
        console.error(`❌ DB hittades inte: ${DB_PATH}`);
        process.exit(1);
    }
    // DB lever hela körningen — onRegenAll/onNextImages behöver kunna queryra
    // efter approval har börjat. Stängs vid main-utgång.
    const db = new Database(DB_PATH, { readonly: true });

    // 2. Välj bästa events
    const events = pickBestEvents(db);

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

    // 4. Plocka bilder — en per event, kronologiskt (morgon, dag, kväll)
    let currentEvents = events;
    let imageUrls = currentEvents.map(e => e.image).filter((u): u is string => !!u && u.length > 10);
    console.log(`[FB Publish] ${imageUrls.length} bilder valda (i ordning).`);

    // 4.5. Approval-flow via Telegram
    if (isTelegramConfigured()) {
        console.log('[Approval] Skickar utkast till Telegram för godkännande…');

        // Ackumulera URLs vi visat så vi inte upprepar
        const shownUrls = new Set<string>(currentEvents.map(e => e.url));
        const imagesOf = (evs: ScoredEvent[]) =>
            evs.map(e => e.image).filter((u): u is string => !!u && u.length > 10);

        const result = await approveDraft(
            { text: message, imageUrls },
            {
                onRegenText: async () => {
                    const newText = await generatePostWithOllama(currentEvents);
                    return (newText && newText.length > 30) ? newText : generateFallbackPost(currentEvents);
                },
                onNextImages: async () => {
                    // "bild" = nya events (vilket också ger nya bilder)
                    currentEvents = pickBestEvents(db, { excludedUrls: shownUrls });
                    currentEvents.forEach(e => shownUrls.add(e.url));
                    return imagesOf(currentEvents);
                },
                onRegenAll: async () => {
                    // Full omstart: nya events, ny text, nya bilder
                    currentEvents = pickBestEvents(db, { excludedUrls: shownUrls });
                    currentEvents.forEach(e => shownUrls.add(e.url));
                    const newText = await generatePostWithOllama(currentEvents);
                    return {
                        text: (newText && newText.length > 30) ? newText : generateFallbackPost(currentEvents),
                        imageUrls: imagesOf(currentEvents),
                    };
                },
                onSwapSlots: async (slots1Based: number[]) => {
                    // Konvertera 1-indexerat (UI) → 0-indexerat (kod)
                    const slots0 = slots1Based.map(n => n - 1);
                    currentEvents = swapEventSlots(db, currentEvents, slots0, shownUrls);
                    currentEvents.forEach(e => shownUrls.add(e.url));
                    const newText = await generatePostWithOllama(currentEvents);
                    return {
                        text: (newText && newText.length > 30) ? newText : generateFallbackPost(currentEvents),
                        imageUrls: imagesOf(currentEvents),
                    };
                },
            },
            7 * 60 * 60 * 1000, // 7h timeout — kör 07:00, deadline 14:00
        );

        if (!result.approved) {
            console.log(`[Approval] Avbryter publicering (${result.reason}).`);
            process.exit(0);
        }
        message = result.text;
        imageUrls = result.imageUrls ?? imageUrls;
        console.log(`[Approval] Godkänd, publicerar med ${imageUrls.length} bilder…`);
    } else {
        console.log('[Approval] Telegram ej konfigurerat — auto-publicerar utan godkännande.');
    }

    // 5. Publicera på Facebook (multi-photo om flera bilder)
    console.log('[FB] Publicerar…');
    try {
        const postId = await postToFacebook(message, imageUrls);
        console.log(`✅ Facebook publicerat! Post-ID: ${postId}`);
        markPostedToday(postId);
    } catch (err) {
        console.error('❌ Fel vid Facebook-publicering:', (err as Error).message);
        process.exit(1);
    }

    // 6. Publicera på Instagram (carousel om flera bilder)
    if (IG_USER_ID && imageUrls.length > 0) {
        console.log('[IG] Publicerar…');
        try {
            const igPostId = await postToInstagram(message, imageUrls);
            console.log(`✅ Instagram publicerat! Post-ID: ${igPostId}`);
        } catch (err) {
            console.error('⚠️  Instagram misslyckades (FB-post klar):', (err as Error).message);
        }
    } else if (!IG_USER_ID) {
        console.log('[IG] Hoppar över — IG_USER_ID inte satt i ~/.vadkul-secrets/env');
    } else {
        console.log('[IG] Hoppar över — inga bilder');
    }
}

main().catch(e => {
    console.error('❌ Oväntat fel:', e);
    process.exit(1);
});
