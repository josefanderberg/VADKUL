/**
 * granskare.ts - AI-steget för klippen. REN logik: prompten, tolkningen av
 * modellens JSON och valet av bästa klipp. Själva modellanropet (Claude med
 * bildrutor, Ollama qwen3-vl som reserv) ligger i granskareProvider.ts.
 *
 * Granskaren får 5-10 bildrutor ur klippet plus BAS-reglerna och svarar med
 * tema, betyg 0-100, brott, två förslag på textrader och en motivering.
 * Siffror får den ALDRIG hitta på: textrader med siffror som inte finns i
 * data stryks av kontrolleraTextrad (text.ts).
 */

import { parseLlmJson } from '../llmJson';
import { KLIPP_TEMAN, type KlippTema } from './typer';
import { kontrolleraTextrad, type TextData } from './text';

export const MIN_BETYG = 70;

/** Brott som fäller klippet oavsett betyg (BAS: Grok får aldrig rita text,
 *  inga realistiska ansikten, inget blinkande). */
export const HARDA_BROTT = ['text', 'bokstäver', 'logga', 'logotyp', 'siffror i bild', 'ansikte', 'blink', 'flimmer', 'glitch'];

export interface Omdome {
    betyg: number;
    tema: KlippTema;
    brott: string[];
    textrader: string[];
    motivering: string;
}

export interface Granskad {
    fil: string;
    omdome: Omdome;
}

const TEMA_BESKRIVNING: Record<KlippTema, string> = {
    'ikvall': 'kvällen tänds över Sverige, prickar lyser upp, dyk ner i en stad',
    'allt': 'affischer eller lappar blir prickar på kartan, allt på ett ställe',
    'hitta-pa': 'uttråkad på soffan, molnet kommer med förslag',
    'fredag': 'fredagskänsla, skymning, stadens prickar tänds, musik/mat/scen',
    'bjud-med': 'två figurer, en bricka mellan dem, molnet knuffar ihop dem',
    'regnig': 'regn, paraply, lampor tänds inomhus: bio, museum, kurs, café',
    'skapa-eget': 'en figur sätter en gul prick på kartan, en bricka växer ur den',
    'helg': 'en stad i helgen, brickor med riktiga event, siffra läggs på efteråt',
    'budskap': 'allmän VADKUL-stämning utan särskild handling',
    'okant': 'passar inget av ovanstående',
};

/** Prompten till bildmodellen. Svenska, strikt JSON tillbaka. */
export function granskningsprompt(onskadeTeman: KlippTema[]): string {
    const teman = KLIPP_TEMAN.map(t => `- ${t}: ${TEMA_BESKRIVNING[t]}`).join('\n');
    return `Du granskar bildrutor ur ett kort reklamklipp för VADKUL, en eventkarta för Sverige. Klippet är AI-genererat och ska följa en fast stil. Du är sträng: hellre avvisa än släppa igenom något som ser fel ut.

STILEN SOM KRÄVS
- Mjuk 2.5D-illustration, aldrig fotorealism, aldrig realistiska ansikten eller stockfotomänniskor.
- Palett: mörk marinblå natt (#08304A till #0A5077), varmt gula prickar (#FDE047), vita runda brickor med EN emoji, vitt moln-maskot med ljusblå kant och leende. Ljusblått (#BAE6FD) får finnas. Rött, lila, orange och grönt bara inuti emojis.
- Ingen text, inga bokstäver, inga siffror, inga loggor, inga skyltar, inga appskärmar i bild (text läggs på efteråt).
- Lugn: en kamerarörelse i taget, inget flimmer, inga blixtar, inga hårda klipp, ingen konfetti.
- Övre tredjedelen av bilden är lugn och tom (där hamnar texten), nedre femtedelen fri från viktiga detaljer.
- Sista rutorna ska vara en stilla, centrerad landning med brickor och molnet.

TEMAN (välj det som passar bäst)
${teman}

Önskade teman i dag, i prioritetsordning: ${onskadeTeman.join(', ')}.

BETYG 0-100
- 90-100: helt enligt stilen, tydligt tema, vacker.
- 70-89: enligt stilen med små skavanker (en konstig form, lite rörigt).
- 40-69: stilen brister (fel färger, rörigt, otydligt tema).
- 0-39: text/loggor i bild, realistiska ansikten, flimmer, eller helt fel stil.
Hårda brott som alltid ger under 40: text eller bokstäver i bild, logga, realistiska ansikten, blinkande/flimmer/glitch.

TEXTRADER
Föreslå två textrader på svenska som kan läggas på klippet: en rubrik (en fråga funkar bäst) och ett svar. Max sex ord per rad. Du-tilltal, som en granne som tipsar, aldrig reklamröst. Inga emojis, inga siffror, högst ett utropstecken totalt, inga versaler. Exempel: "Vad händer ikväll?" / "Allt som händer, på en karta".

Svara med ENBART ett JSON-objekt, inget annat:
{"tema":"<ett av temana>","betyg":<0-100>,"brott":["<kort beskrivning per brott, tom lista om inga>"],"textrader":["<rubrik>","<svar>"],"motivering":"<en mening>"}`;
}

