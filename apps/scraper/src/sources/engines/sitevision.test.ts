import { describe, it, expect } from 'vitest';
import { parseSoleilDate, mapSoleilItem } from './sitevision';

describe('parseSoleilDate', () => {
    it('YYYY-MM-DD + HH:MM → lokal tid med klocka', () => {
        const r = parseSoleilDate('2026-07-10', '18:00');
        expect(r?.date.getFullYear()).toBe(2026);
        expect(r?.date.getMonth()).toBe(6); // juli = 6
        expect(r?.date.getDate()).toBe(10);
        expect(r?.date.getHours()).toBe(18);
        expect(r?.hasClock).toBe(true);
    });

    it('utan tid (null) → midnatt + hasClock=false', () => {
        const r = parseSoleilDate('2026-07-10', null);
        expect(r?.date.getHours()).toBe(0);
        expect(r?.hasClock).toBe(false);
    });

    it('punkt-klocka "18.30" normaliseras', () => {
        const r = parseSoleilDate('2026-07-10', '18.30');
        expect(r?.date.getHours()).toBe(18);
        expect(r?.date.getMinutes()).toBe(30);
    });

    it('skräp → null', () => {
        expect(parseSoleilDate('10/07/2026', null)).toBeNull();
        expect(parseSoleilDate(undefined, '18:00')).toBeNull();
    });
});

describe('mapSoleilItem', () => {
    const BASE_URL = 'https://malmo.se/evenemangskalender';
    const item = {
        id: '5.50574bcf196ed960a55951',
        title: 'Stort Junior 3D',
        url: '/Uppleva-och-gora/Evenemang/Evenemang-i-Malmo/Evenemangssida.html?id=5.50574bcf196ed960a55951',
        desc: 'Vetenskapsfilm på 360-gradersduk.',
        image: 'https://devenemang.malmo.se/images/bild.jpg',
        place: ['Malmö museum'],
        dates: { date: '2026-07-10', time: null, locations: ['Malmö museum'] },
    };

    it('relativ intern URL görs absolut mot malmo.se', () => {
        const ev = mapSoleilItem(item, BASE_URL, 'Malmö')!;
        expect(ev.url).toBe('https://malmo.se/Uppleva-och-gora/Evenemang/Evenemang-i-Malmo/Evenemangssida.html?id=5.50574bcf196ed960a55951');
        expect(ev.title).toBe('Stort Junior 3D');
        expect(ev.venueName).toBe('Malmö museum');
        expect(ev.city).toBe('Malmö');
        expect(ev.hasSpecificTime).toBeUndefined(); // date-only → runnerns heuristik
    });

    it('extern absolut URL lämnas orörd (typeOfEvent=external)', () => {
        const ev = mapSoleilItem(
            { ...item, url: 'https://odet.nu/farmers-market/' },
            BASE_URL, 'Malmö',
        )!;
        expect(ev.url).toBe('https://odet.nu/farmers-market/');
    });

    it('klockslag → hasSpecificTime=true', () => {
        const ev = mapSoleilItem(
            { ...item, dates: { date: '2026-07-10', time: '18:00' } },
            BASE_URL, 'Malmö',
        )!;
        expect(ev.hasSpecificTime).toBe(true);
        expect(ev.startDate.getHours()).toBe(18);
    });

    it('place[] tom → fallback till dates.locations', () => {
        const ev = mapSoleilItem(
            { ...item, place: [], dates: { date: '2026-07-10', time: null, locations: ['Rosengårdsbiblioteket'] } },
            BASE_URL, 'Malmö',
        )!;
        expect(ev.venueName).toBe('Rosengårdsbiblioteket');
    });

    it('titel- eller datum-lösa items → null', () => {
        expect(mapSoleilItem({ ...item, title: '' }, BASE_URL, 'Malmö')).toBeNull();
        expect(mapSoleilItem({ ...item, dates: {} }, BASE_URL, 'Malmö')).toBeNull();
    });
});
