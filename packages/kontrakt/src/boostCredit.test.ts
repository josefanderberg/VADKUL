import { describe, expect, it } from 'vitest';
import { creditDaysFor, DAY_MS, eventEndsAtMs, localDayAfter } from './boostCredit';

const T = (s: string) => Date.parse(s);

describe('localDayAfter (svenskt dygn)', () => {
    it('vintertid: lördag 19:00 i Stockholm → söndag 00:00 Stockholm = lördag 23:00 UTC', () => {
        expect(localDayAfter(T('2026-11-07T18:00:00Z'))).toBe(T('2026-11-07T23:00:00Z'));
    });
    it('kl 23:30 svensk tid hör fortfarande till samma dygn', () => {
        expect(localDayAfter(T('2026-11-07T22:30:00Z'))).toBe(T('2026-11-07T23:00:00Z'));
        // 00:30 svensk tid (23:30 UTC) är redan nästa dygn.
        expect(localDayAfter(T('2026-11-07T23:30:00Z'))).toBe(T('2026-11-08T23:00:00Z'));
    });
    it('sommartid: midnatten ligger kl 22:00 UTC', () => {
        expect(localDayAfter(T('2026-07-10T12:00:00Z'))).toBe(T('2026-07-10T22:00:00Z'));
    });
    it('över sommartidsbytet 25/10 2026 (dygnet är 25 timmar)', () => {
        expect(localDayAfter(T('2026-10-24T12:00:00Z'))).toBe(T('2026-10-24T22:00:00Z'));
        expect(localDayAfter(T('2026-10-25T12:00:00Z'))).toBe(T('2026-10-25T23:00:00Z'));
    });
    it('månads- och årsskifte', () => {
        expect(localDayAfter(T('2026-12-31T20:00:00Z'))).toBe(T('2026-12-31T23:00:00Z'));
    });
});

describe('creditDaysFor', () => {
    // Veckoboost köpt onsdag 12:00 för ett lördagsevent.
    const from = T('2026-11-04T11:00:00Z');       // ons 12:00 svensk tid
    const until = from + 7 * DAY_MS;              // ons 12:00 veckan efter
    const lördag = T('2026-11-07T18:00:00Z');     // lör 19:00

    it('eventet har inte varit → null (avräkna inte än)', () => {
        expect(creditDaysFor({ fromMs: from, untilMs: until }, lördag, T('2026-11-07T20:00:00Z'))).toBeNull();
        expect(creditDaysFor({ fromMs: from, untilMs: until }, lördag, T('2026-11-07T22:59:59Z'))).toBeNull();
    });
    it('dygnet efter eventet: hela dagar kvar minus en dags avgift', () => {
        // sön 00:00 → ons 12:00 = 3,5 dagar → 3 hela → minus 1 = 2
        expect(creditDaysFor({ fromMs: from, untilMs: until }, lördag, T('2026-11-07T23:00:00Z'))).toBe(2);
        // Samma svar senare - avräkningen beror inte på när man frågar.
        expect(creditDaysFor({ fromMs: from, untilMs: until }, lördag, T('2026-11-20T12:00:00Z'))).toBe(2);
    });
    it('månadsboost för ett event dagen efter köpet ger nästan allt tillbaka', () => {
        const m = from + 30 * DAY_MS;
        const torsdag = T('2026-11-05T18:00:00Z');
        // fre 00:00 → 30 dagar efter ons 12:00 = 28,5 dagar → 28 → 27
        expect(creditDaysFor({ fromMs: from, untilMs: m }, torsdag, T('2026-11-06T12:00:00Z'))).toBe(27);
    });
    it('boosten tog slut före eller samma dygn som eventet → noll, aldrig negativt', () => {
        const dag = from + DAY_MS;
        expect(creditDaysFor({ fromMs: from, untilMs: dag }, lördag, T('2026-11-10T12:00:00Z'))).toBe(0);
        // Exakt en hel dag kvar = avgiften äter upp den.
        expect(creditDaysFor({ fromMs: from, untilMs: T('2026-11-08T23:00:00Z') }, lördag, T('2026-11-10T12:00:00Z'))).toBe(0);
    });
    it('fönstret som börjar efter eventet (förlängning) räknas från sin egen start', () => {
        const f2 = T('2026-11-09T11:00:00Z');
        expect(creditDaysFor({ fromMs: f2, untilMs: f2 + 7 * DAY_MS }, lördag, T('2026-11-10T12:00:00Z'))).toBe(6);
    });
});

describe('eventEndsAtMs', () => {
    const start = T('2026-11-07T18:00:00Z');
    it('vanligt event: sin egen tid', () => {
        expect(eventEndsAtMs({ timeMs: start })).toBe(start);
        expect(eventEndsAtMs({ timeMs: start, repeatWeekly: false })).toBe(start);
    });
    it('dagsserie: sista dagen, eller seriesEndsAt när det finns', () => {
        expect(eventEndsAtMs({ timeMs: start, repeatDays: 3 })).toBe(start + 2 * DAY_MS);
        expect(eventEndsAtMs({ timeMs: start, repeatDays: 3, seriesEndsAtMs: start + 5 * DAY_MS })).toBe(start + 5 * DAY_MS);
        // Ogiltigt dagantal = inget dagsserie-fält.
        expect(eventEndsAtMs({ timeMs: start, repeatDays: 1 })).toBe(start);
    });
    it('veckoserie: sista tillfället ur repeatWeeks + rytm; tills vidare = null', () => {
        expect(eventEndsAtMs({ timeMs: start, repeatWeekly: true })).toBeNull();
        expect(eventEndsAtMs({ timeMs: start, repeatWeekly: true, repeatWeeks: 4 })).toBe(start + 3 * 7 * DAY_MS);
        // Varannan vecka i 8 veckor = 4 gånger, sista efter 6 veckor.
        expect(eventEndsAtMs({ timeMs: start, repeatWeekly: true, repeatWeeks: 8, repeatIntervalWeeks: 2 })).toBe(start + 6 * 7 * DAY_MS);
        expect(eventEndsAtMs({ timeMs: start, repeatWeekly: true, repeatWeeks: 8, seriesEndsAtMs: start + DAY_MS })).toBe(start + DAY_MS);
    });
});
