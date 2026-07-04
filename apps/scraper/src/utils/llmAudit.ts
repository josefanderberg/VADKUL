/**
 * LLM-baserad audit av events: använder Ollama (gemma4:latest) för att bedöma
 * om eventet ser legitimt ut, klassificera kategori, välja en passande emoji
 * och plocka ut entrépris.
 *
 * Granskar:
 *   - Är platsen i Sverige?
 *   - Verkar titel/beskrivning hänga ihop?
 *   - Junk (cookie-banner, kommunsida, trafikinfo, formulär osv)?
 *   - Vilken av 11 kategorier passar (för filter + markörfärg)?
 *   - Vilken enskild emoji representerar just detta event bäst (för kartpinnen)?
 *   - Nämns ett entré-/deltagarpris i texten?
 *
 * Modell: gemma4:latest (text-only). För bildgranskning behövs llama3.2-vision.
 */

import { normalizeCategory } from './categoryNormalize';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_AUDIT_MODEL ?? process.env.OLLAMA_MODEL ?? 'gemma4:latest';
const TIMEOUT_MS = 30_000;

export type AuditVerdict = 'ok' | 'suspect' | 'junk';

/**
 * 11 kategorier (för filter + markörfärg på kartan). Den fria `emoji`-fältet
 * är det som faktiskt visas på pinnen — kategorin styr bara färg/legend/filter.
 */
export const CATEGORY_EMOJI: Record<string, string> = {
    music:   '🎵',  // konsert, spelning, festival, DJ, klubbmusik
    stage:   '🎭',  // teater, standup/komedi, dans, opera, film
    art:     '🎨',  // utställning, vernissage, galleri
    sport:   '⚽',  // match, turnering, yoga, gym, löpning
    food:    '🍽️',  // matfestival, provning, middag, brunch
    market:  '🛍️',  // loppis, marknad, mässa
    party:   '🎉',  // fest, party, afterwork, klubb
    social:  '🤝',  // mingel, nätverk, quiz, brädspel, träffar
    course:  '📚',  // workshop, kurs, seminarium, föredrag
    family:  '👨‍👩‍👧', // barnteater, familjeevent, sagostund
    other:   '✨',  // resten
};

export const VALID_AUDIT_CATEGORIES = new Set(Object.keys(CATEGORY_EMOJI));

export interface AuditInput {
    title: string;
    locationName?: string;
    extractedAddress?: string;
    description?: string;
    hostName?: string;
    url: string;
}

export interface AuditResult {
    verdict: AuditVerdict;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    inSweden: boolean;
    /** En av de 11 kategorierna — för filter + markörfärg. */
    category: string;
    categoryConfidence: 'high' | 'medium' | 'low';
    /** Fritt vald emoji som bäst representerar eventet — visas på kartpinnen. */
    emoji: string;
    /** Entré-/deltagarpris om det nämns, annars null. T.ex. "150 kr", "Fri entré". */
    price: string | null;
    raw?: string;
}

