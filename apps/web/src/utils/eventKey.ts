/**
 * Kort join-nyckel mellan aggregatets lager + TOLERANT uppslag av cards-lagret.
 *
 * Bakgrund: cards-lagret bar tidigare hela event-url:en TVÅ gånger (`id` och
 * `url`, identiska för 98,3 % av eventen) medan destinations bar den en tredje
 * gång. Snitt-url:en är 78 tecken → ~22 % av cards-payloaden var en nyckel vi
 * redan skickat. I det slanka formatet bär kortet i stället `h` = eventKey(url).
 *
 * VARFÖR cyrb53 och inte SHA-1: nyckeln måste räknas fram SYNKRONT (merge-
 * funktionen är synkron) och Web Crypto är async. cyrb53 är 53 bitar,
 * beroendefri och ger samma sträng i Node och i browsern. Mätt på skarpa datat
 * 2026-09-11: 0 kollisioner på 47 613 url:er.
 *
 * ⚠️ eventKey() har en TVILLING i apps/scraper/src/utils/eventKey.ts som bygger
 * aggregatet. Ändras algoritmen på ena sidan MÅSTE den ändras på den andra,
 * annars slutar korten hitta sina event. eventKey.test.ts i båda paketen låser
 * fast samma facit-värden.
 */
export function eventKey(url: string): string {
    return eventKeyNum(url).toString(36);
}

/**
 * Samma hash som TAL (heltal < 2^53, alltså exakt) — eventKey är bara dess
 * base36-sträng. Uppslaget i buildCardIndex hashar alla ~44k destinations-id:n
 * per kortmerge i webbläsaren, och toString(36) var mer än halva den kostnaden
 * (mätt 2026-09-11: 37 → 16 ms för 44k id:n på Mac minin).
 */
export function eventKeyNum(url: string): number {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < url.length; i++) {
        const ch = url.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Ett kort ur cards-lagret, i något av de två formaten. */
export interface CardLike {
    /** SLANKT format: eventKey(url). */
    h?: string;
    /** GAMMALT format: hela url:en (= destinations `id`). */
    id?: string;
}

/**
 * Uppslagsfunktion från destinations-`id` (hela url:en) till rätt kort — klarar
 * BÅDA aggregatformaten.
 *
 * Varför tolerant: aggregatet byggs om av Mac minin (nattkedjan 00:30) medan
 * webben deployas av GitHub Actions. De två byter alltså format vid olika
 * tidpunkter, och en besökare kan träffa ett nytt aggregat med en gammal
 * klient eller tvärtom. Läsaren måste klara båda tills övergången är klar —
 * annars tappar kartan sina omslagsbilder i mellanrummet.
 *
 * Gammalt format kostar INGEN hashning: saknas `h` helt i lagret slår vi bara
 * upp på id som förut. Slankt format nycklas på TALET (parseInt(h, 36) är
 * exakt för värden < 2^53) så uppslaget slipper en toString(36) per event.
 */
export function buildCardIndex<T extends CardLike>(
    cards: readonly T[],
): (destId: string) => T | undefined {
    const byId = new Map<string, T>();
    const byKey = new Map<number, T>();
    for (const c of cards) {
        if (typeof c.h === 'string' && c.h) byKey.set(parseInt(c.h, 36), c);
        else if (typeof c.id === 'string' && c.id) byId.set(c.id, c);
    }
    if (byKey.size === 0) return (destId) => byId.get(destId);
    if (byId.size === 0) return (destId) => byKey.get(eventKeyNum(destId));
    // Blandat lager ska inte kunna uppstå, men om det gör det vinner det exakta
    // id:t över hashen.
    return (destId) => byId.get(destId) ?? byKey.get(eventKeyNum(destId));
}
