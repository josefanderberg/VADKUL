/**
 * Tester för sitemap-motorns backfillPlaceFromHtml — koordinater ur kart-
 * länkar + ort ur location-scopad microdata. Fixtures är nedskalade utsnitt
 * ur riktiga Tickster-detaljsidor (probade 2026-07-02).
 */
import { describe, it, expect } from 'vitest';
import { backfillPlaceFromHtml, extractCatalogDates, cheerioFallback, extractFromHtml, dateFromDetailSelector } from './sitemap';
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

// Utsnitt ur Borgholms slotts /evenemang/-arkiv (probat 2026-08-31): datumet
// finns BARA här, detaljsidan har det inte. Ett kort saknar datum helt.
const BORGHOLM_ARCHIVE = `
<div class="archive-list__items">
  <article id="post-5279" class="event">
    <div class="text-content"><h1 class="post-title">Spökvandring på Borgholms Slott</h1></div>
    <a href="https://www.borgholmsslott.se/evenemang/spokvandring-pa-borgholms-slott/" class="read-more"></a>
  </article>
  <article id="post-5282" class="event">
    <div class="text-content">
      <h1 class="post-title">Specialguidning: Slottets baksida</h1>
      <div class="dateoftheitem"><svg></svg> 2026-09-05 </div>
    </div>
    <a href="/evenemang/specialguidning-slottets-baksida/" class="read-more"></a>
  </article>
  <article id="post-5301" class="event">
    <div class="text-content">
      <h1 class="post-title">Fårets Dagar</h1>
      <div class="dateoftheitem"> 2026-09-25 till 2026-09-27 </div>
    </div>
    <a href="/evenemang/farets-dagar/" class="read-more"></a>
  </article>
</div>`;

const CATALOG_SEL = { itemSelector: 'article', linkSelector: 'a.read-more', dateSelector: '.dateoftheitem' };

describe('extractCatalogDates', () => {
    it('läser datum per kort och nycklar på absolut URL utan avslutande slash', () => {
        const m = extractCatalogDates(BORGHOLM_ARCHIVE, 'https://www.borgholmsslott.se/evenemang/', CATALOG_SEL);
        const d = m.get('https://www.borgholmsslott.se/evenemang/specialguidning-slottets-baksida');
        expect(d).toBeInstanceOf(Date);
        expect(d!.getFullYear()).toBe(2026);
        expect(d!.getMonth()).toBe(8);      // september
        expect(d!.getDate()).toBe(5);
    });

    it('tar intervallets FÖRSTA datum', () => {
        const m = extractCatalogDates(BORGHOLM_ARCHIVE, 'https://www.borgholmsslott.se/evenemang/', CATALOG_SEL);
        const d = m.get('https://www.borgholmsslott.se/evenemang/farets-dagar')!;
        expect(d.getMonth()).toBe(8);
        expect(d.getDate()).toBe(25);
    });

    it('kort utan datum kommer inte med — motorn hoppar dem hellre än gissar', () => {
        const m = extractCatalogDates(BORGHOLM_ARCHIVE, 'https://www.borgholmsslott.se/evenemang/', CATALOG_SEL);
        expect(m.has('https://www.borgholmsslott.se/evenemang/spokvandring-pa-borgholms-slott')).toBe(false);
        expect(m.size).toBe(2);
    });
});

// Utsnitt ur morbylanga.se/aktiviteter/ (probat 2026-08-31): platsen står i en
// info-ruta med etiketten i <strong>, utan microdata.
const MORBYLANGA_PAGE = `
<html><body>
  <main><h1>Musikcafé på Ladan</h1><p>Välkommen på musikcafé.</p></main>
  <aside class="sidebar-right"><div class="card-wrap">
    <h4>Mer information</h4>
    <p><strong>Tid:</strong><span class="card-date-item">Fredag 4 sep 2026, 10.00-11.30</span></p>
    <p><strong>Plats:</strong>
    Ladan , Näckrosgatan 9 Färjestaden</p>
    <p><strong>Arrangör:</strong> Mörbylånga kommun</p>
  </div></aside>
</body></html>`;

