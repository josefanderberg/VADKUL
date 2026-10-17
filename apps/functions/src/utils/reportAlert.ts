/**
 * Ren logik för anmälningsnotisen (reports.ts kör den): pushtexten som går
 * till admin när en ny anmälan landar i reports. App Store-regel 1.2 kräver
 * agerande inom 24 timmar, så notisen ska bära nog med sammanhang för att
 * kunna prioriteras direkt i handen: skäl, avsändare, event och meddelandet.
 *
 * Dokumentformen är chatReportDoc (FRYST - apps/web utils/chatModeration och
 * appens lib/moderering skriver den, reports-regeln låser den). Läses ändå
 * defensivt: notisen får aldrig krascha på ett konstigt dokument.
 */

export interface ReportLike {
    reason?: unknown;
    text?: unknown;
    senderName?: unknown;
    eventTitle?: unknown;
    chat?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const klipp = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function reportPushText(d: ReportLike): { title: string; body: string } {
    const skäl = str(d.reason) || 'Anmälan';
    const avsändare = str(d.senderName) || 'okänd avsändare';
    const event = klipp(str(d.eventTitle), 60);
    const meddelande = klipp(str(d.text), 120);
    const rader = [
        `${skäl} - ${avsändare}${event ? ` i ${event}` : ''}.`,
        meddelande ? `"${meddelande}"` : '',
    ].filter(Boolean);
    return {
        title: d.chat === 'private' ? '⚑ Ny anmälan i en privat chatt' : '⚑ Ny anmälan i chatten',
        body: klipp(rader.join(' '), 220),
    };
}
