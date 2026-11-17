/**
 * Julsäsongen för välkomstrutans julvariant (#255): snö, julstjärna och
 * tomteluva på maskoten. Från 15 november, när julmarknaderna börjar fylla
 * kartan, till och med trettondedag jul (6 januari). Lokal tid - det är
 * besökarens kalender som räknas.
 */
export function ärJulsäsong(datum: Date): boolean {
    const månad = datum.getMonth(); // 0 = januari
    const dag = datum.getDate();
    if (månad === 10) return dag >= 15; // november
    if (månad === 11) return true; // december
    if (månad === 0) return dag <= 6; // januari t.o.m. trettondagen
    return false;
}
