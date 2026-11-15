import { describe, it, expect } from 'vitest';
import { judgeEvents, remembersVerdict, inlineListingAllowed, titlesNear, NOT_A_VENUE_NOTE, PROBE_VERSION } from './snowballSmoke';
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

describe('remembersVerdict — minnet av en probad domän', () => {
    it('ett färskt FAIL från dagens prob gäller i 90 dagar', () => {
        const fail = { verdict: 'FAIL' as const, date: '2026-11-14', probe: PROBE_VERSION };
        expect(remembersVerdict(fail, 0, 90)).toBe(true);
        expect(remembersVerdict(fail, 89, 90)).toBe(true);
        expect(remembersVerdict(fail, 90, 90)).toBe(false);
    });

    it('FAIL och SMOKE-FAIL från en äldre prob provas om direkt (Chapter House 14/11)', () => {
        // Poster från före 14/11 saknar fältet och räknas som generation 1.
        expect(remembersVerdict({ verdict: 'FAIL', date: '2026-11-14', note: 'bulk-probe' }, 0, 90)).toBe(false);
        expect(remembersVerdict({ verdict: 'SMOKE-FAIL', date: '2026-11-01', probe: 1 }, 13, 90)).toBe(false);
        expect(remembersVerdict({ verdict: 'FAIL', date: '2026-11-14', probe: 2 }, 0, 90, 3)).toBe(false);
    });

    it('en dubblett är alltid en dubblett; PASS och okända domäner följer åldern', () => {
        expect(remembersVerdict({ verdict: 'DUPE', date: '2025-01-01' }, 600, 90)).toBe(true);
        expect(remembersVerdict({ verdict: 'PASS', date: '2026-11-01' }, 13, 90)).toBe(true);
        expect(remembersVerdict({ verdict: 'PASS', date: '2026-01-01' }, 300, 90)).toBe(false);
        expect(remembersVerdict(undefined, 0, 90)).toBe(false);
    });
});

describe('judgeEvents — programsidor räknar passerade event som belägg (Chapter House 14/11)', () => {
    const past = { ...ev('Ölprovning med bryggeriet', 7, 14), startDate: new Date(2026, 10, 7, 14) };
    const today = ev('Ginprovning', 14, 14);
    const dec = { ...ev('Julinspirerad ölprovning', 5, 14), startDate: new Date(2026, 11, 5, 14) };

    it('utan tillbakablick faller en krog med två kommande kvällar', () => {
        expect(judgeEvents([past, today, dec], START, END, 'x.se').ok).toBe(false);
    });

    it('med tillbakablick godkänns den, och antalet som rapporteras är de kommande', () => {
        const v = judgeEvents([past, today, dec], START, END, 'x.se', { lookbackDays: 30 });
        expect(v.ok).toBe(true);
        expect(v.events).toBe(2);
    });

    it('ett nyhetsarkiv har inget datum efter i dag och faller ändå', () => {
        const posts = [3, 9, 12, 14].map((d) => ({ ...ev(`Inlägg ${d}`, d, 0), startDate: new Date(2026, 10, d) }));
        const v = judgeEvents(posts, START, END, 'x.se', { lookbackDays: 30 });
        expect(v.ok).toBe(false);
        expect(v.reasons.join(' ')).toMatch(/inget kommande event/);
    });

    it('äldre än tillbakablicken räknas inte', () => {
        const old = { ...ev('Sommarfest', 1), startDate: new Date(2026, 8, 1) };
        expect(judgeEvents([old, today, dec], START, END, 'x.se', { lookbackDays: 30 }).ok).toBe(false);
    });
});

describe('program på en enda sida läses bara för utpekade ställen (haaks.se, pubkor.se 15/11)', () => {
    it('listing-inline kräver ställe-märkningen; kataloger och övriga metoder gör det inte', () => {
        expect(inlineListingAllowed('listing-inline', true)).toBe(true);
        expect(inlineListingAllowed('listing-inline', false)).toBe(false);
        expect(inlineListingAllowed('listing-inline', undefined)).toBe(false);
        expect(inlineListingAllowed('listing-catalog', false)).toBe(true);
        expect(inlineListingAllowed('tribe', undefined)).toBe(true);
    });

    it('en sajt som fälldes för att den inte var utpekad provas om när den kommer som ett ställe', () => {
        const fail = { verdict: 'FAIL' as const, date: '2026-11-15', note: NOT_A_VENUE_NOTE, probe: PROBE_VERSION };
        expect(remembersVerdict(fail, 0, 90)).toBe(true);
        expect(remembersVerdict(fail, 0, 90, PROBE_VERSION, true)).toBe(false);
        // Ett vanligt FAIL gäller även för ett ställe.
        expect(remembersVerdict({ ...fail, note: 'bulk-probe' }, 0, 90, PROBE_VERSION, true)).toBe(true);
    });
});

describe('titlesNear — dubblettkontrollen ser bara ortens egna event (Växjö Konserthus 15/11)', () => {
    const VAXJO = { lat: 56.888, lng: 14.799 };
    const rows = [
        { t: 'evigt edvin', h: 'Upplev Växjö', lat: 56.879, lng: 14.806 },           // Växjö Konserthus
        { t: 'evigt edvin', h: 'Karlstad CCC', lat: 59.38, lng: 13.5 },
        { t: 'sissels jul 2026', h: 'Malmö Live Konserthus', lat: 55.607, lng: 12.99 },
        { t: 'julmarknad', h: 'Teleborgs slott', lat: 56.853, lng: 14.83 },
        { t: 'okänd plats', h: 'x', lat: 0, lng: 0 },
        { t: 'utan koordinat', h: 'x', lat: null, lng: null },
    ];

    it('samma turné i en annan stad räknas inte som att vi har ställets kväll', () => {
        const near = titlesNear(rows, VAXJO.lat, VAXJO.lng);
        expect([...near.keys()].sort()).toEqual(['evigt edvin', 'julmarknad']);
        expect(near.get('evigt edvin')).toBe('Upplev Växjö');
        expect(near.has('sissels jul 2026')).toBe(false);
    });

    it('event utan plats (0,0 eller tomt) hör inte till någon ort', () => {
        const near = titlesNear(rows, 0, 0, 5000);
        expect(near.has('okänd plats')).toBe(false);
        expect(near.has('utan koordinat')).toBe(false);
    });
});
