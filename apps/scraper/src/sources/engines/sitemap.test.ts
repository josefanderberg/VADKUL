/**
 * Tester för sitemap-motorns backfillPlaceFromHtml — koordinater ur kart-
 * länkar + ort ur location-scopad microdata. Fixtures är nedskalade utsnitt
 * ur riktiga Tickster-detaljsidor (probade 2026-07-02).
 */
import { describe, it, expect } from 'vitest';
import { backfillPlaceFromHtml, extractFromHtml } from './sitemap';
import type { RawEvent } from '../types';

/** Minimal RawEvent-fabrik — bara fälten som backfillPlaceFromHtml rör. */
function ev(partial: Partial<RawEvent> = {}): RawEvent {
    return {
        title: 'Testevent',
        startDate: new Date('2026-08-01T19:00:00'),
        url: 'https://example.com/e/1',
        ...partial,
    } as RawEvent;
}

// Utsnitt ur riktig Tickster-sida (Sängfabriken, Rävlanda) — location-microdata
// + Google Maps-länk + staticmap + footer med Tickster AB:s kontorsadresser.
const TICKSTER_HTML = `
<span itemscope itemtype="http://schema.org/Place" itemprop="location">
    <a href="/se/sv/events/at/x/sangfabriken"><span itemprop="name">S&#228;ngfabriken</span></a>
    i
    <span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
        <a href="/se/sv/events/in/r%c3%a4vlanda"><span itemprop="addressLocality">R&#228;vlanda</span></a>
    </span>
</span>
<a href="https://www.google.com/maps/search/?api=1&query=57.657,12.5106" title="S&#228;ngfabriken">
    <img class="c-map" src="https://maps.tickster.com/maps/api/staticmap?center=57.657,12.5106&zoom=13&format=png" alt="karta" />
</a>
<footer itemscope itemtype="http://schema.org/LocalBusiness">
    <span itemprop="name">Tickster AB</span>
    <span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
        <span itemprop="streetAddress">Magasinsgatan 8</span>
        <span itemprop="addressLocality">Arvika</span>
    </span>
</footer>`;

describe('backfillPlaceFromHtml', () => {
    it('plockar exakta koordinater ur Google Maps-länken', () => {
        const e = ev();
        backfillPlaceFromHtml(TICKSTER_HTML, e);
        expect(e.coords).toEqual([57.657, 12.5106]);
    });

    it('plockar ort ur location-microdata — INTE footerns kontorsort (Arvika)', () => {
        const e = ev();
        backfillPlaceFromHtml(TICKSTER_HTML, e);
        expect(e.city).toBe('Rävlanda');
    });

    it('versaliserar gement skriven ort ("karlstad" → "Karlstad")', () => {
        const html = `<span itemprop="location"><span itemprop="addressLocality">karlstad</span></span>`;
        const e = ev();
        backfillPlaceFromHtml(html, e);
        expect(e.city).toBe('Karlstad');
    });

    it('skriver ALDRIG över redan satta fält', () => {
        const e = ev({ coords: [59.33, 18.06], city: 'Stockholm' });
        backfillPlaceFromHtml(TICKSTER_HTML, e);
        expect(e.coords).toEqual([59.33, 18.06]);
        expect(e.city).toBe('Stockholm');
    });

    it('plockar koordinater ur staticmap-center när maps-länk saknas', () => {
        const html = `<img src="https://maps.tickster.com/maps/api/staticmap?center=59.3216,14.5256&zoom=13" />`;
        const e = ev();
        backfillPlaceFromHtml(html, e);
        expect(e.coords).toEqual([59.3216, 14.5256]);
    });

    it('avvisar koordinater utanför Norden (junk-skydd)', () => {
        const html = `<a href="https://www.google.com/maps/search/?api=1&query=40.7128,-74.006">karta</a>`;
        const e = ev();
        backfillPlaceFromHtml(html, e);
        expect(e.coords).toBeUndefined();
    });

    it('avvisar ort med siffror eller orimlig längd', () => {
        const html = `<span itemprop="location"><span itemprop="addressLocality">Box 334 SE-671 27</span></span>`;
        const e = ev();
        backfillPlaceFromHtml(html, e);
        expect(e.city).toBeUndefined();
    });

    it('gör inget alls när sidan saknar kart-länk och microdata', () => {
        const e = ev();
        backfillPlaceFromHtml('<p>Bara text utan struktur</p>', e);
        expect(e.coords).toBeUndefined();
        expect(e.city).toBeUndefined();
    });
});

/**
 * Kommunsajt-chrome (SiteVision): kontaktrutan ligger i sidhuvudet med EGEN
 * h1, egen tabell och egen besöksadress — och den kommer FÖRE mittenspalten i
 * DOM:en. Före 2026-08-30 vann den alla tre fallback-vägarna: titel,
 * beskrivning och adress. Fixture = nedskalad alvkarleby.se/…/carola.html.
 */
