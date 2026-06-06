/**
 * LLM-baserad audit av events: använder Ollama (qwen3:8b) för att bedöma
 * om eventet ser legitimt ut.
 *
 * Granskar:
 *   - Är platsen i Sverige?
 *   - Verkar titel/beskrivning hänga ihop?
 *   - Junk (cookie-banner, kommunsida, trafikinfo, formulär osv)?
 *   - Verkar locationName vara en riktig plats eller bara generiskt ord?
 *
 * Returnerar verdict + reason så vi kan visa det i admin-UI.
 *
 * Modell: qwen3:8b (text-only). För bildgranskning behövs llama3.2-vision.
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_AUDIT_MODEL ?? process.env.OLLAMA_MODEL ?? 'qwen3:8b';
const TIMEOUT_MS = 30_000;

export type AuditVerdict = 'ok' | 'suspect' | 'junk';

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
                options: { temperature: 0.1, num_predict: 300 },
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

const PROMPT_TEMPLATE = (e: AuditInput) => `Du granskar event för en svensk eventaggregator. Den här veckan i Sverige.

EVENT:
- Titel: "${e.title}"
- Plats: "${e.locationName || '(saknas)'}"
- Adress: "${e.extractedAddress || '(saknas)'}"
- Arrangör: "${e.hostName || '(saknas)'}"
- Beskrivning: "${(e.description || '').slice(0, 600)}"
- URL: ${e.url}

Bedöm:
1. verdict — "ok" om det är ett riktigt evenemang i Sverige som folk kan gå på. "suspect" om det är oklart (t.ex. ofullständig info, men kunde vara legit). "junk" om det INTE är ett evenemang (cookie-banner, sökresultatsida, "Startsida", trafikinfo, kommunsida, eller event i annat land som felaktigt markerats som svenskt).
2. confidence — "high" om du är säker. "medium"/"low" annars.
3. inSweden — true/false. Är platsen i Sverige? Var noggrann med platsindikatorer i adress/beskrivning. Om text säger "Berlin", "Copenhagen", "Polska", "Manchester" etc → false.
4. reason — kort förklaring (max 15 ord, svenska).

Svara BARA med JSON, inga extra tecken: {"verdict":"ok|suspect|junk","confidence":"high|medium|low","inSweden":true|false,"reason":"..."}`;

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

export async function auditEvent(e: AuditInput): Promise<AuditResult> {
    const prompt = PROMPT_TEMPLATE(e);
    const raw = await callOllama(prompt);
    if (!raw) {
        return { verdict: 'suspect', confidence: 'low', reason: 'LLM-anrop misslyckades', inSweden: true };
    }
    const parsed = parseJson(raw);
    if (!parsed || !parsed.verdict) {
        return { verdict: 'suspect', confidence: 'low', reason: 'Kunde inte parsa LLM-svar', inSweden: true, raw };
    }
    return {
        verdict: (['ok', 'suspect', 'junk'].includes(parsed.verdict as string) ? parsed.verdict : 'suspect') as AuditVerdict,
        confidence: (['high', 'medium', 'low'].includes(parsed.confidence as string) ? parsed.confidence : 'low') as AuditResult['confidence'],
        reason: (parsed.reason || '').toString().slice(0, 150),
        inSweden: parsed.inSweden !== false,
        raw,
    };
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
