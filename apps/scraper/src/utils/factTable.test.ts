/**
 * Tester för fakta-tabell-läsningen. Fixtures är nedskalade utsnitt ur
 * alvkarleby.se (SiteVision, hämtade 2026-08-30) — sidan där kommunhusets
 * kontaktruta vann över eventets egen "Plats: Rio Bio Gävlevägen 24".
 */
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractEventFacts, parsePlaceValue } from './factTable';

/** Kontaktrutan i sidhuvudet — finns på VARJE sida på kommunsajten. */
const CONTACT_TABLE = `
<table>
  <thead><tr><th><p>Öppet:</p></th><td><p>Måndag - torsdag 8-12, 13-16<br>Fredag 8-12, 13-15</p></td></tr></thead>
  <tbody>
    <tr><th><p>Telefon:</p></th><td><p>026-830 00</p></td></tr>
    <tr><th><p>Besök:</p></th><td><p>Centralgatan 3, Skutskär</p></td></tr>
  </tbody>
</table>`;

/** Eventets egen faktatabell (SiteVision `lp-event-details`). */
const EVENT_TABLES = `
<table>
  <thead><tr><th><p><strong>Tid:</strong></p></th><td><p>2 september kl 19.00</p></td></tr></thead>
  <tbody>
    <tr><th><p><strong>Plats:</strong></p></th><td><p>Rio Bio Gävlevägen 24</p></td></tr>
    <tr><th><p><strong>Pris:</strong></p></th><td><p>110 kr (Swish, kontanter och kort)<br></p></td></tr>
  </tbody>
</table>
<table>
  <thead><tr><th><p><strong>Arrangör:</strong></p></th><td><p>Folkets Hus Rio Bio Skutskär</p></td></tr></thead>
</table>`;

const scopeOf = (html: string) => {
    const $ = cheerio.load(`<div class="pagecontent">${html}</div>`);
    return { $, root: $('.pagecontent') };
};

describe('extractEventFacts', () => {
    it('läser Tid/Plats/Pris/Arrangör ur eventets faktatabell', () => {
        const { $, root } = scopeOf(EVENT_TABLES);
        const f = extractEventFacts($, root);
        expect(f.time).toBe('2 september kl 19.00');
        expect(f.venueName).toBe('Rio Bio');
        expect(f.address).toBe('Gävlevägen 24');
        expect(f.price).toBe('110 kr (Swish, kontanter och kort)');
        expect(f.organizer).toBe('Folkets Hus Rio Bio Skutskär');
    });

    it('hoppar över kontaktrutan — kommunhusets besöksadress blir aldrig plats', () => {
        const { $, root } = scopeOf(CONTACT_TABLE + EVENT_TABLES);
        const f = extractEventFacts($, root);
        expect(f.address).toBe('Gävlevägen 24');
        expect(f.venueName).toBe('Rio Bio');
        expect(JSON.stringify(f)).not.toContain('Centralgatan');
        expect(JSON.stringify(f)).not.toContain('Måndag');
    });

    it('läser ort ur plats-raden när den finns ("Biblioteket, Ågatan 7, Skutskär")', () => {
        const { $, root } = scopeOf(`<table><tr><th>Plats:</th><td>Biblioteket, Ågatan 7, Skutskär</td></tr></table>`);
        const f = extractEventFacts($, root);
        expect(f.venueName).toBe('Biblioteket');
        expect(f.address).toBe('Ågatan 7');
        expect(f.city).toBe('Skutskär');
    });

    it('läser definitionslistor (dt/dd) med samma etiketter', () => {
        const { $, root } = scopeOf(`<dl><dt>Plats</dt><dd>Konserthuset Storgatan 5</dd><dt>Pris</dt><dd>Gratis</dd></dl>`);
        const f = extractEventFacts($, root);
        expect(f.venueName).toBe('Konserthuset');
        expect(f.address).toBe('Storgatan 5');
        expect(f.price).toBe('Gratis');
    });

    it('ger tomt resultat när sidan saknar nyckel/värde-block', () => {
        const { $, root } = scopeOf('<p>Bara brödtext här.</p>');
        expect(extractEventFacts($, root)).toEqual({});
    });
});

describe('parsePlaceValue', () => {
    it('delar "Venue Gatan NN" i venue + adress', () => {
        expect(parsePlaceValue('Rio Bio Gävlevägen 24')).toEqual({ venueName: 'Rio Bio', address: 'Gävlevägen 24' });
    });

    it('behandlar hela strängen som venue när ingen gatuadress finns', () => {
        expect(parsePlaceValue('Fyrklövern')).toEqual({ venueName: 'Fyrklövern' });
    });

    it('läser postnummer + ort i sista segmentet', () => {
        expect(parsePlaceValue('Folkets Hus, Storgatan 1, 814 41 Skutskär'))
            .toEqual({ venueName: 'Folkets Hus', address: 'Storgatan 1', city: 'Skutskär' });
    });

    it('tolkar INTE sista segmentet som ort när adress saknas ("Stadshuset, Sessionssalen")', () => {
        expect(parsePlaceValue('Stadshuset, Sessionssalen').city).toBeUndefined();
        expect(parsePlaceValue('Stadshuset, Sessionssalen').venueName).toBe('Stadshuset');
    });

    it('avvisar orimligt långa värden', () => {
        expect(parsePlaceValue('x'.repeat(200))).toEqual({});
    });
});

describe('extractEventFacts — <p><strong>Etikett:</strong> värde', () => {
    const html = `<aside class="notify-box">
        <p><strong>Tid:</strong> 29 september klockan 16.00-17.00</p>
        <p><strong>Plats:</strong> Lustigkullevägen 44 B, Källarlokalen</p>
        <p><strong>Pris:</strong> Gratis</p>
    </aside>`;

    it('läser faktablock utan tabell (motala.se-mönstret)', () => {
        const { $, root } = scopeOf(html);
        const f = extractEventFacts($, root);
        expect(f.time).toBe('29 september klockan 16.00-17.00');
        expect(f.price).toBe('Gratis');
        expect(f.address).toBe('Lustigkullevägen 44');
    });

    it('rör inte stycken vars etikett är kontaktinfo', () => {
        const { $, root } = scopeOf('<p><strong>Telefon:</strong> 026-830 00</p>');
        expect(extractEventFacts($, root)).toEqual({});
    });
});
