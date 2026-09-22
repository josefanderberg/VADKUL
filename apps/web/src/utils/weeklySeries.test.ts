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
    normalizeRepeatDays,
    isSeriesEvent,
    seriesFieldsFor,
    lastOccurrenceFor,
    dailySeriesStart,
    dayRangeLabel,
    expandSeries,
    MAX_REPEAT_DAYS,
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

// ── Dagsserier (22/9): flera dagar i rad på ETT dokument ─────────────────────
// Fallet som startade det: Växjö Konstrunda lör 10 + sön 11 okt kl 11, inlagd
// som två separata event eftersom formuläret bara kunde veckoserier.
const konstrunda = (over: Partial<LinkEvent> = {}): LinkEvent =>
    ({ id: 'kr1', title: 'Växjö Konstrunda', time: new Date(2026, 9, 10, 11, 0), repeatDays: 2, ...over } as LinkEvent);

describe('normalizeRepeatDays / isSeriesEvent', () => {
    it('2-14 dagar är en dagsserie, allt annat är det inte', () => {
        expect(normalizeRepeatDays(2)).toBe(2);
        expect(normalizeRepeatDays(MAX_REPEAT_DAYS)).toBe(14);
        expect(normalizeRepeatDays(1)).toBeNull();
        expect(normalizeRepeatDays(15)).toBeNull();
        expect(normalizeRepeatDays(2.5)).toBeNull();
        expect(normalizeRepeatDays(undefined)).toBeNull();
    });

    it('både dagsserier och veckoserier räknas som serier', () => {
        expect(isSeriesEvent({ repeatDays: 3 })).toBe(true);
        expect(isSeriesEvent({ repeatWeekly: true })).toBe(true);
        expect(isSeriesEvent({ repeatDays: 1 })).toBe(false);
        expect(isSeriesEvent({})).toBe(false);
    });
});

describe('seriesFieldsFor (formulärets val → dokumentets fält)', () => {
    it('avbockad ruta = ingen serie', () => {
        expect(seriesFieldsFor(false, 'daily', 5)).toEqual({ repeatWeekly: false });
    });

    it('varje dag: bara repeatDays, aldrig veckofälten', () => {
        expect(seriesFieldsFor(true, 'daily', 5)).toEqual({ repeatWeekly: false, repeatDays: 5 });
    });

    it('varje dag utan antal (eller skräp) blir 2 dagar, och taket håller', () => {
        expect(seriesFieldsFor(true, 'daily', null).repeatDays).toBe(2);
        expect(seriesFieldsFor(true, 'daily', 52).repeatDays).toBe(MAX_REPEAT_DAYS);
    });

    it('veckorytmerna räknar som förut (gånger → veckor)', () => {
        expect(seriesFieldsFor(true, 1, 4)).toEqual({ repeatWeekly: true, repeatIntervalWeeks: undefined, repeatWeeks: 4 });
        expect(seriesFieldsFor(true, 2, 4)).toEqual({ repeatWeekly: true, repeatIntervalWeeks: 2, repeatWeeks: 7 });
        expect(seriesFieldsFor(true, 1, null)).toEqual({ repeatWeekly: true, repeatIntervalWeeks: undefined, repeatWeeks: undefined });
    });
});

describe('lastOccurrenceFor', () => {
    it('varje dag: 5 dagar från lördag slutar onsdag, samma klockslag', () => {
        expect(lastOccurrenceFor(new Date(2026, 9, 10, 11, 0), 5, 'daily')).toEqual(new Date(2026, 9, 14, 11, 0));
    });

    it('klockslaget överlever sommartidsbytet natten till 25/10', () => {
        const last = lastOccurrenceFor(new Date(2026, 9, 24, 19, 0), 2, 'daily');
        expect(last).toEqual(new Date(2026, 9, 25, 19, 0));
        expect(last.getHours()).toBe(19);
    });

    it('veckorytmerna går via seriesLastDate som förut', () => {
        expect(lastOccurrenceFor(new Date(2026, 8, 19, 17, 0), 4, 2)).toEqual(new Date(2026, 9, 31, 17, 0));
    });
});

describe('expandSeries: dagsserier', () => {
    it('två dagar i rad blir två tillfällen med egna id och gemensamt seriesId', () => {
        const out = expandSeries(konstrunda(), new Date(2026, 9, 1));
        expect(out.map(e => e.id)).toEqual(['kr1__2026-10-10', 'kr1__2026-10-11']);
        expect(out.every(e => e.seriesId === 'kr1')).toBe(true);
        expect(out[1].time).toEqual(new Date(2026, 9, 11, 11, 0));
        expect(out[0].seriesEndsAt).toEqual(new Date(2026, 9, 11, 11, 0));
    });

    it('första dagen passerad: resten av dagarna finns kvar', () => {
        const out = expandSeries(konstrunda({ repeatDays: 3 }), new Date(2026, 9, 11));
        expect(out.map(e => e.id)).toEqual(['kr1__2026-10-11', 'kr1__2026-10-12']);
    });

    it('färdigspelad dagsserie ger tomt', () => {
        expect(expandSeries(konstrunda(), new Date(2026, 9, 12))).toEqual([]);
    });

    it('dagsserien vinner om ett dokument ändå bär båda', () => {
        const out = expandSeries(konstrunda({ repeatWeekly: true }), new Date(2026, 9, 1));
        expect(out).toHaveLength(2);
    });
});

describe('dagsseriens etiketter', () => {
    const now = new Date(2026, 8, 22);

    it('raden på kortet: antal dagar och datumspannet', () => {
        expect(seriesLabel(konstrunda(), now)).toBe('2 dagar · lör 10-sön 11 okt.');
    });

    it('etiketten är densamma från dag 2 (räknas bakåt från seriens slut)', () => {
        const [, dag2] = expandSeries(konstrunda(), new Date(2026, 9, 1));
        expect(seriesLabel(dag2, now)).toBe('2 dagar · lör 10-sön 11 okt.');
        expect(dailySeriesStart(dag2)).toEqual(new Date(2026, 9, 10, 11, 0));
    });

    it('slutdatumet för en dagsserie', () => {
        expect(seriesEndDate(konstrunda({ repeatDays: 4 }))).toEqual(new Date(2026, 9, 13, 11, 0));
    });

    it('profilens chip', () => {
        expect(seriesRhythmLabel(konstrunda({ repeatDays: 5 }))).toBe('5 dagar');
    });

    it('spann över månadsskifte och årsskifte', () => {
        expect(dayRangeLabel(new Date(2026, 9, 30), new Date(2026, 10, 1), now)).toBe('fre 30 okt.-sön 1 nov.');
        expect(dayRangeLabel(new Date(2026, 11, 30), new Date(2027, 0, 2), now)).toBe('ons 30 dec.-lör 2 jan. 2027');
    });

    it('engångsevent har ingen serieetikett', () => {
        expect(seriesLabel(konstrunda({ repeatDays: undefined }), now)).toBeNull();
    });
});