describe('cheerioFallback — plats ur fet etikett', () => {
    it('läser "<strong>Plats:</strong> …" och normaliserar mellanslaget före kommat', () => {
        const ev = cheerioFallback(MORBYLANGA_PAGE, 'https://www.morbylanga.se/aktiviteter/musikcafe-pa-ladan/', 'Mörbylånga')!;
        expect(ev.venueName).toBe('Ladan, Näckrosgatan 9 Färjestaden');
        expect(ev.city).toBe('Mörbylånga');
    });

    it('plockar inte "Arrangör"-raden som plats', () => {
        const ev = cheerioFallback(MORBYLANGA_PAGE, 'https://www.morbylanga.se/aktiviteter/x/', 'Mörbylånga')!;
        expect(ev.venueName).not.toContain('Mörbylånga kommun');
    });

    it('sida utan platsetikett ger ingen venue (i stället för skräp)', () => {
        const html = '<html><body><main><h1>Event</h1><p>2026-09-04</p></main></body></html>';
        const ev = cheerioFallback(html, 'https://example.se/e/1', 'Kalmar')!;
        expect(ev.venueName).toBeUndefined();
    });
});

// Nedskalat utsnitt ur en riktig Kulturbolaget-detaljsida (probad 2026-08-31).
// Sidans EGET event har bara text i faktarutan; "Rekommenderade evenemang"-
// karusellen längst ned bär däremot full microdata per kort — startDate,
// location och egen h1. Det var korten som förgiftade extraktionen: 36 KB-event
// hamnade på 2026-09-09 och 26 på 2026-09-23, alla på fel spelplats.
const KB_PAGE = `<html><head><title>The Proclaimers | Kulturbolaget</title></head><body>
<article itemscope itemtype="http://schema.org/MusicEvent">
  <header><h1 itemprop="name">The Proclaimers</h1></header>
  <section>
    <div class="InformationBox__header">
      <div class="InformationBox__meta-data">
        <i class="material-icons InformationBox__meta-icon">calendar_today</i>
        <span class="InformationBox__meta-content">23 september</span>
      </div>
      <div class="InformationBox__meta-data" itemscope itemprop="location"
           itemtype="http://schema.org/PostalAddress">
        <i class="material-icons InformationBox__meta-icon">location_on</i>
        <span class="InformationBox__meta-content">Tr&auml;dg&aring;r'n,&nbsp;
          <span class="event-city" itemprop="addressLocality">G&ouml;teborg</span>
        </span>
      </div>
    </div>
    <ul class="Details"><li><i class="material-icons">schedule</i><span>18:00</span></li></ul>
  </section>
</article>
<section id="highlights">
  <div class="section-title"><h2>Rekommenderade evenemang</h2></div>
  <div class="highlight" itemscope itemtype="http://schema.org/MusicEvent">
    <a href="/konserter/2025/jazz-sabbath-mlm/"><h1 itemprop="name">Jazz Sabbath</h1></a>
    <h3><meta itemprop="startDate" content="2026-09-09T19:00">9 september</h3>
    <div itemscope itemprop="location" itemtype="http://schema.org/PostalAddress">
      <span itemprop="name">Inkonst</span>
      <span itemprop="addressLocality">Malm&ouml;</span>
    </div>
  </div>
  <div class="highlight" itemscope itemtype="http://schema.org/MusicEvent">
    <a href="/konserter/2025/jazz-sabbath-gbg/"><h1 itemprop="name">Jazz Sabbath</h1></a>
    <h3><meta itemprop="startDate" content="2026-09-10T18:00">10 september</h3>
  </div>
</section>
</body></html>`;

