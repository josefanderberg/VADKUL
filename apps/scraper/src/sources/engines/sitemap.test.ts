/**
 * Tester för sitemap-motorns backfillPlaceFromHtml — koordinater ur kart-
 * länkar + ort ur location-scopad microdata. Fixtures är nedskalade utsnitt
 * ur riktiga Tickster-detaljsidor (probade 2026-07-02).
 */
import { describe, it, expect } from 'vitest';
import { backfillPlaceFromHtml } from './sitemap';
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
