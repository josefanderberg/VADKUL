/**
 * Textbyggare för nattkedjans Telegram-rapporter (ersatte Teams Adaptive
 * Cards 2026-09-04 — ägaren har inte kvar Teams-kontot). Telegram tar HTML
 * (parse_mode=HTML) med <b>, <i>, <code>, <pre>; max 4096 tecken per
 * meddelande. Rena funktioner — testade i telegramReport.test.ts.
 */

export const TELEGRAM_MAX = 4000;   // marginal under 4096

export type Fact = { title: string; value: string };

export function escapeHtml(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** "• <b>Titel:</b> värde" per rad. */
export function factLines(facts: Fact[]): string {
    return facts.map(f => `• <b>${escapeHtml(f.title)}:</b> ${escapeHtml(f.value)}`).join('\n');
}

/** Rubrik i fetstil + rader; tom sektion → tom sträng. */
export function section(title: string, body: string): string {
    return body.trim() ? `\n<b>${escapeHtml(title)}</b>\n${body}` : '';
}

export function preBlock(text: string): string {
    return `<pre>${escapeHtml(text)}</pre>`;
}

/** Kapa till Telegram-gränsen utan att lämna en öppen <pre>. */
export function clampTelegram(text: string, max = TELEGRAM_MAX): string {
    if (text.length <= max) return text;
    let cut = text.slice(0, max - 1).trimEnd();
    const opens = (cut.match(/<pre>/g) || []).length;
    const closes = (cut.match(/<\/pre>/g) || []).length;
    cut += '…';
    if (opens > closes) cut += '</pre>';
    return cut;
}
