// ── Brick-etiketter: texten under eventmarkörerna ──────────────────────────
// Ren, React-fri modul (samma kontrakt som v2MapBricka). Bakgrund: verklig
// användarfeedback — emoji + kategorifärg räcker inte för att förstå vad en
// bricka är. Etiketterna ritas av ett eget GL-textlager ('plain-events-labels')
// som visar kategorinamn vid mellanzoom och (kapad) eventtitel vid hög zoom.
//
// Lagret läser en liten SPEGELKÄLLA med bara de TÄNDA, ej passerade grupperna
// (labelFeaturesFrom) i stället för text-fält på huvudkällan. Skälet är hårt:
// MapLibres textkollision kan inte läsa feature-state, så osynliga etiketter
// (tusentals features, ~50 tända) skulle ändå skriva in sig i kollisions-
// indexet och tränga undan baskartans ortsnamn. Spegeln gör kollisionen
// korrekt OCH billig (≤ ~100 features).
//
// ALLT här måste vara deterministiskt: labelCat/labelTitle ingår i
// samePlainFeatures-jämförelsen, och en helper som ger olika svar för samma
// input skulle få varje no-op-push att se "ny" ut och döda våg-streamen.

import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';

// Maxlängd (i tecken, Array.from-räknade så emoji/surrogatpar inte klyvs)
// innan titeln kapas med "…". En rad under en 40 px-bricka — längre läses inte.
export const LABEL_MAX_CHARS = 18;

// Kartetikettens kategorinamn: ETT ord (ägarbeslut 25/8) — "Sport", inte
// "Sport & träning". Kategorikolumnen och övriga UI:t behåller de fulla
// EVENT_CATEGORIES-etiketterna; det här är bara kartans kortform.
// Okänd/saknad kategori → "Övrigt" (samma fallback som eventEmoji/brickaBodyHex).
const SHORT_CATEGORY_LABEL: Record<EventCategoryType, string> = {
    music: 'Musik',
    stage: 'Scen',
    art: 'Konst',
    sport: 'Sport',
    food: 'Mat',
    market: 'Marknad',
    party: 'Fest',
    social: 'Socialt',
    course: 'Kurs',
    family: 'Familj',
    other: 'Övrigt',
};
export function categoryLabel(category: string | undefined): string {
    const key: EventCategoryType = category && category in EVENT_CATEGORIES
        ? (category as EventCategoryType)
        : 'other';
    return SHORT_CATEGORY_LABEL[key] ?? 'Övrigt';
}

// Kapa en etikettext till LABEL_MAX_CHARS tecken + "…". Array.from så att
// surrogatpar (emoji i titlar) aldrig klyvs mitt itu; avslutande blanksteg
// trimmas så det inte blir "Titel …".
export function truncateLabel(text: string, max = LABEL_MAX_CHARS): string {
    const chars = Array.from(text.trim());
    if (chars.length <= max) return chars.join('');
    return chars.slice(0, max).join('').trimEnd() + '…';
}

// Etikettparet för DET EVENT brickan visar just nu. Regeln är enkel: texten
// följer alltid brickans synliga frame — en cyklande multibricka får sin
// etikett uppdaterad av cykel-pumpen i samma tick som emojin byter (aldrig en
// neutral "N evenemang"-text; "+N"-badgen bär redan antalet). plainData sätter
// representantens etikett som utgångsläge, spegelkällan skriver över med
// aktuell frame (se syncLabelSource i V2Map).
export function eventLabels(title: string, category: string | undefined): { labelCat: string; labelTitle: string } {
    return { labelCat: categoryLabel(category), labelTitle: truncateLabel(title) };
}

// Önske-brickornas etiketter ("wish:"-nycklar): kategorinivån säger bara att
// det är en önskan, titelnivån visar vad som önskas.
export function wishLabels(title: string): { labelCat: string; labelTitle: string } {
    return { labelCat: 'Önskan', labelTitle: truncateLabel(`Önskas: ${title}`) };
}

// Spegelkällans innehåll: de features vars reveal-opacity passerat 0.5 och som
// inte är passerade ("har varit"-grupper står som prickar — text över en släckt
// bricka vore en svävande etikett). Ren funktion över vanliga strukturer så den
// kan testas utan Mapbox; V2Map matar in plainFeaturesRef ∩ revealWrittenRef.
export function labelFeaturesFrom<
    F extends { properties: { key: string; past: boolean } },
>(features: F[], litOps: Map<string, number>): F[] {
    return features.filter(f => (litOps.get(f.properties.key) ?? 0) > 0.5 && !f.properties.past);
}
