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