describe('cheerioFallback — "Rekommenderade evenemang" förgiftar inte sidan', () => {
    const URL = 'https://kulturbolaget.se/konserter/2026/the-proclaimers-gbg/';

    it('tar INTE karusellens startDate-microdata', () => {
        const ev = cheerioFallback(KB_PAGE, URL, 'Malmö')!;
        expect(ev.startDate.getMonth()).toBe(8);
        expect(ev.startDate.getDate()).toBe(23);   // sidans egen "23 september"
    });

    it('tar INTE karusellens venue', () => {
        const ev = cheerioFallback(KB_PAGE, URL, 'Malmö')!;
        expect(ev.venueName).not.toContain('Inkonst');
        expect(ev.venueName).toBe("Trädgår'n, Göteborg");
    });

    it('ligatur-ikoner ("location_on") följer inte med i platssträngen', () => {
        const ev = cheerioFallback(KB_PAGE, URL, 'Malmö')!;
        expect(ev.venueName).not.toMatch(/location_on|calendar_today/);
    });

    it('ort ur eventets egen microdata slår defaultCity', () => {
        const ev = cheerioFallback(KB_PAGE, URL, 'Malmö')!;
        expect(ev.city).toBe('Göteborg');
    });

    it('sida utan location-microdata behåller defaultCity', () => {
        const html = '<html><body><main><h1>Event</h1><p>4 september 2026</p></main></body></html>';
        expect(cheerioFallback(html, 'https://example.se/e/1', 'Kalmar')!.city).toBe('Kalmar');
    });

    it('rör inte huvudinnehållet när "relaterat"-rubriken saknas', () => {
        const html = KB_PAGE.replace('Rekommenderade evenemang', 'Om artisten');
        const ev = cheerioFallback(html, URL, 'Malmö')!;
        expect(ev.title).toBe('The Proclaimers');
    });
});

// Stockholm Lives arenasajter (hovetarena.se, aviciiarena.se …) lägger
// insläppet "Entréer öppnar" som FÖRSTA Event-nod i JSON-LD:n och själva
// matchen som andra. Före 2026-09-04 dödade blacklistträffen hela sidan.
const HOVET_PAGE = `<html><head><title>AIK Hockey - Hovet</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"SportsEvent","name":"Entréer öppnar","url":"https://hovetarena.se/evenemang/sport/aik-hockey/","startDate":"2026-09-04T18:00:00+02:00","location":{"@type":"Place","name":"Hovet"}},
 {"@type":"SportsEvent","name":"AIK - Sparta Sarpsborg (Försäsongsmatch)","url":"https://hovetarena.se/evenemang/sport/aik-hockey/","startDate":"2026-09-04T19:00:00+02:00","location":{"@type":"Place","name":"Hovet"},"image":["https://eventadmin.stockholmlive.com/uploads/img/x.jpg"]}
]}</script></head><body><main><h1>AIK Hockey</h1></main></body></html>`;

describe('extractFromHtml — blacklistad JSON-LD-nod diskvalificerar bara sig själv', () => {
    it('hoppar över "Entréer öppnar" och tar matchen som följer', () => {
        const ev = extractFromHtml(HOVET_PAGE, 'https://hovetarena.se/evenemang/sport/aik-hockey/', 'Stockholm')!;
        expect(ev).not.toBeNull();
        expect(ev.title).toBe('AIK - Sparta Sarpsborg (Försäsongsmatch)');
        expect(ev.startDate.toISOString()).toBe('2026-09-04T17:00:00.000Z');
        expect(ev.venueName).toBe('Hovet');
        expect(ev.city).toBe('Stockholm');
    });

    it('sida med ENBART junk-noder ger fortfarande inget event (ingen cheerio-återuppståndelse)', () => {
        const html = `<html><head><title>Kommunen</title>
<script type="application/ld+json">{"@type":"Event","name":"Startsida","url":"https://example.se/","startDate":"2026-09-10"}</script>
</head><body><main><h1>Startsida</h1><p>10 september 2026</p></main></body></html>`;
        expect(extractFromHtml(html, 'https://example.se/', 'Kalmar')).toBeNull();
    });
});

