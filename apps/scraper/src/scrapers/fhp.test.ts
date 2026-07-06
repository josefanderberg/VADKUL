import { describe, it, expect } from 'vitest';
import { parseFhpCards, parseFhpOccasions, normalizeCaps } from './fhp';

// Nedskalade utsnitt ur riktiga API-svar (probade 2026-07-04).
const CARDS_HTML = `
<article class="col-xs-6 card" data-id="41726">
  <div class="card-inner">
    <a class="card-img--wrapper" href="https://www.folketshusochparker.se/evenemang/konst-utstallning/for-en-rimligare-varld/"
       title="För en rimligare värld &#8211; en utställning om Folkets Hus och Folkets Park">
      <figure><img src="https://www.folketshusochparker.se/wp-content/uploads/2021/08/plakat.jpg"/></figure>
    </a>
  </div>
</article>
<article data-id="80913"><a href="https://www.folketshusochparker.se/evenemang/musik/turne-x/" title="Turné X"></a></article>`;

const OCCASIONS_HTML = `
<div class="col-sm-12"><div class="row flex-row">
  <div class="col-md-12"><h3 class="h5 wave-black event-member--list-year">2026</h3></div>
  <div class="col-xs-6 event-member--list">
    <h4 class="h7">Dalarna</h4>
    <div class="event-member--list-items">
      <a href="https://www.folketshusochparker.se/arrangor/gruvcentrum-mojsen/?evenemang=41726"
         title="GRÄNGESBERG, Gruvcentrum Mojsen">GRÄNGESBERG, Gruvcentrum Mojsen <span class="event-date event-date--after">15/6</span></a><br>
    </div>
  </div>
  <div class="col-xs-6 event-member--list">
    <h4 class="h7">Jönköping</h4>
    <div class="event-member--list-items">
      <a href="https://www.folketshusochparker.se/arrangor/birkagardens-folkets-hus/?evenemang=41726"
         title="JÖNKÖPING, Birkagårdens Folkets Hus">JÖNKÖPING, Birkagårdens Folkets Hus <span class="event-date">7/9</span></a><br>
    </div>
  </div>
  <div class="col-md-12"><h3 class="h5 event-member--list-year">2027</h3></div>
  <div class="col-xs-6 event-member--list">
    <h4 class="h7">Skåne</h4>
    <div class="event-member--list-items">
      <a href="https://www.folketshusochparker.se/arrangor/malmo-folkets-park/?evenemang=41726"
         title="MALMÖ, Folkets Park">MALMÖ, Folkets Park <span class="event-date">3/1</span></a><br>
    </div>
  </div>
</div></div>`;

describe('parseFhpCards', () => {
    it('plockar id/titel/url/bild ur korten', () => {
        const cards = parseFhpCards(CARDS_HTML);
        expect(cards).toHaveLength(2);
        expect(cards[0].id).toBe('41726');
        expect(cards[0].title).toContain('För en rimligare värld');
        expect(cards[0].url).toContain('/evenemang/konst-utstallning/');
        expect(cards[0].imageUrl).toContain('plakat.jpg');
    });
});

describe('parseFhpOccasions', () => {
    it('år tas från närmast föregående års-rubrik', () => {
        const occ = parseFhpOccasions(OCCASIONS_HTML);
        expect(occ).toHaveLength(3);
        expect(occ[0]).toMatchObject({ city: 'Grängesberg', venue: 'Gruvcentrum Mojsen' });
        expect(occ[0].date.getFullYear()).toBe(2026);
        expect(occ[0].date.getMonth()).toBe(5);   // 15/6
        expect(occ[1].city).toBe('Jönköping');
        expect(occ[2].city).toBe('Malmö');
        expect(occ[2].date.getFullYear()).toBe(2027);   // efter 2027-rubriken
        expect(occ[2].date.getMonth()).toBe(0);
    });

    it('URL:en får datum-fragment (unik per tillfälle)', () => {
        const occ = parseFhpOccasions(OCCASIONS_HTML);
        expect(occ[0].url).toContain('?evenemang=41726#15-6');
    });
});

describe('normalizeCaps', () => {
    it('VERSAL stad → normalt skick, bindestreck bevaras', () => {
        expect(normalizeCaps('GRÄNGESBERG')).toBe('Grängesberg');
        expect(normalizeCaps('SKÄRHAMN-RÖNNÄNG')).toBe('Skärhamn-Rönnäng');
        expect(normalizeCaps('UPPLANDS VÄSBY')).toBe('Upplands Väsby');
    });
});
