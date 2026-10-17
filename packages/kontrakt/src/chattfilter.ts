/**
 * Ordfiltret i eventchatten (App Store-regel 1.2: appar med användarskapat
 * innehåll måste ha en metod som filtrerar stötande innehåll). Bor i
 * kontraktet så webben och appen stoppar EXAKT samma ord - filtret körs vid
 * sändning: meddelandet skrivs aldrig till Firestore och avsändaren får veta
 * varför (ORDFILTER_STOPP).
 *
 * Listan riktar in sig på slurs, grova sexuella tillmälen och uppenbart
 * kränkande ord - inte vardagssvordomar ("jävla", "fan" går igenom; ett
 * filter som stoppar halva vardagssvenskan skulle bara reta upp folk).
 * OBS: engelskans "slut" är medvetet INTE med - "slut" är vanlig svenska.
 *
 * Två matchningssätt:
 *  - ORD matchas som EGNA ORD (exakta former): "hora" får inte fälla
 *    "thorax", "cunt" inte "Scunthorpe", "mongo" inte "Mongoliet".
 *  - STAMMAR matchas VAR DE ÄN förekommer i texten (bokstäverna ihopslagna,
 *    så "n i g g e r" och sammansättningar som "negerjävlar" fångas) - bara
 *    stammar som aldrig ingår i oskyldiga ord.
 */

// Enkel leet-avkodning så "H0RA" och "f1tta" inte slinker förbi. Vanliga
// siffror i text ("kl 13") blir visserligen bokstäver, men de token som
// uppstår matchar aldrig listorna, så inget oskyldigt stoppas av det.
const LEET: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
};

function normalisera(text: string): string {
    return text.toLowerCase().replace(/[013457@$]/g, c => LEET[c] ?? c);
}

/** Stoppas som egna ord - exakta former (böjningarna listas explicit). */
const ORD = new Set([
    // svenska
    'hora', 'horan', 'horor', 'hororna', 'horunge', 'horungen', 'horungar',
    'fitta', 'fittan', 'fittor', 'fittorna',
    'kuk', 'kuken', 'kukar', 'kukarna', 'kukhuvud',
    'knulla', 'knullar', 'knullad', 'knullade',
    'runka', 'runkar',
    'slampa', 'slampan', 'slampor', 'slamporna',
    'luder', 'ludret',
    'subba', 'subban',
    'mongo', 'mongon',
    'neger', 'negern', 'negrer', 'negrerna',
    // engelska
    'cunt', 'cunts',
    'whore', 'whores',
    'bitch', 'bitches',
    'retard', 'retards', 'retarded',
]);

/** Stoppas var de än förekommer (texten hopslagen till bara bokstäver). */
const STAMMAR = [
    'nigger', 'nigga',
    'negerjäv', 'horjäv', 'bögjäv',
    'svartskall',
    'mongoloid',
    'faggot',
    'fuck',
    'barnporr',
];

/** Texten som UI:t visar när ett meddelande stoppas - samma i webb och app. */
export const ORDFILTER_STOPP =
    'Meddelandet stoppades av ordfiltret. Ta bort det grova språket och försök igen.';

/**
 * Ordfiltret: det stötande ord som hittades, eller null när texten är okej.
 * UI:t behöver inte visa ordet (ORDFILTER_STOPP räcker) - returvärdet finns
 * för testerna och loggning.
 */
export function hittaStötandeOrd(text: string): string | null {
    const norm = normalisera(text);
    const kompakt = norm.replace(/\P{L}+/gu, '');
    for (const stam of STAMMAR) {
        if (kompakt.includes(stam)) return stam;
    }
    for (const token of norm.split(/\P{L}+/u)) {
        if (token && ORD.has(token)) return token;
    }
    return null;
}