async function callOllama(prompt: string): Promise<string | null> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ac.signal,
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                stream: false,
                think: false,
                options: { temperature: 0.1, num_predict: 400 },
                messages: [{ role: 'user', content: prompt }],
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.message?.content ?? null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export async function ollamaIsAvailable(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

// OBS 2026-07-04: scopet är NORDEN (Sverige + Norge + Danmark) sedan NO/DK-
// källorna (TicketMaster NO/DK, Tickster Norge) lades till 2026-07-02/03.
// Gamla Sverige-prompten junk-dömde 200+ legitima norska/danska event
// ("8-delsfinale på Heimebane" = junk/high) som auto-gömdes.
const PROMPT_TEMPLATE = (e: AuditInput) => `Du granskar event för en nordisk eventaggregator (Sverige, Norge, Danmark). Den här veckan i Norden.

EVENT:
- Titel: "${e.title}"
- Plats: "${e.locationName || '(saknas)'}"
- Adress: "${e.extractedAddress || '(saknas)'}"
- Arrangör: "${e.hostName || '(saknas)'}"
- Beskrivning: "${(e.description || '').slice(0, 600)}"
- URL: ${e.url}

Bedöm:
1. verdict — "ok" om det är ett riktigt evenemang i Sverige, Norge eller Danmark som folk kan gå på (norsk/dansk text är helt normalt). "suspect" om det är oklart (t.ex. ofullständig info, men kunde vara legit). "junk" om det INTE är ett evenemang (cookie-banner, sökresultatsida, "Startsida", trafikinfo, kommunsida, eller event utanför Norden som felaktigt markerats som nordiskt).
2. confidence — "high" om du är säker. "medium"/"low" annars.
3. inSweden — true/false. Är platsen i Sverige, Norge eller Danmark? (Fältnamnet är historiskt — svara true för hela SE/NO/DK.) Om text säger "Berlin", "Helsinki", "Polska", "Manchester" etc → false.
4. reason — kort förklaring (max 15 ord, svenska).
5. category — EN av dessa 11 (för filter/färg, välj den som passar bäst):
   - music: konsert, spelning, festival, DJ, klubbmusik
   - stage: teater, standup/komedi, dans, opera, film, bio
   - art: utställning, vernissage, galleri, konst
   - sport: match, turnering, yoga, gym, löpning, friluftsliv
   - food: matfestival, provning, middag, brunch, ölprovning
   - market: loppis, marknad, mässa, basar
   - party: fest, party, afterwork, klubb, uteliv
   - social: mingel, nätverk, quiz, brädspel, träffar, fika
   - course: workshop, kurs, seminarium, föredrag, föreläsning
   - family: barnteater, familjeevent, sagostund, barnaktivitet
   - other: passar inte i någon ovan
6. categoryConfidence — "high" om kategorin är uppenbar, annars "medium"/"low".
7. emoji — EN enda emoji som bäst representerar just detta SPECIFIKA event (fritt val, inte bunden till kategorin). Var PRECIS — använd INTE ⚽ för all sport. Matcha aktiviteten:
   SPORT/RÖRELSE: yoga/meditation/mindfulness → 🧘 · cykling/MTB/spinning → 🚴 · löpning/maraton/terränglopp → 🏃 · simning → 🏊 · vandring/friluftsliv → 🥾 · gym/styrketräning/crossfit → 🏋️ · fotboll → ⚽ · ishockey → 🏒 · tennis/padel → 🎾 · golf → ⛳ · ridning/häst → 🐴 · kampsport/boxning → 🥊 · dans/zumba → 💃 · klättring → 🧗 · skidor → ⛷️
   ÖVRIGT (exempel): schackturnering → ♟️ · kräftskiva → 🦞 · jazzkonsert → 🎷 · rockkonsert → 🎸 · teater → 🎭 · standup → 🎤 · konstutställning → 🎨 · loppis → 🛍️ · julmarknad → 🎄 · ölprovning → 🍺 · barnteater → 🧸 · quiz → 🧠 · brädspel → 🎲 · föreläsning → 🎓
   Välj det mest träffsäkra för EXAKT denna aktivitet. Två events av samma typ (t.ex. två yogapass) ska få samma emoji.
8. price — entré-/deltagarpris OM det tydligt nämns i texten, som sträng (t.ex. "150 kr", "Fri entré", "50-200 kr"). Annars null. VIKTIGT: bara faktiskt pris för att delta — INTE vinstpotter ("1:a pris 1000 kr"), bordsavgifter eller medlemsavgifter.

Svara BARA med JSON, inga extra tecken: {"verdict":"ok|suspect|junk","confidence":"high|medium|low","inSweden":true|false,"reason":"...","category":"music|stage|art|sport|food|market|party|social|course|family|other","categoryConfidence":"high|medium|low","emoji":"<en emoji>","price":"<pris eller null>"}`;

function parseJson(raw: string): Partial<AuditResult> | null {
    // Plocka första {...}-blocket
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
        return JSON.parse(m[0]);
    } catch {
        return null;
    }
}

const FALLBACK_RESULT: AuditResult = {
    verdict: 'suspect', confidence: 'low', reason: 'LLM-anrop misslyckades',
    inSweden: true, category: 'other', categoryConfidence: 'low', emoji: '✨', price: null,
};

/**
 * Frågetecken-glyfer är giltiga emoji men säger inget om eventet — modellen
 * tar till dem när den är osäker (och prompten råkade lista quiz → ❓). De
 * läckte ut på publicerade pinnar; behandla dem som "ingen emoji" så att
 * kategori-defaulten används i stället.
 */
const NON_REPRESENTATIVE_EMOJI = new Set(['❓', '❔', '⁉️', '‼️', '🆖']);

