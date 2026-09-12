/**
 * Säker serialisering för inline-<script>-inbäddning (JSON-LD m.m.).
 *
 * JSON.stringify escapar INTE `<` — en skrapad eventtitel/beskrivning som
 * innehåller "</script><script>…" bryter sig annars ur script-taggen och kör
 * på stadssidorna (lagrad XSS via källdata: vem som helst kan skapa ett
 * publikt FB-event med riggad titel som skrapan plockar upp). `<` är
 * exakt samma JSON-värde, men kan aldrig avsluta en tagg. U+2028/2029
 * escapas också — de är radbrytare i JS men inte i JSON och kraschar
 * inline-skript (och är därför skrivna som \u-escapes även HÄR i koden;
 * literala tecken överlever inte alla verktygskedjor).
 *
 * Använd för ALLT som serialiseras in i dangerouslySetInnerHTML — även
 * innehåll som "bara" är statiskt idag (djupförsvar: nästa fält någon lägger
 * till ska inte återinföra hålet).
 */
export function safeJsonLd(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