// Nedskalat utsnitt ur Norrköpings Konstmuseums detaljsida (probad 2026-09-11):
// sidans eget datum står bara som text i .calendar-date, och "Mer i
// kalendariet" längre ner är LÄNKKORT (<a class="calendar-item">) med egna
// datum. Rubriken ligger i en annan kolumn än korten. Före fixen fick ~88
// event kortens "fre 11 sep" + sidans egen klocktid.
const NKM_PAGE = `<html><head><title>Augustifesten: Familjedag i Skulpturparken | Evenemang på Norrköpings Konstmuseum</title></head><body>
<div class="fusion-row">
 <div class="fusion-title"><h1 class="fusion-title-heading">Augustifesten: Familjedag i Skulpturparken</h1></div>
 <div class="fusion-text"><p><div class="calendar-date"> lör 15 augusti kl 11:00&#8211;15:00 </div></p></div>
 <div class="fusion-text"><p>Välkommen till en dag i Skulpturparken med workshops och musik.</p></div>
</div>
<div class="fusion-row">
 <div class="fusion-title"><h2>Mer i kalendariet</h2></div>
</div>
<div class="fusion-row calendar-list">
 <a class="calendar-item link-decoration-hover" href="https://www.norrkopingskonstmuseum.se/kalender/fredagsvisning-subterranean-hunger/">
  <img src="https://www.norrkopingskonstmuseum.se/wp-content/uploads/x-150x150.jpg" />
  <div class="calendar-description"><h4><span>Fredagsvisning: Subterranean Hunger – Sara-Vide Ericson</span></h4>
  <span class="calendar-item-date"> fre 11 sep </span></div>
 </a>
 <a class="calendar-item link-decoration-hover" href="https://www.norrkopingskonstmuseum.se/kalender/lordagsvisning/">
  <img src="https://www.norrkopingskonstmuseum.se/wp-content/uploads/y-150x150.jpg" />
  <div class="calendar-description"><h4><span>Lördagsvisning</span></h4>
  <span class="calendar-item-date"> lör 12 sep </span></div>
 </a>
</div>
</body></html>`;

describe('cheerioFallback — "Mer i kalendariet"-korten förgiftar inte sidan', () => {
    const URL = 'https://www.norrkopingskonstmuseum.se/kalender/augustifesten-familjedag/';

    it('tar sidans egna datum (15 augusti kl 11), inte kortens "fre 11 sep"', () => {
        const ev = cheerioFallback(NKM_PAGE, URL, 'Norrköping')!;
        expect(ev.startDate.getMonth()).toBe(7);    // augusti
        expect(ev.startDate.getDate()).toBe(15);
        expect(ev.startDate.getHours()).toBe(11);
    });

    it('titeln är sidans egen, inte ett korts', () => {
        expect(cheerioFallback(NKM_PAGE, URL, 'Norrköping')!.title).toBe('Augustifesten: Familjedag i Skulpturparken');
    });
});

// Andra Konstmuseum-buggen (2026-09-11): gamla "Barnens Konstfredag"-sidor
// ("fre 10 april kl 14:00–16:00" — passerad fredag) kastades rätt av
// veckodagskontrollen, och fritexten tog då en utställningsperiod längre ner
// ("t.o.m. 6 februari 2027") + sidans klocktid → framtida kluster.
describe('dateFromDetailSelector — bara sidans eget datumfält', () => {
    const NOW = new Date(2026, 8, 11, 10, 0);   // fre 11 sep 2026
    const page = (own: string) => `<html><body><h1>Barnens Konstfredag: Grafik</h1>
<div class="calendar-date"> ${own} </div>
<p>Utställningen Healing the Earth pågår t.o.m. 6 februari 2027.</p></body></html>`;

    it('passerad fredag utan årtal → null (hoppas över), inte bannerns 6 februari 2027', () => {
        expect(dateFromDetailSelector(page('fre 10 april kl 14:00&#8211;16:00'), '.calendar-date', NOW)).toBeNull();
    });

    it('fritext-fallbacken hade tagit bannerns datum — det är därför fältet behövs', () => {
        const ev = cheerioFallback(page('fre 10 april kl 14:00&#8211;16:00'), 'https://www.norrkopingskonstmuseum.se/kalender/x/', 'Norrköping');
        expect(ev?.startDate.getFullYear()).toBe(2027);
    });

    it('kommande datum med rätt veckodag + klocktid', () => {
        const r = dateFromDetailSelector(page('fre 25 september kl 14:00&#8211;16:00'), '.calendar-date', NOW)!;
        expect([r.date.getFullYear(), r.date.getMonth(), r.date.getDate(), r.date.getHours()]).toEqual([2026, 8, 25, 14]);
        expect(r.hasTime).toBe(true);
    });

    it('datum utan klocktid → hasTime false', () => {
        expect(dateFromDetailSelector(page('lör 26 september'), '.calendar-date', NOW)!.hasTime).toBe(false);
    });

    it('fältet saknas → null', () => {
        expect(dateFromDetailSelector('<html><body><h1>X</h1><p>26 september</p></body></html>', '.calendar-date', NOW)).toBeNull();
    });
});