/** Validera/sanera en fritt vald emoji. Tillåt 1–3 codepoints (täcker ZWJ-emoji). */
function sanitizeEmoji(value: unknown, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    // Frågetecken-/platshållar-emoji → kategori-default i stället.
    if (NON_REPRESENTATIVE_EMOJI.has(trimmed)) return fallback;
    // Räkna grapheme-ish: använd Array.from (codepoints). En emoji som 👨‍👩‍👧 = 5 cp.
    const cps = Array.from(trimmed);
    if (cps.length === 0 || cps.length > 8) return fallback;
    // Avvisa rena ASCII-svar (modellen skrev ord istället för emoji)
    if (/^[\x00-\x7F]+$/.test(trimmed)) return fallback;
    return trimmed;
}

function sanitizePrice(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const t = value.trim();
    if (!t || t.toLowerCase() === 'null' || t === '-') return null;
    return t.slice(0, 60);
}

export async function auditEvent(e: AuditInput): Promise<AuditResult> {
    const prompt = PROMPT_TEMPLATE(e);
    // Upp till 2 försök — gemma kan ibland returnera text före JSON.
    for (let attempt = 1; attempt <= 2; attempt++) {
        const raw = await callOllama(prompt);
        if (!raw) return FALLBACK_RESULT;

        const parsed = parseJson(raw);
        if (!parsed || !parsed.verdict) {
            if (attempt < 2) continue;
            return { ...FALLBACK_RESULT, reason: 'Kunde inte parsa LLM-svar', raw };
        }

        // normalizeCategory ger samma kanoniska 11 som scrape-vägen — och räddar
        // LLM-närträffar (t.ex. "workshop" → course) som annars fallit till 'other'.
        const category = normalizeCategory((parsed as Record<string, unknown>).category);

        return {
            verdict: (['ok', 'suspect', 'junk'].includes(parsed.verdict as string)
                ? parsed.verdict : 'suspect') as AuditVerdict,
            confidence: (['high', 'medium', 'low'].includes(parsed.confidence as string)
                ? parsed.confidence : 'low') as AuditResult['confidence'],
            reason: (parsed.reason || '').toString().slice(0, 150),
            inSweden: parsed.inSweden !== false,
            category,
            categoryConfidence: (['high', 'medium', 'low'].includes((parsed as Record<string, unknown>).categoryConfidence as string)
                ? (parsed as Record<string, unknown>).categoryConfidence : 'low') as AuditResult['categoryConfidence'],
            emoji: sanitizeEmoji((parsed as Record<string, unknown>).emoji, CATEGORY_EMOJI[category] ?? '✨'),
            price: sanitizePrice((parsed as Record<string, unknown>).price),
            raw,
        };
    }
    return FALLBACK_RESULT;
}

// ─── GPS-AUDIT ──────────────────────────────────────────────────────────────
// Granskar om event.lat/lng faktiskt matchar event.locationName/extractedAddress.
// Strategi:
//   1. Trivial checks: 0,0 → 'no-coords'. Utanför Nordic bbox → 'wrong'.
//   2. Reverse-geokoda lat/lng via Nominatim → får stad + display_name.
//   3. Om stad nämns i locationName/extractedAddress (case-insensitive substring)
//      → 'ok' utan att fråga LLM. (Vanligaste fallet, sparar GPU.)
//   4. Annars: fråga LLM "matchar reverse-geo med venue-namnet semantiskt?".
//      Det är där LLM tillför värde — den vet att "Vida Arena, Växjö" och
//      "Lyckhems väg 12, Växjö" är samma område men olika ordval.
//
// Returnerar minimal JSON som kan skrivas till aiAudit.gpsCheck.

import { reverseGeocode } from './venueCoordinates';
import { NORDIC_BOUNDS, isInNordic } from './venueCoordinates';

export type GpsVerdict = 'ok' | 'suspect' | 'wrong' | 'no-coords' | 'unknown';

export interface GpsAuditInput {
    title: string;
    locationName?: string;
    extractedAddress?: string;
    hostName?: string;
    lat: number;
    lng: number;
}

export interface GpsAuditResult {
    verdict: GpsVerdict;
    reason: string;
    reverseCity: string | null;
    reverseDisplay: string | null;
    /** Om LLM faktiskt anropades (för cost-tracking) */
    usedLlm: boolean;
}

