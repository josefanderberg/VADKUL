import { describe, it, expect } from 'vitest';
import {
    avgorVinnare, emojiFor, gissaData, gissaKandidater, helgStad, iDygnet, iFonstret, poang, quizForStad,
    quizKommentar, siffror, stadssidor, vinnarKommentar,
} from './urval';
import type { DestEvent } from './typer';
import { stockholmTid } from './tid';
import { kontrollera, byggText } from './text';

// Tisdag 3/11 2026. Helgen = 6-8/11.
const NU = stockholmTid('2026-11-03', '07:00');
const ORTER = [
    { name: 'Växjö', lat: 56.8777, lng: 14.8091 },
    { name: 'Umeå', lat: 63.8258, lng: 20.263 },
    { name: 'Göteborg', lat: 57.7089, lng: 11.9746 },
];
let n = 0;
const ev = (over: Partial<DestEvent> & { datum: string; klockan?: string }): DestEvent => {
    const { datum, klockan, ...rest } = over;
    const t = stockholmTid(datum, klockan ?? '19:00');
    const ort = ORTER[n % 3];
    n++;
    return {
        id: `https://x.se/e/${n}`, title: `Event ${n}`, time: t.toISOString(), hasSpecificTime: !!klockan || klockan !== undefined,
        lat: ort.lat, lng: ort.lng, category: 'music', ...rest,
    };
};
const vid = (ort: { lat: number; lng: number }, over: Partial<DestEvent> & { datum: string; klockan?: string }): DestEvent =>
    ev({ ...over, lat: ort.lat + 0.01, lng: ort.lng + 0.01 });

describe('fönster', () => {
    it('iDygnet tar event som startar i dygnet och flerdagars som spänner över det', () => {
        const a = ev({ datum: '2026-11-03', klockan: '19:00' });
        const b = ev({ datum: '2026-11-04', klockan: '10:00' });
        const c = ev({ datum: '2026-11-01', klockan: '10:00', endDate: stockholmTid('2026-11-05', '18:00').toISOString() });
        const d = ev({ datum: '2026-10-20', klockan: '10:00', endDate: stockholmTid('2026-10-25', '18:00').toISOString() });
        expect(iDygnet([a, b, c, d], '2026-11-03').map(e => e.id)).toEqual([a.id, c.id]);
        expect(iFonstret([a, b], stockholmTid('2026-11-03', '00:00'), stockholmTid('2026-11-05', '00:00'))).toHaveLength(2);
    });
});

describe('siffror', () => {
    it('räknar i dag, veckan, nya, toppkategori och helgen utan opt-in', () => {
        const events = [
            ev({ datum: '2026-11-03', fs: '2026-11-02' }),
            ev({ datum: '2026-11-03', category: 'sport', fs: '2026-10-20' }),
            ev({ datum: '2026-11-03', id: 'https://www.svenskakyrkan.se/x', fs: '2026-11-02' }),
            ev({ datum: '2026-11-06', category: 'sport', fs: '2026-11-01' }),
            ev({ datum: '2026-11-07', category: 'sport' }),
            ev({ datum: '2026-11-08', category: 'other' }),
            ev({ datum: '2026-11-09' }),
            ev({ datum: '2026-11-10' }),
            ev({ datum: '2026-11-01', fs: '2026-11-01' }),
        ];
        const s = siffror(events, NU, ORTER);
        expect(s.idag).toBe(2);
        expect(s.vecka).toBe(6);
        expect(s.nya).toBe(2);
        expect(s.toppKategori).toBe('sport');
        expect(s.helg).toBe(3);
        expect(s.helgFredag).toBe('2026-11-06');
        expect(s.toppStad).toBeDefined();
        expect(s.data).toMatchObject({ idagGolv: '2', veckaGolv: '6', nyaGolv: '2', toppKategori: 'sport och träning', toppEmoji: '⚽', helgGolv: '3' });
        const t = byggText({ tema: 'siffra', variant: 'vecka', data: s.data, fro: '2026-11-02' });
        expect(kontrollera(t.fb, s.data, 'fb')).toEqual([]);
        const th = byggText({ tema: 'siffra', variant: 'helg', data: s.data, fro: '2026-11-06' });
        expect(kontrollera(th.ig, s.data, 'ig')).toEqual([]);
    });
});