/** Räddar en lista av strängar ur ett kapat svar: parseLlmJson tar bara
 *  skalära fält, så "brott":["text i bild"] försvinner annars. */
export function raddaStrangLista(raw: string, falt: string): string[] | null {
    const m = raw.match(new RegExp(`"${falt}"\\s*:\\s*\\[([^\\]]*)`));
    if (!m) return null;
    return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => {
        try { return JSON.parse(`"${x[1]}"`) as string; } catch { return x[1]; }
    });
}

/** Tolkar modellens svar. null när inget användbart finns. */
export function tolkaOmdome(raw: string, data: TextData = {}): Omdome | null {
    const j = parseLlmJson(raw);
    if (!j) return null;
    if (j.brott === undefined) { const r = raddaStrangLista(raw, 'brott'); if (r) j.brott = r; }
    if (j.textrader === undefined) { const r = raddaStrangLista(raw, 'textrader'); if (r) j.textrader = r; }
    const betygRaw = typeof j.betyg === 'number' ? j.betyg : Number(j.betyg);
    if (!Number.isFinite(betygRaw)) return null;
    const betyg = Math.max(0, Math.min(100, Math.round(betygRaw)));
    const temaRaw = String(j.tema ?? '').toLowerCase().replace(/ä/g, 'a').replace(/å/g, 'a').replace(/ö/g, 'o').replace(/\s+/g, '-');
    const tema = (KLIPP_TEMAN as string[]).includes(temaRaw) ? (temaRaw as KlippTema) : 'okant';
    const brott = Array.isArray(j.brott) ? j.brott.map(b => String(b)).filter(Boolean) : [];
    const textrader = (Array.isArray(j.textrader) ? j.textrader : [])
        .map(t => String(t).trim())
        .filter(t => t && kontrolleraTextrad(t, data).length === 0)
        .slice(0, 2);
    const motivering = typeof j.motivering === 'string' ? j.motivering : '';
    return { betyg, tema, brott, textrader, motivering };
}

/** Hårt brott i listan, oavsett vad betyget säger. */
export function harHartBrott(brott: string[]): boolean {
    const lagt = brott.map(b => b.toLowerCase());
    return lagt.some(b => HARDA_BROTT.some(h => b.includes(h)));
}

export function godkant(o: Omdome, minBetyg = MIN_BETYG): boolean {
    return o.betyg >= minBetyg && !harHartBrott(o.brott);
}

/**
 * Bästa godkända klipp: önskat tema i prioritetsordning först (ett klipp
 * med önskat tema och 75 slår ett främmande med 95), sedan betyg.
 */
export function valjBasta(granskade: Granskad[], onskade: KlippTema[], minBetyg = MIN_BETYG): Granskad | null {
    const rang = (t: KlippTema): number => {
        const i = onskade.indexOf(t);
        return i === -1 ? onskade.length : i;
    };
    const ok = granskade.filter(g => godkant(g.omdome, minBetyg));
    ok.sort((a, b) => rang(a.omdome.tema) - rang(b.omdome.tema) || b.omdome.betyg - a.omdome.betyg || a.fil.localeCompare(b.fil));
    return ok[0] ?? null;
}

/** Kort rad till Telegram per klipp. */
export function beskrivOmdome(g: Granskad): string {
    const o = g.omdome;
    const status = godkant(o) ? 'godkänt' : 'avvisat';
    const brott = o.brott.length ? ` (${o.brott.join(', ')})` : '';
    return `${g.fil}: ${status}, ${o.betyg}/100, tema ${o.tema}${brott}`;
}
