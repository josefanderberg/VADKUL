/**
 * Botar som renderar kartan och hämtar event-lagren (/api/events, /api/event).
 *
 * Loggen 14/10: Reflectionbot, Baiduspider-render, OAI-SearchBot och Googlebot
 * stod för en tredjedel av SSR-anropen - varje CDN-miss kostar CPU i SSR-
 * funktionen men ger inget sökbart (markörerna är inte text; stadssidorna och
 * /e/-sidorna är det som indexeras). robots.txt stänger /api/ för de snälla,
 * den här vakten tar resten innan något läses ur Firestore.
 *
 * Medvetet snäv: bara "compatible; <namn>bot/spider/crawler" (så skriver alla
 * stora crawlers) plus Metas externalagent. Ett löst /bot/i träffar riktiga
 * telefoner (CUBOT), och HeadlessChrome släpps igenom - egna verktyg kan
 * spela in kartan headless.
 */
const API_BOT_RE = /compatible;[^)]*?(?:bot|spider|crawler)\b|meta-externalagent/i;

export function isApiBot(userAgent: string | null | undefined): boolean {
    return !!userAgent && API_BOT_RE.test(userAgent);
}
