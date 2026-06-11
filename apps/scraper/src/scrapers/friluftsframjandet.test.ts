import { describe, it, expect } from 'vitest';
import { mapFfItem, parseDetailTimes, parseDescription } from './friluftsframjandet';

/** Verklig form från sök-API:t 2026-06-11. */
const baseItem = {
    link: '/lat-aventyret-borja/hitta-aventyr/vandring/vandring/torsdagsvandring-pa-ekero/',
    image: { imageLink: '/globalassets/7.-aventyrsbilder/vandring/_dsc5805.jpg', alt: 'bild' },
    icon: 'stavgang',
    price: 150.0,
    title: 'Torsdagsvandring på Ekerö',
    sessions: 1,
    type: 'Aktivitet',
    organizer: 'Mälaröarna',
    startDate: '11 jun',
    fullyBooked: false,
    forLeaders: false,
    branch: 'Vandring',
    longitude: '17.791578134452806',
    latitude: '59.2792502015063',
    hasEnded: false,
    adventureArea: 'Vandring',
};

/** Verklig markup från detaljsidan (båda varianterna förekommer). */
const detailHtml = `
<p class="u-marginTopZero">
    <b>Start:</b> torsdag, 11 jun 2026 (kl 09:30)<br />
    <b>Slut:</b> torsdag, 11 jun 2026 (kl 13:00)<br />
</p>
<meta property="og:description" content="Vi vandrar ungefär 7 km p&#229; skogsv&#228;gar &amp; stigar." />
`;

const propertyListHtml = `
<div class="PropertyList-item">
    <div class="PropertyList-key">Start</div>
    <div class="PropertyList-value">lördag, 5 sep 2026 (kl 10:00)</div>
</div>
`;

describe('parseDetailTimes', () => {
    it('plockar start och slut ur <b>-varianten, med klockslag', () => {
        const { start, end } = parseDetailTimes(detailHtml);
        expect(start?.getFullYear()).toBe(2026);
        expect(start?.getMonth()).toBe(5);
        expect(start?.getDate()).toBe(11);
        expect(start?.getHours()).toBe(9);
        expect(start?.getMinutes()).toBe(30);
        expect(end?.getHours()).toBe(13);
    });

    it('faller tillbaka på PropertyList-varianten', () => {
        const { start } = parseDetailTimes(propertyListHtml);
        expect(start?.getDate()).toBe(5);
        expect(start?.getMonth()).toBe(8);
        expect(start?.getHours()).toBe(10);
    });

    it('saknad markup ger null', () => {
        expect(parseDetailTimes('<html>inget här</html>').start).toBeNull();
    });
});

describe('parseDescription', () => {
    it('dekodar og:description', () => {
        expect(parseDescription(detailHtml)).toBe('Vi vandrar ungefär 7 km på skogsvägar & stigar.');
    });
});

describe('mapFfItem', () => {
    const times = { start: new Date(2026, 5, 11, 9, 30), end: new Date(2026, 5, 11, 13, 0) };

    it('mappar ett komplett äventyr med koordinater, värd och pris', () => {
        const e = mapFfItem(baseItem, times, 'Vi vandrar 7 km.')!;
        expect(e.url).toBe('https://www.friluftsframjandet.se/lat-aventyret-borja/hitta-aventyr/vandring/vandring/torsdagsvandring-pa-ekero/');
        expect(e.coords).toEqual([59.2792502015063, 17.791578134452806]);   // lat, lng
        expect(e.hostName).toBe('Friluftsfrämjandet Mälaröarna');
        expect(e.venueName).toBe('Friluftsfrämjandet Mälaröarna');
        expect(e.imageUrl).toBe('https://www.friluftsframjandet.se/globalassets/7.-aventyrsbilder/vandring/_dsc5805.jpg');
        expect(e.price).toBe('150');
        expect(e.description).toBe('Vandring. Vi vandrar 7 km.');
        expect(e.startDate).toBe(times.start);
        expect(e.endDate).toBe(times.end);
    });

    it('ledarutbildningar och avslutade hoppas över', () => {
        expect(mapFfItem({ ...baseItem, forLeaders: true }, times)).toBeNull();
        expect(mapFfItem({ ...baseItem, hasEnded: true }, times)).toBeNull();
    });

    it('interna arrangemang filtreras på titel — publika kurser berörs inte', () => {
        for (const internal of [
            'Långfärdsskridskor ledarutbildning steg 3, 26422',
            'Biski instruktörsutbildning. Intresseanmälan.',
            'Träff för lokalavdelningar i region Mälardalen',
        ]) {
            expect(mapFfItem({ ...baseItem, title: internal }, times), internal).toBeNull();
        }
        expect(mapFfItem({ ...baseItem, title: 'Kajakkurs för nybörjare' }, times)).not.toBeNull();
        expect(mapFfItem({ ...baseItem, title: 'Långfärdsskridskor utbildning steg 1' }, times)).not.toBeNull();
    });

    it('utan startdatum från detaljsidan hoppas äventyret över', () => {
        expect(mapFfItem(baseItem, { start: null, end: null })).toBeNull();
    });

    it('gratis äventyr får inget pris, trasiga koordinater utelämnas', () => {
        const e = mapFfItem({ ...baseItem, price: 0, latitude: '', longitude: '' }, times)!;
        expect(e.price).toBeUndefined();
        expect(e.coords).toBeUndefined();
    });
});
