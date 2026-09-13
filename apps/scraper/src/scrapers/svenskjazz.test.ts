import { describe, it, expect } from 'vitest';
import { parseSjzDate, parseSjzLocation, hasNorticLink, mapSjzDetail } from './svenskjazz';

// Fast "nu" för deterministiska år-inferenser: 13 september 2026.
const NOW = new Date(2026, 8, 13, 12, 0, 0);

describe('parseSjzDate', () => {
    it('datum senare i år stannar i år', () => {
        const d = parseSjzDate('15', 'Dec', NOW)!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(11);
        expect(d.getDate()).toBe(15);
    });

    it('passerat datum rullar till nästa år', () => {
        const d = parseSjzDate('28', 'Jan', NOW)!;
        expect(d.getFullYear()).toBe(2027);
        expect(d.getMonth()).toBe(0);
    });

    it('dagens datum räknas som kommande (kvällens gig)', () => {
        const d = parseSjzDate('13', 'Sep', NOW)!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getDate()).toBe(13);
    });

    it('okänd månad och orimlig dag ger null', () => {
        expect(parseSjzDate('15', 'Xyz', NOW)).toBeNull();
        expect(parseSjzDate('32', 'Dec', NOW)).toBeNull();
        // 31 apr existerar inte — får inte rulla över till 1 maj
        expect(parseSjzDate('31', 'Apr', NOW)).toBeNull();
    });
});

describe('parseSjzLocation', () => {
    it('ort, scen och klockslag', () => {
        expect(parseSjzLocation('Stockholm, Fasching kl 20:00')).toEqual({
            city: 'Stockholm', venueName: 'Fasching', hour: 20, minute: 0,
        });
    });

    it('klockslag utan minuter och utan scen', () => {
        expect(parseSjzLocation('Umeå kl 19')).toEqual({
            city: 'Umeå', venueName: undefined, hour: 19, minute: 0,
        });
    });

    it('utan klockslag', () => {
        expect(parseSjzLocation('Sandviken, Jazzstugan')).toEqual({
            city: 'Sandviken', venueName: 'Jazzstugan', hour: undefined, minute: undefined,
        });
    });

    it('scen med komma i namnet hålls ihop', () => {
        const r = parseSjzLocation('Göteborg, Nefertiti, källaren kl 19.30');
        expect(r.city).toBe('Göteborg');
        expect(r.venueName).toBe('Nefertiti, källaren');
        expect(r.hour).toBe(19);
        expect(r.minute).toBe(30);
    });
});

describe('hasNorticLink', () => {
    it('träffar nortic-varianter men inte annat', () => {
        expect(hasNorticLink('<a href="https://www.nortic.se/ticket/show/1">Biljetter</a>')).toBe(true);
        expect(hasNorticLink('<a href="https://tickets.nortic.se/ticket/event/2#a0">Köp</a>')).toBe(true);
        expect(hasNorticLink('<a href="https://www.tickster.com/x">Köp</a>')).toBe(false);
    });
});

describe('mapSjzDetail', () => {
    const HTML = `
        <meta property="og:image" content="https://svenskjazz.se/bild.jpg" />
        <div class="sjz_event_post_start_date"> <span>15</span> <span>Dec</span></div>
        <div class="sjz_event_post_content">
        <span class="sjz_event_post_location">Stockholm, Fasching kl 20:00</span>
        <h4>Joel Lyssarides Trio</h4>
        <span class="sjz_event_post_description">L&auml;s mer p&aring; Fasching.se.</span>
        <span class="sjz_event_post_organizer"><b>Arrangör:</b> Fasching</span>`;

    it('mappar hela detaljsidan', () => {
        const ev = mapSjzDetail('https://svenskjazz.se/event/x/', 'Joel Lyssarides Trio', HTML, NOW)!;
        expect(ev.title).toBe('Joel Lyssarides Trio');
        expect(ev.startDate.getFullYear()).toBe(2026);
        expect(ev.startDate.getMonth()).toBe(11);
        expect(ev.startDate.getHours()).toBe(20);
        expect(ev.city).toBe('Stockholm');
        expect(ev.venueName).toBe('Fasching');
        expect(ev.organizer).toBe('Fasching');
        expect(ev.description).toContain('Läs mer');
        expect(ev.imageUrl).toBe('https://svenskjazz.se/bild.jpg');
        expect(ev.category).toBe('music');
        expect(ev.hasSpecificTime).toBe(true);
    });

    it('Nortic-länkad sida hoppas över', () => {
        const withNortic = HTML + '<a href="https://www.nortic.se/ticket/show/358736">Biljetter</a>';
        expect(mapSjzDetail('https://svenskjazz.se/event/x/', 'X', withNortic, NOW)).toBeNull();
    });

    it('sida utan datum-spans ger null', () => {
        expect(mapSjzDetail('https://svenskjazz.se/event/x/', 'X', '<div>inget</div>', NOW)).toBeNull();
    });
});
