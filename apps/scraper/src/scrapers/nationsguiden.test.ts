import { describe, it, expect } from 'vitest';
import { parseSchedule, mapNationsguidenDay, nonceFromHome, parseNationsguidenDetail } from './nationsguiden';
import { normalizeRawEvent } from '../utils/normalizeEvent';

const hm = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('parseSchedule', () => {
    it('"Idag" och "Imorgon" läses mot svarets dag', () => {
        const a = parseSchedule('Idag 10:00-14:00', '2026-11-15')!;
        expect([ymd(a.start), hm(a.start), hm(a.end!)]).toEqual(['2026-11-15', '10:00', '14:00']);
        expect(ymd(parseSchedule('Imorgon 18:00-23:00', '2026-11-30')!.start)).toBe('2026-12-01');
    });

    it('explicit datum vinner över svarets dag, och ett slut efter midnatt hamnar dagen efter', () => {
        const a = parseSchedule('lör 14/11 23:00-04:00', '2026-11-15')!;
        expect([ymd(a.start), hm(a.start), ymd(a.end!), hm(a.end!)]).toEqual(['2026-11-14', '23:00', '2026-11-15', '04:00']);
        expect(ymd(parseSchedule('tor 31/12 22:00-02:00', '2027-01-01')!.start)).toBe('2026-12-31');
    });

    it('utan klockslag eller med omöjligt datum: null', () => {
        expect(parseSchedule('Hela dagen', '2026-11-15')).toBeNull();
        expect(parseSchedule('31/11 18:00', '2026-11-15')).toBeNull();
    });
});

describe('mapNationsguidenDay', () => {
    const pub = { title: 'Pub Bakfickan', permalink: 'https://www.nationsguiden.se/events/event/pub-bakfickan/', schedule: 'fre 20/11 17:00-23:59', image: "<img width='300' src='https://www.nationsguiden.se/wp-content/uploads/2026/08/bakfickan-300x300.jpg' class='w-24'>", organiser: { title: 'Stockholms nation' } };
    const lunch = { title: 'Lunch på Norrlands', permalink: 'https://www.nationsguiden.se/events/event/lunch-norrlands/', schedule: 'fre 20/11 11:00-14:00', organiser: { title: 'Norrlands nation' } };
    const study = { title: 'Studieplatser och bibliotek', permalink: 'https://www.nationsguiden.se/events/event/studieplatser/', schedule: 'fre 20/11 08:00-17:00', organiser: { title: 'Norrlands nation' } };

    it('ett event per länk och dag, med nationen som plats och arrangör', () => {
        const evs = mapNationsguidenDay([
            { title: 'Pub', events: [pub] },
            { title: 'Restaurang', events: [pub] },
            { title: 'Lunch', events: [lunch] },
            { title: 'Studieplatser', events: [study] },
        ], '2026-11-20');
        expect(evs).toHaveLength(1);
        expect(evs[0]).toMatchObject({
            title: 'Pub Bakfickan', venueName: 'Stockholms nation', hostName: 'Stockholms nation', city: 'Uppsala',
            url: 'https://www.nationsguiden.se/events/event/pub-bakfickan/#2026-11-20', classifyHints: 'Pub Restaurang',
            imageUrl: 'https://www.nationsguiden.se/wp-content/uploads/2026/08/bakfickan-300x300.jpg', hasSpecificTime: true,
        });
        expect(hm(evs[0].startDate)).toBe('17:00');
    });

    it('ett event som även står i en hoppad kategori räknas när det står i en annan', () => {
        const evs = mapNationsguidenDay([{ title: 'Lunch', events: [lunch] }, { title: 'Kultur', events: [lunch] }], '2026-11-20');
        expect(evs.map((e) => e.title)).toEqual(['Lunch på Norrlands']);
    });
});

describe('icke-event hoppas på titeln (15/11)', () => {
    it('öppettider, utlåningstider, mottagningstider och landskap', () => {
        const ev = (title: string) => ({ title, permalink: `https://www.nationsguiden.se/events/event/${encodeURIComponent(title)}/`, schedule: 'fre 20/11 10:00-14:00', organiser: { title: 'Norrlands nation' } });
        const evs = mapNationsguidenDay([{ title: 'Kultur', events: [
            ev('Utlåningstider – Norrlands bibliotek'), ev('Bibliotekets öppettider'), ev('Bibliotekariens mottagningstid'),
            ev('Höstens andra lagtima Landskap'), ev('Brädspelskväll'),
        ] }], '2026-11-20');
        expect(evs.map((e) => e.title)).toEqual(['Brädspelskväll']);
    });
});

// Nedtrimmad från nationsguiden.se/events/event/tisdagsklubb-a-sodermanlands-nerikes-nation/ (15/11 2026).
const detailHtml = `<main>
  <a href="https://maps.google.com/?q=x"><p class="font-medium">Sankt Larsgatan 4, 753 11 Uppsala, Sverige</p></a>
  <div class="lg:text-lg mb-16 di-wysiwyg-content"><p>Välkommen till Snerikes Tisdagsklubb!</p>
    <p><strong>Entre:</strong><br>80 kr – gratis garderob</p><p>Gratis inträde fram till 20:00.</p></div>
  <div class="leaflet-map h-[400px] w-full mt-12 relative z-0" data-location='{"lat":59.8589541,"lng":17.6306534,"zoom":12,"markers":[{"label":"Sankt Larsgatan 4, 753 11 Uppsala, Sverige","lat":59.858976,"lng":17.630683,"geocode":[]}]}'></div>
</main>`;

describe('parseNationsguidenDetail', () => {
    it('beskrivning, markörens adress och koordinater', () => {
        const d = parseNationsguidenDetail(detailHtml);
        expect(d.address).toBe('Sankt Larsgatan 4, 753 11 Uppsala, Sverige');
        expect(d.coords).toEqual([59.858976, 17.630683]);
        expect(d.description).toContain('80 kr');
    });

    it('priset i beskrivningen når eventet via runnerns normalisering', () => {
        const e = normalizeRawEvent({ title: 'Tisdagsklubb', startDate: new Date('2026-11-17T18:00:00'), url: 'https://x.se/#2026-11-17', description: parseNationsguidenDetail(detailHtml).description });
        expect(e.price).toBe('80 kr');
    });

    it('kartan utan markör ger inga koordinater (mittpunkten är bara stadens mitt)', () => {
        const d = parseNationsguidenDetail(`<div class="leaflet-map" data-location='{"lat":59.85,"lng":17.63,"zoom":12,"markers":[]}'></div>`);
        expect(d.coords).toBeUndefined();
        expect(d.address).toBeUndefined();
    });
});

describe('nonceFromHome', () => {
    it('läser temats nonce ur startsidan', () => {
        expect(nonceFromHome('<script> var DI_FILTER_EVENTS = {"ajaxurl":"https://www.nationsguiden.se/wp-admin/admin-ajax.php","nonce":"d7fcb2fb5a"}; </script>')).toBe('d7fcb2fb5a');
        expect(nonceFromHome('<html></html>')).toBeNull();
    });
});
