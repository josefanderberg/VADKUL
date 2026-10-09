import { describe, it, expect } from 'vitest';
import { findVenueInHtml, findVenueInText, htmlToLines } from './wp-rest';

describe('htmlToLines', () => {
    it('gör <br> och block-slut till radbrytningar', () => {
        expect(htmlToLines('<p><strong>Plats: A</strong><br />B</p>\n<p>C</p>')).toBe('Plats: A\nB\nC');
    });
});

describe('findVenueInText', () => {
    // Visit Östersund 2026-10-08: "Ovikens gamla kyrka Torsdag 8 oktober kl"
    // blev platsnamnet → geokodningen missade → eventet låg mitt i Östersund.
    it('"Plats:" stannar vid <br> (Ovikens gamla kyrka)', () => {
        const html = '<p><strong>Plats: Ovikens gamla kyrka</strong><br />Torsdag 8 oktober kl 19.00, entrén öppnar 18.30.</p>';
        expect(findVenueInText(html)).toBe('Ovikens gamla kyrka');
    });

    it('"Plats:" stannar vid </p> och nästa <br>-rad', () => {
        expect(findVenueInText('<p>Tid: 19:00<br />Plats: Storsjöteatern, Östersund</p>\n<p>Om biljetter:<br />Pris: 290 kr</p>'))
            .toBe('Storsjöteatern, Östersund');
        expect(findVenueInText('<p>Plats: Storsjöteatern, Östersund<br />Speltid: 2 tim, 20 minuter inkl paus.</p>'))
            .toBe('Storsjöteatern, Östersund');
        expect(findVenueInText('<p>Torsdag 22 oktober kl 19.30<br />Plats: Gamla Teatern</p>\n<p>Pris: 280 kr, medlen 220 kr</p>'))
            .toBe('Gamla Teatern');
    });

    it('"på X" fortsätter inte över en radbrytning', () => {
        expect(findVenueInText('<p>Konsert på Jamtli<br />Biljetter säljs i entrén</p>')).toBe('Jamtli');
    });

    it('plats på samma rad fungerar som förut', () => {
        expect(findVenueInText('<p>Plats: Folkets Hus. Välkomna!</p>')).toBe('Folkets Hus');
    });
});

describe('findVenueInHtml', () => {
    it('"Plats:" i detaljsidans text stannar vid <br>', () => {
        expect(findVenueInHtml('<div><b>Plats: Ovikens gamla kyrka</b><br>Torsdag 8 oktober</div>')).toBe('Ovikens gamla kyrka');
    });

    it('<dt>Plats</dt><dd>X</dd>', () => {
        expect(findVenueInHtml('<dl><dt>Plats</dt><dd>Trollsjön</dd></dl>')).toBe('Trollsjön');
    });
});
