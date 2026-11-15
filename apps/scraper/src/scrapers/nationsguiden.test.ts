import { describe, it, expect } from 'vitest';
import { parseSchedule, mapNationsguidenDay, nonceFromHome } from './nationsguiden';

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

describe('nonceFromHome', () => {
    it('läser temats nonce ur startsidan', () => {
        expect(nonceFromHome('<script> var DI_FILTER_EVENTS = {"ajaxurl":"https://www.nationsguiden.se/wp-admin/admin-ajax.php","nonce":"d7fcb2fb5a"}; </script>')).toBe('d7fcb2fb5a');
        expect(nonceFromHome('<html></html>')).toBeNull();
    });
});
