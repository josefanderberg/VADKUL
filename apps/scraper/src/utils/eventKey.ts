/**
 * Kort join-nyckel mellan aggregatets lager.
 *
 * Bakgrund: cards-lagret bar tidigare hela event-url:en TVÅ gånger (`id` och
 * `url`, identiska för 98,3 % av eventen) medan destinations bar den en tredje
 * gång. Snitt-url:en är 78 tecken → ~22 % av cards-payloaden var en nyckel vi
 * redan skickat. Den här hashen ersätter `id` i cards; destinations behåller
 * hela url:en (den är primärnyckel och används som länk).
 *
 * VARFÖR cyrb53 och inte SHA-1: nyckeln måste räknas fram SYNKRONT i
 * webbläsaren (merge-funktionen är synkron), och Web Crypto är async. cyrb53
 * är 53 bitar, beroendefri och ger samma sträng i Node och i browsern. Mätt på
 * skarpa datat 2026-09-11: 0 kollisioner på 47 613 url:er. Kollisionsrisken
 * växer kvadratiskt — vid 500 000 event är den fortfarande ~1 på 70 000.
 *
 * ⚠️ Den här filen har en TVILLING i apps/web/src/utils/eventKey.ts. Ändras
 * algoritmen här MÅSTE den ändras där också, annars slutar korten hitta sina
 * event. eventKey.test.ts i båda paketen låser fast samma facit-värden.
 */
export function eventKey(url: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < url.length; i++) {
        const ch = url.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