const KOMMUN_HTML = `<!doctype html><html><head>
<title>Carola! - Älvkarleby.se</title>
<meta name="description" content="Film">
</head><body>
<main>
  <div class="sv-layout lp-contact-box">
    <h1 class="heading">Kontakta kommunen och lämna synpunkter</h1>
    <table>
      <thead><tr><th><p>Öppet:</p></th><td><p>Måndag - torsdag 8-12, 13-16<br>Fredag 8-12, 13-15</p></td></tr></thead>
      <tbody><tr><th><p>Besök:</p></th><td><p>Centralgatan 3, Skutskär</p></td></tr></tbody>
    </table>
  </div>
  <div class="pagecontent">
    <h1 class="heading">TITLE_HERE</h1>
    <p class="ingress">Film på Rio Bio</p>
    <table>
      <thead><tr><th><p><strong>Tid:</strong></p></th><td><p>2 september kl 19.00</p></td></tr></thead>
      <tbody>
        <tr><th><p><strong>Plats:</strong></p></th><td><p>Rio Bio Gävlevägen 24</p></td></tr>
        <tr><th><p><strong>Pris:</strong></p></th><td><p>110 kr (Swish, kontanter och kort)<br></p></td></tr>
      </tbody>
    </table>
    <table><thead><tr><th><p><strong>Arrangör:</strong></p></th><td><p>Folkets Hus Rio Bio Skutskär</p></td></tr></thead></table>
    <p>Med tillgång till ett unikt material ger filmen Carola! en inblick i människan Carola Häggkvists liv.</p>
  </div>
</main>
<footer><p>Box 4, 814 21 Skutskär</p></footer>
</body></html>`;

const kommunPage = (title: string) => KOMMUN_HTML.replace('TITLE_HERE', title);

describe('extractFromHtml — kommunsajt utan JSON-LD', () => {
    const parse = (title = 'Carola!') =>
        extractFromHtml(kommunPage(title), 'https://www.alvkarleby.se/e/carola.html', 'Älvkarleby')!;

    it('tar eventets plats — inte kommunhusets besöksadress', () => {
        const ev = parse();
        expect(ev.venueName).toBe('Rio Bio');
        expect(ev.address).toBe('Gävlevägen 24');
    });

    it('tar eventets brödtext — inte kontaktrutans öppettider', () => {
        expect(parse().description).toMatch(/Med tillgång till ett unikt material/);
        expect(parse().description).not.toMatch(/Måndag - torsdag/);
    });

    it('läser pris och arrangör ur faktatabellen', () => {
        const ev = parse();
        expect(ev.price).toBe('110 kr (Swish, kontanter och kort)');
        expect(ev.organizer).toBe('Folkets Hus Rio Bio Skutskär');
    });

    it('tar h1 ur mittenspalten när sidtiteln inte kan matchas exakt', () => {
        // Bindestreck i titeln ("Terminator 2 - Judgment Day - Älvkarleby.se")
        // bryter segmenteringen mot <title> → exaktmatchningen missar, och
        // dokumentets FÖRSTA h1 är kontaktrutans.
        expect(parse('Terminator 2 - Judgment Day').title).toBe('Terminator 2 - Judgment Day');
    });
});

describe('extractFromHtml — ingress', () => {
    it('lägger ingressen först i beskrivningen (bär kategorisignalen)', () => {
        const ev = extractFromHtml(kommunPage('Carola!'), 'https://x.se/e/1', 'Älvkarleby')!;
        expect(ev.description).toMatch(/^Film på Rio Bio\. Med tillgång till/);
    });

    it('dubblerar inte en ingress som redan står i brödtexten', () => {
        const html = kommunPage('Carola!').replace('<p class="ingress">Film på Rio Bio</p>', '');
        expect(extractFromHtml(html, 'https://x.se/e/1', 'Älvkarleby')!.description)
            .toMatch(/^Med tillgång till/);
    });
});

describe('extractFromHtml — klockslag ur faktatabellen', () => {
    it('läser klockslaget även när cellerna klistras ihop och månaden är felstavad', () => {
        // alvkarleby.se skrev "13 septeber kl 12.00" (kommunens stavfel) och
        // cheerio ger texten som "…kl 12.00Plats:…" — utan ordgräns efter "00".
        const html = kommunPage('Bus och mysterier med Alfons Åberg')
            .replace('2 september kl 19.00', '13 septeber kl 12.00');
        const ev = extractFromHtml(html, 'https://x.se/e/1', 'Älvkarleby')!;
        expect(ev.startDate.getHours()).toBe(12);
        expect(ev.startDate.getMinutes()).toBe(0);
    });
});

describe('extractFromHtml — event utan egen gatuadress', () => {
    it('ärver ALDRIG kommunhusets besöksadress när platsen saknar gatunummer', () => {
        const html = kommunPage('​Gemensam sådd')
            .replace('Rio Bio Gävlevägen 24', 'Brandstationen Skutskär');
        const ev = extractFromHtml(html, 'https://x.se/e/2', 'Älvkarleby')!;
        expect(ev.venueName).toBe('Brandstationen Skutskär');
        expect(ev.address).toBeUndefined();
    });
});
