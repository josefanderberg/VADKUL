import { describe, it, expect } from 'vitest';
import {
    ledigaKlipp, markeraMilstolpe, normaliseraLogg, oanvandMilstolpe, oavslutadUppfoljning, patchaKlipp,
    registreraKlipp, rensaForsvunnaKlipp, stadSlug, staderAnvanda, temaUrFilnamn, tomLogg, uppsertInlagg,
    utanInsikter,
} from './logg';
import type { Inlagg, Logg } from './typer';

const inlagg = (over: Partial<Inlagg> = {}): Inlagg => ({
    id: '2026-11-03', tema: 'siffra', form: 'bild', status: 'planerad', skapad: 1, publiceraEfter: 2,
    text: { fb: 'x', ig: 'y' }, data: {}, media: { typ: 'bild', fil: 'a.png' }, ...over,
});

describe('temaUrFilnamn', () => {
    it('läser tema, stad och tema med bindestreck', () => {
        expect(temaUrFilnamn('2026-11-03-ikvall-1.mp4')).toEqual({ tema: 'ikvall' });
        expect(temaUrFilnamn('2026-11-03-helg-vaxjo-2.mp4')).toEqual({ tema: 'helg', stad: 'vaxjo' });
        expect(temaUrFilnamn('2026-11-03-helg-upplands-vasby-1.mp4')).toEqual({ tema: 'helg', stad: 'upplands-vasby' });
        expect(temaUrFilnamn('2026-11-03-bjud-med-1.mp4')).toEqual({ tema: 'bjud-med' });
        expect(temaUrFilnamn('/x/y/2026-11-03-skapa-eget-3.MP4')).toEqual({ tema: 'skapa-eget' });
    });

    it('okänt namn blir okant', () => {
        expect(temaUrFilnamn('grok-video-8213.mp4')).toEqual({ tema: 'okant' });
        expect(temaUrFilnamn('2026-11-03-okant-1.mp4')).toEqual({ tema: 'okant' });
    });
});

describe('stadSlug', () => {
    it('ascii som filnamnen', () => {
        expect(stadSlug('Växjö')).toBe('vaxjo');
        expect(stadSlug('Upplands Väsby')).toBe('upplands-vasby');
        expect(stadSlug('Örebro')).toBe('orebro');
    });
});

describe('registreraKlipp och rensaForsvunnaKlipp', () => {
    it('registrerar bara nya videofiler', () => {
        const l1 = registreraKlipp(tomLogg(), ['2026-11-03-ikvall-1.mp4', 'notes.txt', 'b.mov'], 5);
        expect(l1.klipp.map(k => k.fil)).toEqual(['2026-11-03-ikvall-1.mp4', 'b.mov']);
        expect(l1.klipp[0]).toMatchObject({ tema: 'ikvall', status: 'ny', mottaget: 5 });
        const l2 = registreraKlipp(patchaKlipp(l1, 'b.mov', { status: 'använd' }), ['b.mov'], 9);
        expect(l2.klipp.find(k => k.fil === 'b.mov')?.status).toBe('använd');
    });

    it('försvunna lediga klipp avvisas, använda rörs inte', () => {
        const l = registreraKlipp(tomLogg(), ['a.mp4', 'b.mp4'], 1);
        const l2 = rensaForsvunnaKlipp(patchaKlipp(l, 'b.mp4', { status: 'använd' }), []);
        expect(l2.klipp.find(k => k.fil === 'a.mp4')?.status).toBe('avvisad');
        expect(l2.klipp.find(k => k.fil === 'b.mp4')?.status).toBe('använd');
        expect(ledigaKlipp(l2)).toHaveLength(0);
    });
});

describe('uppsertInlagg', () => {
    it('lägger till, ersätter planerat, men rör aldrig publicerat', () => {
        const l1 = uppsertInlagg(tomLogg(), inlagg());
        const l2 = uppsertInlagg(l1, inlagg({ tema: 'quiz' }));
        expect(l2.inlagg).toHaveLength(1);
        expect(l2.inlagg[0].tema).toBe('quiz');
        const pub = uppsertInlagg(l2, inlagg({ status: 'publicerad', meta: { fbPostId: '1' } }));
        const igen = uppsertInlagg(pub, inlagg({ tema: 'gissa' }));
        expect(igen.inlagg[0]).toMatchObject({ status: 'publicerad', meta: { fbPostId: '1' } });
    });
});

describe('rotation, insikter, uppföljning, milstolpar', () => {
    const logg: Logg = {
        ...tomLogg(),
        inlagg: [
            inlagg({ id: '2026-10-08', tema: 'helg', stad: 'Växjö', status: 'publicerad', publicerad: 10 }),
            inlagg({ id: '2026-10-29', tema: 'helg', stad: 'Umeå', status: 'publicerad', publicerad: 10 }),
            inlagg({ id: '2026-10-30', tema: 'helg', stad: 'Lund', status: 'vetad' }),
            inlagg({ id: '2026-11-04', tema: 'gissa', status: 'publicerad', publicerad: 1_000 }),
            inlagg({ id: '2026-11-07', tema: 'quiz', status: 'publicerad', publicerad: 1_000, uppfoljning: { klar: true }, insikter: { hamtad: 1 } }),
        ],
        milstolpar: [{ text: '1 000 medlemmar', datum: '2026-11-01' }, { text: '100 nedladdningar', datum: '2026-10-20' }],
    };

    it('städer använda senaste 28 dagarna, vetade räknas inte', () => {
        expect(staderAnvanda(logg, 'helg', 28, '2026-11-05')).toEqual(['Umeå']);
        expect(staderAnvanda(logg, 'helg', 60, '2026-11-05')).toEqual(['Växjö', 'Umeå']);
    });

    it('utanInsikter efter 48 h', () => {
        const h48 = 48 * 3_600_000;
        expect(utanInsikter(logg, 1_000 + h48 - 1).map(i => i.id)).toEqual(['2026-10-08', '2026-10-29']);
        expect(utanInsikter(logg, 1_000 + h48).map(i => i.id)).toEqual(['2026-10-08', '2026-10-29', '2026-11-04']);
    });

    it('oavslutad uppföljning = publicerade spel/quiz utan klar', () => {
        expect(oavslutadUppfoljning(logg).map(i => i.id)).toEqual(['2026-11-04']);
    });

    it('äldsta oanvända milstolpen först, markeras använd', () => {
        expect(oanvandMilstolpe(logg)?.text).toBe('100 nedladdningar');
        const l2 = markeraMilstolpe(logg, '100 nedladdningar');
        expect(oanvandMilstolpe(l2)?.text).toBe('1 000 medlemmar');
    });

    it('normaliseraLogg fyller saknade listor', () => {
        expect(normaliseraLogg({ milstolpar: [{ text: 'x', datum: '2026-11-01' }] }))
            .toEqual({ inlagg: [], klipp: [], milstolpar: [{ text: 'x', datum: '2026-11-01' }] });
        expect(normaliseraLogg(null)).toEqual(tomLogg());
    });
});
