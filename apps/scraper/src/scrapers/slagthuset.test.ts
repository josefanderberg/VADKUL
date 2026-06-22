import { describe, it, expect } from 'vitest';
import { parseSlagthusetDate, mapSlagthusetEvent } from './slagthuset';

describe('parseSlagthusetDate', () => {
    it('YYYYMMDD + HH:MM → lokal tid med klocka', () => {
        const r = parseSlagthusetDate('20260626', '20:00');
        expect(r?.date.getFullYear()).toBe(2026);
        expect(r?.date.getMonth()).toBe(5); // juni = 5
        expect(r?.date.getDate()).toBe(26);
        expect(r?.date.getHours()).toBe(20);
        expect(r?.hasClock).toBe(true);
    });

    it('utan tid → midnatt + hasClock=false', () => {
        const r = parseSlagthusetDate('20260703', '');
        expect(r?.date.getHours()).toBe(0);
        expect(r?.hasClock).toBe(false);
    });

    it('skräp → null', () => {
        expect(parseSlagthusetDate('2026-06-26', '20:00')).toBeNull();
        expect(parseSlagthusetDate('20261340', '20:00')).toBeNull();
        expect(parseSlagthusetDate(undefined, undefined)).toBeNull();
    });
});

describe('mapSlagthusetEvent', () => {
    const ev = {
        id: 7277,
        slug: 'tricky',
        title: { rendered: 'Carla Thomas &#038; The Brunnsvik Sounds' },
        featured_media: 7280,
        event_medium: { url: 'https://wp.slagthuset.se/wp-content/uploads/2026/02/Tricky_2000x1000-750x375.jpg' },
        acf: {
            startdatum: '20260626',
            slutdatum: '',
            oppnar: '19:00',
            borjar: '20:00',
            plats: [{ name: 'Saluhallen' }],
            ingang: 'Carlsgatan 12E',
            underrubrik: 'Triphop-ikon',
            lang_info: '<p>En <strong>sann</strong> ikon.</p>',
            pris: '595 kr',
            typ_av_evenemang: { name: 'Musik' },
        },
    };

    it('mappar komplett event', () => {
        const e = mapSlagthusetEvent(ev, 'https://slagthuset.se', 'Malmö')!;
        expect(e.title).toBe('Carla Thomas & The Brunnsvik Sounds'); // entitet avkodad
        expect(e.startDate.getHours()).toBe(20);
        expect(e.hasSpecificTime).toBe(true);
        expect(e.url).toBe('https://slagthuset.se/tricky');
        expect(e.venueName).toBe('Saluhallen');
        expect(e.city).toBe('Malmö');
        expect(e.address).toBe('Carlsgatan 12E');
        expect(e.category).toBe('musik');
        expect(e.price).toBe('595 kr');
        expect(e.imageUrl).toBe('https://wp.slagthuset.se/wp-content/uploads/2026/02/Tricky_2000x1000.jpg'); // full-res
        expect(e.description).toContain('sann');
        expect(e.description).not.toContain('<strong>');
    });

    it('faller tillbaka på oppnar när borjar saknas', () => {
        const e = mapSlagthusetEvent({ ...ev, acf: { ...ev.acf, borjar: '' } }, 'https://slagthuset.se', 'Malmö')!;
        expect(e.startDate.getHours()).toBe(19);
        expect(e.hasSpecificTime).toBe(true);
    });

    it('gom_i_kalender → null', () => {
        expect(mapSlagthusetEvent({ ...ev, acf: { ...ev.acf, gom_i_kalender: true } }, 'https://slagthuset.se', 'Malmö')).toBeNull();
    });

    it('saknat datum → null', () => {
        expect(mapSlagthusetEvent({ ...ev, acf: { ...ev.acf, startdatum: '' } }, 'https://slagthuset.se', 'Malmö')).toBeNull();
    });
});
