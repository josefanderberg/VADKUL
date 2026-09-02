/**
 * Tester för Ölands Skördefest-motorn. Fixtures är nedskalade utsnitt ur
 * riktiga svar (probat 2026-08-31).
 */
import { describe, it, expect } from 'vitest';
import {
    parseFestivalRange,
    parseActivityPage,
    parseActivitySitemap,
    parseCoordinates,
    buildEventTitle,
    stripYearSuffix,
} from './skordefest';

const NOW = new Date('2026-08-31T10:00:00');

describe('parseFestivalRange', () => {
    it('läser "23 -27 september 2026" från startsidan', () => {
        const r = parseFestivalRange('<h1>23 &#8211;27 september 2026</h1><p>Ölands Skördefest</p>', NOW)!;
        expect(r.start.getMonth()).toBe(8);
        expect(r.start.getDate()).toBe(23);
        expect(r.end.getMonth()).toBe(8);
        expect(r.end.getDate()).toBe(27);
        expect(r.start.getFullYear()).toBe(2026);
    });

    it('klarar spann över månadsskifte', () => {
        const r = parseFestivalRange('<p>30 september - 4 oktober 2027</p>', NOW)!;
        expect(r.start.getMonth()).toBe(8);
        expect(r.start.getDate()).toBe(30);
        expect(r.end.getMonth()).toBe(9);
        expect(r.end.getDate()).toBe(4);
        expect(r.end.getFullYear()).toBe(2027);
    });

    it('returnerar null när datum saknas — motorn ska hellre avbryta än gissa', () => {
        expect(parseFestivalRange('<p>Välkommen till Ölands Skördefest!</p>', NOW)).toBeNull();
    });
});

describe('stripYearSuffix', () => {
    it('kapar årtalet deltagarna namnger sig med', () => {
        expect(stripYearSuffix('Kallbadhuset 2026')).toBe('Kallbadhuset');
        expect(stripYearSuffix('ÖLJUD KULTURFÖRENING 2026')).toBe('ÖLJUD KULTURFÖRENING');
        expect(stripYearSuffix('Stenladan Gårdsbutik i Algutsrum 2026')).toBe('Stenladan Gårdsbutik i Algutsrum');
    });

    it('rör inte årtal mitt i namnet eller namn utan årtal', () => {
        expect(stripYearSuffix('Galleri 2026 Konst')).toBe('Galleri 2026 Konst');
        expect(stripYearSuffix('Ölands Plantskola')).toBe('Ölands Plantskola');
    });

    it('lämnar tillbaka originalet om hela namnet ÄR ett årtal', () => {
        expect(stripYearSuffix('2026')).toBe('2026');
    });
});

// Utsnitt ur /aktivitet/farets-dagar-2026/ (probat 2026-08-31): aktiviteten
// saknar egna koordinater men länkar ett deltagarkort som har dem.
const ACTIVITY_HTML = `
<section class="single-hero">
  <h1 class="single-hero__inner__title">Fårets Dagar 2026</h1>
  <div class="background"><img src="/wp-content/uploads/2026/07/IMG_7128.jpg" class="background__image" alt=""></div>
</section>
<section class="single-content"><div class="single-content__left full-width"></div></section>
<section class="archive-wrapper">
  <a href="https://skordefest.nu/alla-deltagare/farets-dagar/" class="swiper-slide">
    <div class="members-card-info">
      <p class="members-card-info__title">Fårets Dagar på Borgholms Slott 2026</p>
      <div class="members-card-info__excerpt"><p>FÅR, historiskt soldatläger och säsongsutställningen ”Icons of Power”.</p></div>
    </div>
    <div class="swiper-slide__area"><span>Område:</span>Mellersta Öland, Borgholm </div>
  </a>
</section>`;

// Aktivitet MED egna koordinater (i HTML-kommentar) och utan deltagarkort.
const ACTIVITY_WITH_COORDS = `
<h1 class="single-hero__inner__title">Ostfestivalen i Mörbylånga 2026</h1>
<meta property="og:description" content="Välkommen till charmiga Mörbylånga där det under två dagar är smakupplevelser i fokus." />
<!-- script>
  var coordinates = [{"post_id":39457,"lat":"56.5241245","lng":"16.3884109","zoom":"8"}];
</script -->`;

describe('parseActivityPage', () => {
    it('läser titel, bild, område och länkade deltagarsidor', () => {
        const a = parseActivityPage(ACTIVITY_HTML, 'https://skordefest.nu')!;
        expect(a.title).toBe('Fårets Dagar 2026');
        expect(a.imageUrl).toBe('https://skordefest.nu/wp-content/uploads/2026/07/IMG_7128.jpg');
        expect(a.place).toBe('Borgholm');
        expect(a.participantUrls).toEqual(['https://skordefest.nu/alla-deltagare/farets-dagar/']);
        expect(a.coords).toBeUndefined();
    });

    it('faller tillbaka på deltagarkortets ingress när aktiviteten saknar egen text', () => {
        const a = parseActivityPage(ACTIVITY_HTML, 'https://skordefest.nu')!;
        expect(a.description).toContain('soldatläger');
    });

    it('tar egna koordinater och og:description när de finns', () => {
        const a = parseActivityPage(ACTIVITY_WITH_COORDS, 'https://skordefest.nu')!;
        expect(a.coords![0]).toBeCloseTo(56.5241, 3);
        expect(a.description).toContain('Mörbylånga');
        expect(a.participantUrls).toHaveLength(0);
    });

    it('landsdelen ensam duger inte som stad', () => {
        const html = ACTIVITY_HTML.replace('Mellersta Öland, Borgholm', 'Södra Öland');
        expect(parseActivityPage(html, 'https://skordefest.nu')!.place).toBeUndefined();
    });

    it('sida utan rubrik ger null', () => {
        expect(parseActivityPage('<div>tomt</div>', 'https://skordefest.nu')).toBeNull();
    });
});

describe('parseCoordinates', () => {
    it('avvisar koordinater utanför Öland', () => {
        const html = ACTIVITY_WITH_COORDS.replace('56.5241245', '59.3293').replace('16.3884109', '18.0686');
        expect(parseCoordinates(html)).toBeUndefined();
    });
});

describe('parseActivitySitemap', () => {
    it('tar detaljsidorna men inte index eller feed', () => {
        const xml = `<urlset>
            <url><loc>https://skordefest.nu/aktivitet/</loc></url>
            <url><loc>https://skordefest.nu/aktivitet/feed/</loc></url>
            <url><loc>https://skordefest.nu/aktivitet/dockparaden-2026/</loc></url>
            <url><loc>https://skordefest.nu/aktivitet/konstnatten/</loc></url>
        </urlset>`;
        expect(parseActivitySitemap(xml)).toEqual([
            'https://skordefest.nu/aktivitet/dockparaden-2026/',
            'https://skordefest.nu/aktivitet/konstnatten/',
        ]);
    });
});

describe('buildEventTitle', () => {
    it('prefixar med Skördefest när titeln inte redan säger det', () => {
        expect(buildEventTitle('Dockparaden 2026')).toBe('Skördefest: Dockparaden');
        expect(buildEventTitle('Fårets Dagar 2026')).toBe('Skördefest: Fårets Dagar');
    });

    it('dubblerar inte ordet', () => {
        expect(buildEventTitle('Skördefest i Färjestadens hamn 2026')).toBe('Skördefest i Färjestadens hamn');
        expect(buildEventTitle('Löttorps Skördeyra 2026')).toBe('Löttorps Skördeyra');
    });
});
