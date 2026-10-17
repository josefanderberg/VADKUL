import { describe, expect, it } from 'vitest';
import { reportPushText } from './reportAlert';

describe('reportPushText', () => {
    it('bygger titel och brödtext ur ett reports-dokument', () => {
        const t = reportPushText({
            chat: 'public',
            reason: 'Hot eller trakasserier',
            senderName: 'Kalle',
            eventTitle: 'Kulturnatten',
            text: 'ett otrevligt meddelande',
        });
        expect(t.title).toBe('⚑ Ny anmälan i chatten');
        expect(t.body).toBe('Hot eller trakasserier - Kalle i Kulturnatten. "ett otrevligt meddelande"');
    });

    it('privat chatt får egen titel', () => {
        expect(reportPushText({ chat: 'private' }).title).toBe('⚑ Ny anmälan i en privat chatt');
    });

    it('tål tomma och konstiga fält', () => {
        const t = reportPushText({});
        expect(t.title).toBe('⚑ Ny anmälan i chatten');
        expect(t.body).toBe('Anmälan - okänd avsändare.');
        expect(reportPushText({ reason: 42, text: null, senderName: ['x'] }).body)
            .toBe('Anmälan - okänd avsändare.');
    });

    it('klipper långa texter så pushen aldrig sväller', () => {
        const t = reportPushText({
            reason: 'Något annat',
            senderName: 'A'.repeat(80),
            eventTitle: 'B'.repeat(200),
            text: 'C'.repeat(500),
        });
        expect(t.body.length).toBeLessThanOrEqual(220);
        expect(t.body).toContain('…');
    });
});
