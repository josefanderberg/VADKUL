/**
 * Julsäsongen för välkomstrutans julvariant (#255): glittrande stjärnor,
 * snö bakom rutan och tomteluva på maskoten. Från första advent till och med
 * trettondedag jul (6 januari). Startade först 15 november, men Josef drog
 * tillbaka den 17/11 2026: "Det är lite för tidigt kanske?" - första advent
 * är när julen börjar på riktigt i Sverige. Lokal tid: det är besökarens
 * kalender som räknas.
 */
export function ärJulsäsong(datum: Date): boolean {
    const månad = datum.getMonth(); // 0 = januari
    if (månad === 0) return datum.getDate() <= 6; // januari t.o.m. trettondagen
    if (månad !== 10 && månad !== 11) return false; // bara november-december
    const advent = förstaAdvent(datum.getFullYear());
    return datum.getTime() >= advent.getTime();
}

/** Första advent: fjärde söndagen före juldagen (27 november - 3 december),
 *  vid midnatt lokal tid. */
export function förstaAdvent(år: number): Date {
    const juldagen = new Date(år, 11, 25);
    const veckodag = juldagen.getDay(); // 0 = söndag
    // Söndagen närmast före juldagen (en vecka före om juldagen är söndag), sedan tre veckor till.
    const dagarTillbaka = (veckodag === 0 ? 7 : veckodag) + 21;
    return new Date(år, 11, 25 - dagarTillbaka);
}

/**
 * 🎄 JUL-CHIPPETS FÖNSTER (#272, ägarbeslut 22/11 2026) - INTE samma sak som
 * julsäsongen ovan. Jultemat (stjärnor, snö, tomteluva) väntar på första
 * advent; Jul-chippet i kategoriraden är ett sätt att HITTA juleventen och
 * behövs tidigare - julmarknaderna börjar redan i slutet av november och
 * reklamen för dem går redan. Synligt 20 november till och med 26 december
 * (annandag jul), lokal tid. Ändra inte det ena fönstret för att det andra
 * ska stämma.
 */
export function ärJulchipSäsong(datum: Date): boolean {
    const månad = datum.getMonth(); // 0 = januari
    const dag = datum.getDate();
    if (månad === 10) return dag >= 20;
    if (månad === 11) return dag <= 26;
    return false;
}
