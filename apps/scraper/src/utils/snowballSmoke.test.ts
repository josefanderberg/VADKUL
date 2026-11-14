import { describe, it, expect } from 'vitest';
import { judgeEvents } from './snowballSmoke';
import { RawEvent } from '../sources/types';

const START = new Date(2026, 10, 14);
const END = new Date(2027, 4, 14);
const ev = (title: string, day: number, hour = 19, extra: Partial<RawEvent> = {}): RawEvent =>
    ({ title, startDate: new Date(2026, 10, day, hour), url: `https://x.se/${encodeURIComponent(title)}/${day}/${hour}`, ...extra });

describe('judgeEvents — återkommande event är inga dubbletter', () => {
    it('krogens veckokvällar godkänns: samma titel på olika dagar är en serie (Slottsstallarna 14/11)', () => {
        // Riktiga titlar ur proben: 3 unika av 8 — fälldes av den gamla regeln.
        const events = [
            ev('Pub-Torsdag', 19), ev('Disco-Fredag', 20, 22), ev('Pub-Torsdag', 26), ev('Disco-Fredag', 27, 22),
            ev('Julbord', 28, 18), ev('Pub-Torsdag', 12), ev('Disco-Fredag', 13, 22), ev('Pub-Torsdag', 5),
        ].map((e, i) => (i >= 5 ? { ...e, startDate: new Date(2026, 11, e.startDate.getDate(), e.startDate.getHours()) } : e));
        const v = judgeEvents(events, START, END, 'slottsstallarna.com');
        // .com-domän utan å/ä/ö i titlarna kräver Sverige-signal på annat håll:
        expect(v.reasons.filter((r) => !/Sverige-signal/.test(r))).toEqual([]);
        expect(judgeEvents(events.map((e) => ({ ...e, city: 'Växjö' })), START, END, 'slottsstallarna.com').ok).toBe(true);
    });

    it('restaurangens blandning av serier och enstaka kvällar godkänns (PM & Vänner: 5 unika av 11)', () => {
        const events = [
            ...[15, 22, 29].map((d) => ev('Afternoon Tea', d, 14)),
            ...[19, 26].map((d) => ev('Vinprovning', d)),
            ...[20, 27].map((d) => ev('Livemusik i baren', d, 21)),
            ...[21, 28].map((d) => ev('Champagnebrunch', d, 11)),
            ev('ROM & MAT – en helkväll med Romrobban', 25), ev('Rom & mat – en helkväll med Romrobban', 24),
        ];
        expect(judgeEvents(events, START, END, 'pmrestauranger.se').ok).toBe(true);
    });

    it('en enda titel på allt fälls — sajtens namn i stället för eventets', () => {
        const events = [15, 16, 17, 18, 19].map((d) => ev('Välkommen till Restaurang Exempel', d));
        const v = judgeEvents(events, START, END, 'exempel.se');
        expect(v.ok).toBe(false);
        expect(v.reasons.join(' ')).toMatch(/samma titel/);
    });

    it('samma titel flera gånger SAMMA dag fälls — listsidan har lästs som event', () => {
        const events = [
            ...[10, 11, 12, 13, 14, 15].map((h) => ev('Boka bord', 20, h)),
            ev('Julbord', 21), ev('Lunch', 20, 11),
        ];
        const v = judgeEvents(events, START, END, 'exempel.se');
        expect(v.ok).toBe(false);
        expect(v.reasons.join(' ')).toMatch(/repeteras samma dag/);
    });
});

describe('judgeEvents — övriga spärrar står kvar', () => {
    it('för få event, junk-titlar, samma tidsstämpel', () => {
        expect(judgeEvents([ev('Konsert', 20), ev('Quiz', 21)], START, END, 'x.se').reasons[0]).toMatch(/bara 2 framtida/);
        const junk = [ev('Logga in', 20), ev('Cookie-inställningar', 21), ev('Läs mer', 22), ev('Konsert', 23)];
        expect(judgeEvents(junk, START, END, 'x.se').reasons.join(' ')).toMatch(/junk-ord/);
        const sameStamp = ['A-kväll', 'B-kväll', 'C-kväll', 'D-kväll', 'E-kväll'].map((t) => ev(t, 20));
        expect(judgeEvents(sameStamp, START, END, 'x.se').reasons.join(' ')).toMatch(/samma timestamp/);
    });

    it('en vanlig kalender med unika titlar godkänns, och passerade event räknas inte', () => {
        const events = [ev('Jazzkväll', 20), ev('Vernissage', 22, 13), ev('Författarsamtal', 25, 18),
            { ...ev('Gammal konsert', 1), startDate: new Date(2026, 9, 1) }];
        const v = judgeEvents(events, START, END, 'x.se');
        expect(v.ok).toBe(true);
        expect(v.events).toBe(3);
    });
});