describe('gissaKandidater', () => {
    it('tre städer, tre kategorier, högst ps först, med klockslag', () => {
        const events = [
            vid(ORTER[0], { datum: '2026-11-03', klockan: '19:00', title: 'Lakers', category: 'sport', ps: 60, emoji: '🏒' }),
            vid(ORTER[0], { datum: '2026-11-03', klockan: '19:00', title: 'Växjö igen', category: 'music', ps: 59 }),
            vid(ORTER[1], { datum: '2026-11-03', klockan: '18:00', title: 'Julmarknad', category: 'market', ps: 55 }),
            vid(ORTER[2], { datum: '2026-11-03', klockan: '20:00', title: 'Laleh', category: 'music', ps: 65 }),
            vid(ORTER[2], { datum: '2026-11-03', klockan: '20:00', title: 'Teater', category: 'stage', ps: 50 }),
            vid(ORTER[2], { datum: '2026-11-03', hasSpecificTime: false, title: 'Heldag', category: 'art', ps: 70 }),
            vid(ORTER[1], { datum: '2026-11-03', klockan: '10:00', title: 'Barnkalas', category: 'family', ps: 70 }),
            vid(ORTER[1], { datum: '2026-11-04', klockan: '10:00', title: 'I morgon', category: 'art', ps: 70 }),
        ];
        const k = gissaKandidater(events, ORTER, NU);
        expect(k.map(x => x.titel)).toEqual(['Laleh', 'Lakers', 'Julmarknad']);
        expect(k.map(x => x.stad)).toEqual(['Göteborg', 'Växjö', 'Umeå']);
        expect(k[1].emoji).toBe('🏒');
        expect(k[0].url).toMatch(/^https:\/\/vadkul\.se\/e\/[0-9a-f]{16}$/);
        const data = gissaData(k);
        const t = byggText({ tema: 'gissa', data, fro: '2026-11-04' });
        expect(kontrollera(t.fb, data, 'fb')).toEqual([]);
        expect(kontrollera(t.ig, data, 'ig')).toEqual([]);
    });

    it('färre än tre kandidater ger tom lista', () => {
        const events = [vid(ORTER[0], { datum: '2026-11-03', klockan: '19:00', ps: 60 })];
        expect(gissaKandidater(events, ORTER, NU)).toEqual([]);
    });
});

describe('vinnaren', () => {
    const k = [
        { id: 'a', titel: 'Laleh', stad: 'Göteborg', ps: 65 },
        { id: 'b', titel: 'Lakers', stad: 'Växjö', ps: 60 },
        { id: 'c', titel: 'Julmarknad', stad: 'Umeå', ps: 55 },
    ];

    it('poäng = views + 3*clicks + going + interested', () => {
        expect(poang({ views: 10, clicks: 2, going: 1, interested: 1 })).toBe(18);
        expect(poang({})).toBe(0);
    });

    it('störst ökning vinner, under golvet avgör ps', () => {
        const v = avgorVinnare(k, { a: 100, b: 5, c: 0 }, { a: 102, b: 15, c: 4 });
        expect(v).toEqual({ vinnare: { id: 'b', titel: 'Lakers', stad: 'Växjö', ps: 60, nr: 2 }, grund: 'klick' });
        expect(vinnarKommentar(v)).toContain('Flest hittade till 2️⃣ Lakers i Växjö');
        const jamnt = avgorVinnare(k, { a: 0, b: 0, c: 0 }, { a: 1, b: 2, c: 0 });
        expect(jamnt).toEqual({ vinnare: { id: 'a', titel: 'Laleh', stad: 'Göteborg', ps: 65, nr: 1 }, grund: 'ps' });
        expect(vinnarKommentar(jamnt)).toContain('Den vi tror flest hittar till: 1️⃣ Laleh');
        expect(vinnarKommentar(jamnt)).not.toMatch(/\d{2,}/);
    });
});

