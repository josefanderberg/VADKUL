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
 *
 * Samma regel gäller i webbläsaren (linkEventService + boot-scriptet i
 * (v2)/layout.tsx): en bot-rendering hämtar ingen eventdata alls. Annars föll
 * klienten vidare från 403:an till de statiska helfilerna (/events-*.json,
 * 1,8 + 1,1 MB br per rendering) - spärren gjorde botarna DYRARE i Hosting-
 * bandbredd. Exporteras därför som RegExp, så boot-scriptet kan bygga samma.
 */
export const API_BOT_RE = /compatible;[^)]*?(?:bot|spider|crawler)\b|meta-externalagent/i;

export function isApiBot(userAgent: string | null | undefined): boolean {
    return !!userAgent && API_BOT_RE.test(userAgent);
}

/**
 * Rubriken på vakternas 403. Klienten skiljer på så sätt en bot-spärr från
 * andra 403 (t.ex. en Cloud Run-behörighet som fallit bort efter en deploy,
 * där de statiska reservfilerna ska rädda kartan) - efter en bot-spärr tas
 * reservfilerna aldrig. Gäller om webbläsarens navigator.userAgent inte
 * avslöjar boten men HTTP-headern gör det.
 */
export const BOT_REFUSAL_HEADER = 'x-vadkul-bot';

/** Är svaret vakternas bot-spärr (403 + BOT_REFUSAL_HEADER)? Tål teststubbar utan headers. */
export function isBotRefusal(res: { status: number; headers?: { get(name: string): string | null } }): boolean {
    return res.status === 403 && res.headers?.get(BOT_REFUSAL_HEADER) === '1';
}