function norm(s: string | undefined): string {
    return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const GPS_PROMPT = (i: GpsAuditInput, reverse: { displayName: string; city: string | null }) => `Du verifierar GPS-koordinater för svenska event.

Eventet säger sig vara på:
- Plats: "${i.locationName || '(saknas)'}"
- Adress: "${i.extractedAddress || '(saknas)'}"
- Arrangör: "${i.hostName || '(saknas)'}"

GPS-koordinaten ${i.lat}, ${i.lng} ligger enligt OpenStreetMap här:
- Stad: "${reverse.city || '(okänd)'}"
- Full adress: "${reverse.displayName}"

Fråga: Matchar GPS:en eventets uppgivna plats?
- "ok": samma stad/område, sannolikt rätt punkt.
- "suspect": kan vara rätt men oklart (t.ex. event säger "Stockholm" och GPS pekar på en förort).
- "wrong": fel stad eller fel del av Sverige.

Svara BARA med JSON: {"verdict":"ok|suspect|wrong","reason":"kort förklaring max 12 ord"}`;

export async function auditGps(input: GpsAuditInput): Promise<GpsAuditResult> {
    const { lat, lng } = input;

    // 1. Inga koordinater
    if (!lat && !lng) {
        return { verdict: 'no-coords', reason: 'lat/lng=0', reverseCity: null, reverseDisplay: null, usedLlm: false };
    }

    // 2. Utanför Nordic bbox = uppenbart fel (svenskt event på lat=0,0 eller i USA)
    if (!isInNordic(lat, lng)) {
        return {
            verdict: 'wrong',
            reason: `utanför nordisk bbox (${NORDIC_BOUNDS.latMin}-${NORDIC_BOUNDS.latMax}, ${NORDIC_BOUNDS.lngMin}-${NORDIC_BOUNDS.lngMax})`,
            reverseCity: null,
            reverseDisplay: null,
            usedLlm: false,
        };
    }

    // 3. Reverse-geokoda
    const reverse = await reverseGeocode(lat, lng);
    if (!reverse) {
        return { verdict: 'unknown', reason: 'reverse-geocode misslyckades', reverseCity: null, reverseDisplay: null, usedLlm: false };
    }

    // Utanför SE/DK/NO/FI enligt countryCode? Då är det inte Sverige.
    if (reverse.countryCode && !['se', 'no', 'dk', 'fi'].includes(reverse.countryCode)) {
        return {
            verdict: 'wrong',
            reason: `GPS landar i ${reverse.countryCode.toUpperCase()}, ej Sverige`,
            reverseCity: reverse.city,
            reverseDisplay: reverse.displayName,
            usedLlm: false,
        };
    }

    // 4. Snabb-match: nämns reverse.city i locationName/extractedAddress?
    const locStr = `${norm(input.locationName)} ${norm(input.extractedAddress)} ${norm(input.hostName)} ${norm(input.title)}`;
    const reverseCity = norm(reverse.city || '');
    if (reverseCity && reverseCity.length >= 3 && locStr.includes(reverseCity)) {
        return {
            verdict: 'ok',
            reason: `reverse-stad "${reverse.city}" matchar plats-text`,
            reverseCity: reverse.city,
            reverseDisplay: reverse.displayName,
            usedLlm: false,
        };
    }

    // 5. Om vi inte ens har en plats-text att jämföra mot — bara konstatera bbox.
    if (!input.locationName && !input.extractedAddress) {
        return {
            verdict: 'suspect',
            reason: `ingen plats-text att jämföra med reverse "${reverse.city || reverse.displayName.slice(0, 40)}"`,
            reverseCity: reverse.city,
            reverseDisplay: reverse.displayName,
            usedLlm: false,
        };
    }

    // 6. LLM-adjudikering på fuzzy match
    const raw = await callOllama(GPS_PROMPT(input, { displayName: reverse.displayName, city: reverse.city }));
    if (!raw) {
        return {
            verdict: 'unknown',
            reason: 'LLM-anrop misslyckades',
            reverseCity: reverse.city,
            reverseDisplay: reverse.displayName,
            usedLlm: true,
        };
    }
    const parsed = parseJson(raw) as { verdict?: string; reason?: string } | null;
    const v = parsed?.verdict;
    return {
        verdict: (['ok', 'suspect', 'wrong'].includes(v as string) ? v : 'suspect') as GpsVerdict,
        reason: (parsed?.reason || '').toString().slice(0, 150) || 'LLM gav inget reason',
        reverseCity: reverse.city,
        reverseDisplay: reverse.displayName,
        usedLlm: true,
    };
}
