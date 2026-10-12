import { describe, expect, it } from 'vitest';
import { arrangorTyp } from './arrangorTyp';
import {
    dokumentHtml, gissning, grannar, MIN_NAMNGIVEN, OrtStatistik, raknaOrt, RapportEvent, veckodag, visningsnamn,
} from './ortsrapport';

const A = { name: 'Abyn', lat: 59.0, lng: 16.0, pop: 50_000 };
const B = { name: 'Broby', lat: 59.0, lng: 16.5, pop: 20_000 };
const C = { name: 'Ceby', lat: 59.5, lng: 16.0 };              // ingen folkmängd
const ORTER = [A, B, C];
const FRAN = new Date('2026-10-12T00:00:00+02:00');         // en måndag

let n = 0;
function ev(over: Partial<RapportEvent> = {}): RapportEvent {
    n++;
    return {
        url: `https://exempel.se/e/${n}`, title: `Event ${n}`, time: '2026-10-12T17:00:00.000Z',
        lat: A.lat + 0.01, lng: A.lng + 0.01, hostName: 'Aby Teater', category: 'stage', ...over,
    };
}

describe('arrangorTyp', () => {
    it('skiljer lokala, riksorganisationer och plattformar', () => {
        expect(arrangorTyp('Tickster')).toBe('plattform');
        expect(arrangorTyp('Växjö domkyrkoförsamling')).toBe('riks');
        expect(arrangorTyp('Aby stadsbibliotek')).toBe('riks');
        expect(arrangorTyp('Kulturparken Småland')).toBe('lokal');
        expect(arrangorTyp(null)).toBe('lokal');
    });
});

describe('veckodag och visningsnamn', () => {
    it('räknar veckodagen i svensk tid', () => {
        expect(veckodag(new Date('2026-10-12T10:00:00Z'))).toBe(0);          // måndag
        expect(veckodag(new Date('2026-10-12T22:30:00Z'))).toBe(1);          // tisdag 00:30 i Sverige
        expect(veckodag(new Date('2026-10-18T10:00:00Z'))).toBe(6);          // söndag
    });

    it('byter tankstreck mot bindestreck', () => {
        expect(visningsnamn('Visit Eskilstuna — Evenemangsguiden')).toBe('Visit Eskilstuna - Evenemangsguiden');
        expect(visningsnamn('  Aby  –  Bro ')).toBe('Aby - Bro');
    });
});

describe('raknaOrt', () => {
    const events = [
        ...Array.from({ length: MIN_NAMNGIVEN }, () => ev()),                        // Aby Teater x3
        ev({ hostName: 'Anna Artist' }),                                              // en enda: namnges inte
        ev({ hostName: 'Aby församling', category: 'social' }),
        ev({ hostName: 'Tickster', category: 'music' }),
        ev({ hostName: 'Kommunen', url: 'https://kalender.aby.se/e/1', category: 'family' }),
        ev({ lat: B.lat, lng: B.lng - 0.01 }),                                        // hör till Broby
        ev({ lat: B.lat, lng: B.lng - 0.01, locationName: 'Torget, Abyn' }),          // Abyn i adressen
        ev({ time: '2026-11-20T17:00:00.000Z' }),                                     // efter perioden
        ev({ time: '2026-10-11T17:00:00.000Z' }),                                     // före perioden
    ];
    const s = raknaOrt(events, A, ORTER, { fran: FRAN, dagar: 30, kalenderDoman: 'www.aby.se' });

    it('räknar bara ortens evenemang i perioden', () => {
        expect(s.antal).toBe(8);
        expect(s.per10k).toBe(1.6);
        expect(s.typer).toEqual({ lokal: 6, riks: 1, plattform: 1 });
    });

    it('namnger bara arrangörer med flera evenemang', () => {
        expect(s.storstaLokala).toEqual([{ namn: 'Aby Teater', antal: 4 }]);
        expect(s.arrangorer).toBe(5);
    });

    it('kategorier med svenska namn, kalendern på domänen inklusive underdomäner', () => {
        expect(s.kategorier[0]).toEqual({ namn: 'Scen', antal: 5 });
        expect(s.kalender).toEqual({ doman: 'aby.se', antal: 1 });
    });

    it('snitt per veckodag: alla på en måndag, och perioden har fem måndagar', () => {
        expect(s.perVeckodag[0]).toBe(1.6);
        expect(s.perVeckodag.slice(1).every((v) => v === 0)).toBe(true);
    });
});

describe('gissning', () => {
    const s = { ort: 'Aby', perVeckodag: [6.3, 11.2, 15.4, 14, 11.8, 18.3, 8] } as OrtStatistik;

    it('lugnaste dagen, den livligaste och en mittemellan, i veckoordning', () => {
        const g = gissning(s);
        expect(g.fraga).toBe('Vilken veckodag händer det minst i Aby?');
        expect(g.alternativ).toEqual(['måndag', 'fredag', 'lördag']);
        expect(g.alternativ[g.ratt]).toBe('måndag');
    });
});

describe('grannar', () => {
    it('närmaste orterna med folkmängd, inte orten själv', () => {
        const events = [ev({ lat: B.lat, lng: B.lng }), ev({ lat: B.lat, lng: B.lng })];
        const g = grannar(events, A, ORTER, ORTER, { fran: FRAN });
        expect(g).toEqual([{ ort: 'Broby', antal: 2, per10k: 1, avstandKm: 29 }]);
    });
});

describe('dokumentHtml', () => {
    const s = raknaOrt([ev({ hostName: '<script>x</script>' }), ev({ hostName: '<script>x</script>' }),
        ev({ hostName: '<script>x</script>' }), ev({ time: '2026-10-16T17:00:00.000Z' })], A, ORTER, { fran: FRAN });
    const html = dokumentHtml({ statistik: s, grannar: [], mottagare: 'Kultur- och fritid, Aby kommun',
        datum: FRAN, logga: 'data:image/png;base64,AAAA' });

    it('escapar arrangörsnamnen', () => {
        expect(html).not.toContain('<script>x');
        expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    });

    it('två sidor, gissningen och svaret stämmer överens', () => {
        expect(html.match(/<section class="sida">/g)).toHaveLength(2);
        const g = gissning(s);
        expect(html).toContain(`Svaret på gissningen: ${'ABC'[g.ratt]}, ${g.alternativ[g.ratt]}.`);
        expect(html).toContain('Kultur- och fritid, Aby kommun');
    });

    it('inga tankstreck i texten', () => {
        expect(html).not.toMatch(/[—–]/);
    });
});
