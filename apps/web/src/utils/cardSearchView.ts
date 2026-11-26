/**
 * Ska en ändring i kortsöket öppna träfflistan? (26/11)
 *
 * Förr växlade kortet till listvyn bara på FÖRSTA tecknet (tomt fält → text).
 * Men söktermen lever kvar när man väljer ett event ur träfflistan - arket
 * stängs och kortet visar eventet med den gamla termen kvar i fältet. Den som
 * sedan skrev en ny sökning blev stående på det valda eventet: fältet var
 * aldrig tomt, så "första tecknet" kom aldrig (kartan filtrerades om, kortet
 * inte). Josef 26/11: "om jag öppnat ett event i sökrutan. och vill söka på
 * något nytt. då går inte det om det fönstret är uppe. Man stannar kvar på
 * det eventet man tidigare har valt."
 *
 * Nu öppnar VARJE ändring av termen listan när den inte redan visas. Ett
 * mellanslag i kanten är ingen ändring och flyttar ingen vy; ett tömt fält
 * hanteras av anroparen (tillbaka till infovyn).
 *
 * Ren modul, ingen React.
 */
export type CardView = 'info' | 'chat' | 'nearby';

export function searchEditOpensList(prevQuery: string, nextQuery: string, view: CardView): boolean {
    const next = nextQuery.trim();
    if (!next || view === 'nearby') return false;
    return next !== prevQuery.trim();
}
