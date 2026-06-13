import { describe, it, expect } from 'vitest';
import { parseMbskDate, mapMbskItem } from './medborgarskolan';

describe('parseMbskDate', () => {
    it('engelska och svenska månadsförkortningar', () => {
        expect(parseMbskDate('30 Sep 2025', '10:00-15:00')?.date.getMonth()).toBe(8);
        expect(parseMbskDate('14 Maj 2026', '18:00-19:00')?.date.getMonth()).toBe(4);
        expect(parseMbskDate('5 Okt 2026', undefined)?.date.getMonth()).toBe(9);
    });

    it('tid sätts ur intervallets start', () => {
        const r = parseMbskDate('30 Sep 2025', '10:00-15:00');
        expect(r?.date.getHours()).toBe(10);
        expect(r?.hasClock).toBe(true);
    });

    it('utan tid → midnatt + hasClock=false', () => {
        const r = parseMbskDate('30 Sep 2025', undefined);
        expect(r?.date.getHours()).toBe(0);
        expect(r?.hasClock).toBe(false);
    });

    it('skräp → null', () => {
        expect(parseMbskDate('Imorgon', '10:00')).toBeNull();
        expect(parseMbskDate(undefined, undefined)).toBeNull();
    });
});

describe('mapMbskItem', () => {
    const item = {
        id: 111029,
        title: 'Nyfiken på – Philip Zandén',
        type: 'Föreläsning',
        link: { href: '/arrangemang-sok/nyfiken-pa-1479243/' },
        meta: [
            { type: 'location', text: 'Jönköping' },
            { type: 'start', text: '30 Sep 2026' },
            { type: 'time', text: '10:00-15:00' },
            { type: 'price', text: '0 kr' },
        ],
        ld_entity: { image: { url: 'https://www.medborgarskolan.se/wt/media/x.png' }, description: 'En föreläsning.' },
    };

    it('mappar komplett arrangemang', () => {
        const e = mapMbskItem(item);
        expect(e?.title).toContain('Philip Zandén');
        expect(e?.city).toBe('Jönköping');
        expect(e?.startDate.getFullYear()).toBe(2026);
        expect(e?.hasSpecificTime).toBe(true);
        expect(e?.url).toBe('https://www.medborgarskolan.se/arrangemang-sok/nyfiken-pa-1479243/');
        expect(e?.imageUrl).toContain('/wt/media/');
        expect(e?.price).toBe('0 kr');
    });

    it('utan datum → null', () => {
        expect(mapMbskItem({ ...item, meta: [{ type: 'location', text: 'Lund' }] })).toBeNull();
    });
});