describe('helgStad', () => {
    it('staden med flest helgevent som inte vilar, tre namngivna över dagarna', () => {
        const events: DestEvent[] = [];
        for (let i = 0; i < 20; i++) events.push(vid(ORTER[0], { datum: '2026-11-07', klockan: '19:00', title: `Växjö ${i}`, ps: 40 + (i % 5) }));
        events.push(vid(ORTER[0], { datum: '2026-11-06', klockan: '19:00', title: 'Fredagsgrej', ps: 66 }));
        events.push(vid(ORTER[0], { datum: '2026-11-08', klockan: '12:00', title: 'Söndagsgrej', ps: 61 }));
        events.push(vid(ORTER[0], { datum: '2026-11-08', klockan: '12:00', title: 'Barnens dag', category: 'family', ps: 90 }));
        for (let i = 0; i < 30; i++) events.push(vid(ORTER[1], { datum: '2026-11-07', klockan: '19:00', title: `Umeå ${i}` }));
        for (let i = 0; i < 10; i++) events.push(vid(ORTER[2], { datum: '2026-11-07', klockan: '19:00', title: `Gbg ${i}` }));
        events.push(vid(ORTER[0], { datum: '2026-11-10', klockan: '19:00', title: 'Nästa vecka', ps: 99 }));

        const h = helgStad(events, ORTER, NU);
        expect(h?.stad).toBe('Umeå');
        expect(h?.antal).toBe(30);
        const v = helgStad(events, ORTER, NU, ['umeå']);
        expect(v?.stad).toBe('Växjö');
        expect(v?.antal).toBe(23);
        expect(v?.topp.map(t => t.titel)).toEqual(['Fredagsgrej', 'Söndagsgrej', 'Växjö 4']);
        expect(v?.topp.map(t => t.dag)).toEqual(['fredag', 'söndag', 'lördag']);
        expect(v?.data).toMatchObject({ stad: 'Växjö', antalGolv: '23+', topp1: 'Fredagsgrej' });
        const t = byggText({ tema: 'helg', stad: 'Växjö', data: v!.data, fro: '2026-11-05' });
        expect(kontrollera(t.fb, v!.data, 'fb')).toEqual([]);
        expect(helgStad(events, ORTER, NU, ['umeå', 'växjö'])).toBeNull();
    });
});

describe('quizForStad', () => {
    it('väljer en stad med tydligt lugnaste dag och bygger frågan', () => {
        const events: DestEvent[] = [];
        // Växjö: 10 event varje dag utom söndag (1) i 30 dagar - tydlig.
        for (let d = 0; d < 28; d++) {
            const datum = `2026-11-${String(4 + d).padStart(2, '0')}`;
            if (4 + d > 30) break;
            const veckodag = new Date(`${datum}T12:00:00Z`).getUTCDay();
            const antal = veckodag === 0 ? 1 : 10;
            for (let i = 0; i < antal; i++) events.push(vid(ORTER[0], { datum, klockan: '18:00', title: `V ${d}-${i}` }));
        }
        const q = quizForStad(events, ORTER, ORTER, NU);
        expect(q?.stad).toBe('Växjö');
        expect(q?.fraga).toBe('Vilken veckodag händer det minst i Växjö?');
        expect(q?.alternativ).toHaveLength(3);
        expect(q?.svar).toBe('söndag');
        expect(q?.alternativ[q!.ratt]).toBe('söndag');
        const t = byggText({ tema: 'quiz', stad: q!.stad, data: q!.data, fro: '2026-11-07' });
        expect(kontrollera(t.ig, q!.data, 'ig')).toEqual([]);
        expect(quizKommentar(q!)).toContain('söndag');
        expect(quizForStad(events, ORTER, ORTER, NU, ['Växjö'])).toBeNull();
    });
});

describe('småsaker', () => {
    it('emojiFor faller tillbaka på kategorin och tar bara första emojin', () => {
        expect(emojiFor({ emoji: '🎻', category: 'music' })).toBe('🎻');
        expect(emojiFor({ emoji: '🎵🎤', category: 'music' })).toBe('🎵');
        expect(emojiFor({ emoji: '🍽️', category: 'food' })).toBe('🍽️');
        expect(emojiFor({ emoji: 'x', category: 'art' })).toBe('🎨');
        expect(emojiFor({ category: 'market' })).toBe('🛍️');
        expect(emojiFor({ category: 'okänd' })).toBe('📍');
    });

    it('stadssidor filtrerar på slug', () => {
        expect(stadssidor(ORTER, n => n !== 'Umeå').map(o => o.name)).toEqual(['Växjö', 'Göteborg']);
    });
});

describe('titelDuger', () => {
    it('släpper korta titlar utan utropstecken eller versalskrik', async () => {
        const { titelDuger } = await import('./urval');
        expect(titelDuger('Laleh')).toBe(true);
        expect(titelDuger('Julmarknad på torget')).toBe(true);
        expect(titelDuger('Kom och fira!')).toBe(false);
        expect(titelDuger('Vad händer?')).toBe(false);
        expect(titelDuger('STORA LOPPISEN')).toBe(false);
        expect(titelDuger('AIK')).toBe(true);
        expect(titelDuger('En alldeles för lång titel som inte får plats på en bricka alls')).toBe(false);
    });
});
