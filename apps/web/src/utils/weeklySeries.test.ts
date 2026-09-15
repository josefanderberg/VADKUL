import { describe, it, expect } from 'vitest';
import {
    normalizeIntervalWeeks,
    occurrencesForWeeks,
    weeksForOccurrences,
    seriesLastDate,
    occurrencesLeftFrom,
    seriesEndDate,
    seriesLabel,
    seriesRhythmLabel,
} from './weeklySeries';
import type { LinkEvent } from '@/types';

const serie = (over: Partial<LinkEvent>): LinkEvent =>
    ({ id: 'doc1', title: 'Destilleribesök', time: new Date(2026, 8, 19, 17, 0), repeatWeekly: true, ...over } as LinkEvent);

describe('normalizeIntervalWeeks', () => {
    it('2 är varannan vecka, allt annat är varje vecka', () => {
        expect(normalizeIntervalWeeks(2)).toBe(2);
        expect(normalizeIntervalWeeks(1)).toBe(1);
        expect(normalizeIntervalWeeks(undefined)).toBe(1);
        expect(normalizeIntervalWeeks(0)).toBe(1);
        expect(normalizeIntervalWeeks(-3)).toBe(1);
        expect(normalizeIntervalWeeks(2.5)).toBe(1);
    });
});

describe('veckor ↔ gånger', () => {
    it('varje vecka: veckor och gånger är samma tal', () => {
        expect(occurrencesForWeeks(4, 1)).toBe(4);
        expect(weeksForOccurrences(4, 1)).toBe(4);
    });

    it('varannan vecka: 8 veckor = 4 gånger (samma fall som expandWeekly)', () => {
        expect(occurrencesForWeeks(8, 2)).toBe(4);
    });

    it('varannan vecka: gånger → veckor blir ALLTID ojämnt, ingen tom sista vecka', () => {
        expect(weeksForOccurrences(2, 2)).toBe(3);
        expect(weeksForOccurrences(4, 2)).toBe(7);
        expect(weeksForOccurrences(26, 2)).toBe(51); // ryms i reglernas tak 52
    });

    it('jämna veckotal med varannan-rytm avrundas NED — sista veckan är tom', () => {
        expect(occurrencesForWeeks(4, 2)).toBe(2); // vecka 1 och 3
        expect(occurrencesForWeeks(7, 2)).toBe(4);
    });

    it('utan veckor är serien obegränsad', () => {
        expect(occurrencesForWeeks(undefined, 2)).toBeNull();
        expect(occurrencesForWeeks(0, 1)).toBeNull();
    });

    it('rundturen bevarar antalet gånger', () => {
        for (const times of [2, 3, 5, 12]) {
            for (const interval of [1, 2]) {
                expect(occurrencesForWeeks(weeksForOccurrences(times, interval), interval)).toBe(times);
            }
        }
    });
});

describe('seriesLastDate', () => {
    it('varje vecka: fjärde gången är tre veckor efter starten', () => {
        expect(seriesLastDate(new Date(2026, 8, 19, 17, 0), 4, 1)).toEqual(new Date(2026, 9, 10, 17, 0));
    });

    it('varannan vecka: fjärde gången är sex veckor efter starten', () => {
        expect(seriesLastDate(new Date(2026, 8, 19, 17, 0), 4, 2)).toEqual(new Date(2026, 9, 31, 17, 0));
    });

    it('klockslaget överlever sommartidsbytet (25/10 2026)', () => {
        const last = seriesLastDate(new Date(2026, 9, 17, 17, 0), 3, 2);
        expect(last.getHours()).toBe(17);
        expect(last).toEqual(new Date(2026, 10, 14, 17, 0));
    });
});

describe('occurrencesLeftFrom', () => {
    const slut = new Date(2026, 10, 14, 17, 0); // 14 nov

    it('räknar tillfället man står på och alla kvar till slutet', () => {
        expect(occurrencesLeftFrom(new Date(2026, 9, 17, 17, 0), slut, 2)).toBe(3); // 17/10, 31/10, 14/11
    });

    it('sista tillfället har en gång kvar — sig självt', () => {
        expect(occurrencesLeftFrom(slut, slut, 2)).toBe(1);
    });

    it('varje vecka räknar varje vecka', () => {
        expect(occurrencesLeftFrom(new Date(2026, 10, 7, 17, 0), slut, 1)).toBe(2);
    });
});

describe('seriesEndDate', () => {
    it('basdokumentet: slutet räknas ur repeatWeeks', () => {
        const end = seriesEndDate(serie({ repeatWeeks: 7, repeatIntervalWeeks: 2 }));
        expect(end).toEqual(new Date(2026, 9, 31, 17, 0)); // 19/9 + 6 veckor
    });

    it('ett utvecklat tillfälle litar på seriesEndsAt, inte sin egen tid', () => {
        const end = seriesEndDate(serie({
            time: new Date(2026, 9, 31, 17, 0),
            repeatWeeks: 7,
            repeatIntervalWeeks: 2,
            seriesEndsAt: new Date(2026, 9, 31, 17, 0),
        }));
        expect(end).toEqual(new Date(2026, 9, 31, 17, 0));
    });

    it('obegränsad serie har inget slut', () => {
        expect(seriesEndDate(serie({}))).toBeNull();
    });

    it('vanligt event är ingen serie', () => {
        expect(seriesEndDate(serie({ repeatWeekly: false, repeatWeeks: 4 }))).toBeNull();
    });
});

describe('seriesLabel', () => {
    const now = new Date(2026, 8, 16);

    it('begränsad varannan-serie: rytm, veckodag och slutdatum', () => {
        expect(seriesLabel(serie({ repeatWeeks: 7, repeatIntervalWeeks: 2 }), now))
            .toBe('Varannan lördag · t.o.m. 31 okt.');
    });

    it('obegränsad veckoserie säger tills vidare', () => {
        expect(seriesLabel(serie({}), now)).toBe('Varje lördag · tills vidare');
    });

    it('slut nästa år får årtal med sig', () => {
        expect(seriesLabel(serie({ repeatWeeks: 26 }), now)).toContain('2027');
    });

    it('vanligt event har ingen rad', () => {
        expect(seriesLabel(serie({ repeatWeekly: false }), now)).toBeNull();
    });
});

describe('seriesRhythmLabel', () => {
    it('chippet i profilen', () => {
        expect(seriesRhythmLabel({ repeatIntervalWeeks: 2 })).toBe('Varannan vecka');
        expect(seriesRhythmLabel({})).toBe('Varje vecka');
    });
});
