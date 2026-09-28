/**
 * Tester för sitemap-motorns backfillPlaceFromHtml — koordinater ur kart-
 * länkar + ort ur location-scopad microdata. Fixtures är nedskalade utsnitt
 * ur riktiga Tickster-detaljsidor (probade 2026-07-02).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { backfillPlaceFromHtml, extractCatalogDates, cheerioFallback, extractFromHtml, dateFromDetailSelector, startInsteadOfEnd, applyTitlePlaces, extractJsonCatalogUrls, descFromDetailSelector } from './sitemap';
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
    // Pinna klockan: findFirstDateInText hoppar över datum som är IDAG
    // (build-datum-skyddet), så testet gick rött just 2026-09-25 när
    // verkligheten hann ikapp Fårets Dagar-fixturens startdatum.
    beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 7, 31, 10, 0)); });
    afterAll(() => { vi.useRealTimers(); });

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

// Utsnitt ur havremagasinet.se/program/ (28/9): ett kort per TILLFÄLLE i
// kronologisk ordning; stängningskortet länkar till vernissagen.
const HAVRE_PROGRAM = `
<article class="h-grid-card"><a href="https://havremagasinet.se/event/vernissage-10-okt/"><h2>23 SEP - 9 OKT</h2><p>STÄNGT för omhängning</p></a></article>
<article class="h-grid-card"><a href="https://havremagasinet.se/event/skapa-pa-havre/"><h2>28 SEP</h2></a></article>
<article class="h-grid-card"><a href="https://havremagasinet.se/event/skapa-pa-havre/"><h2>5 OKT</h2></a></article>
<article class="h-grid-card"><a href="https://havremagasinet.se/event/vernissage-10-okt/"><h2>10 OKT</h2></a></article>
<article class="h-grid-card"><a href="https://havremagasinet.se/event/hostlov/"><h2>27 - 29 OKT</h2></a></article>
<article class="h-grid-card"><a href="https://havremagasinet.se/event/skapa-pa-havre/"><h2>14 DEC</h2></a></article>`;

describe('extractCatalogDates — kalender med ett kort per tillfälle', () => {
    beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 28, 10, 0)); });
    afterAll(() => { vi.useRealTimers(); });
    const SEL = { itemSelector: 'article.h-grid-card', linkSelector: 'a', dateSelector: 'h2' };
    const md = (d?: Date) => d && [d.getFullYear(), d.getMonth() + 1, d.getDate()];

    it('återkommande aktivitet → första kommande tillfället, inte sista', () => {
        const m = extractCatalogDates(HAVRE_PROGRAM, 'https://havremagasinet.se/program/', SEL);
        expect(md(m.get('https://havremagasinet.se/event/skapa-pa-havre'))).toEqual([2026, 9, 28]);
    });

    it('intervallkort ger STARTdagen — passerad start ger plats åt nästa kort', () => {
        const m = extractCatalogDates(HAVRE_PROGRAM, 'https://havremagasinet.se/program/', SEL);
        expect(md(m.get('https://havremagasinet.se/event/hostlov'))).toEqual([2026, 10, 27]);
        // "23 SEP - 9 OKT" (stängt) gav förr slutdagen 9 okt åt vernissagen.
        expect(md(m.get('https://havremagasinet.se/event/vernissage-10-okt'))).toEqual([2026, 10, 10]);
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

    // cheerioFallback läser `new Date()` internt (ingen injicerbar NOW) och
    // årsgissningen/veckodagskontrollen beror på dagens datum. Fixturens
    // "15 augusti" resp. "fre 11 sep" måste bedömas mot SAMMA nu som när
    // fixturen skrevs (11 sep 2026, precis som systerblocket nedan) — annars
    // blir testet en tidsbomb som slår rött när båda datumen glidit förbi.
    beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 11, 10, 0)); });
    afterAll(() => { vi.useRealTimers(); });

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

    // Malmö Arena 13/9: datumet ligger månad-FÖRST i tre divar
    // (januari / 30 / Kl 14:30) — texten blir "januari 30 Kl 14:30".
    it('månad-först ("januari 30 Kl 14:30") vänds och parsas', () => {
        const html = `<div class="event-single-view__datecost-container"><div><div>januari</div>
<div class="event-single-view__datecost-big">30</div><div>Kl 14:30</div></div></div>`;
        const r = dateFromDetailSelector(html, '.event-single-view__datecost-container', NOW)!;
        expect([r.date.getFullYear(), r.date.getMonth(), r.date.getDate(), r.date.getHours(), r.date.getMinutes()]).toEqual([2027, 0, 30, 14, 30]);
        expect(r.hasTime).toBe(true);
    });

    // Spritmuseum 28/9: dag-först följt av klockslag vändes till "24 17
    // oktober.00" → 17 oktober. Månad-först-vändningen får inte röra det.
    it('dag-först + klockslag ("24 oktober 17.00") vänds INTE', () => {
        const html = `<ul class="article-header_list-info"><li><em>750 sek (entré ingår)</em></li>
<li><em>24 oktober 17.00</em></li></ul>`;
        const r = dateFromDetailSelector(html, '.article-header_list-info', NOW)!;
        expect([r.date.getMonth(), r.date.getDate(), r.date.getHours()]).toEqual([9, 24, 17]);
    });

    it('månad-först följt av klockslag ("oktober 17.00") är inget datum', () => {
        expect(dateFromDetailSelector('<div class="d">oktober 17.00</div>', '.d', NOW)).toBeNull();
    });

    // Malmö Live 28/9: "Ons 29 Apr 20:00" är redan svensk ordning — vändningen
    // gjorde "Ons 29 20 Apr:00" (null) och "Ons 20 Maj 19:00" → 19 maj.
    it('dag FÖRE månaden + klockslag vänds inte', () => {
        const at = (t: string) => dateFromDetailSelector(`<span class="d">${t}</span>`, '.d', NOW)!;
        const a = at('Lör 3 Okt 18:00');
        expect([a.date.getFullYear(), a.date.getMonth(), a.date.getDate(), a.date.getHours()]).toEqual([2026, 9, 3, 18]);
        expect(a.hasTime).toBe(true);
        const b = at('Tors 20 Maj 19:00');
        expect([b.date.getFullYear(), b.date.getMonth(), b.date.getDate(), b.date.getHours()]).toEqual([2027, 4, 20, 19]);
        const c = at('Fre 20 november 19:30');
        expect([c.date.getMonth(), c.date.getDate(), c.date.getHours(), c.date.getMinutes()]).toEqual([10, 20, 19, 30]);
    });

    it('första KOMMANDE föreställning via :has-selektor (passerade märkta)', () => {
        const html = `<div class="event--dates">
<div class="event--date"><span class="event--date--detail">Ons 9 Sep 19:00</span><span class="event--passed">Passerat</span></div>
<div class="event--date"><span class="event--date--detail">Lör 3 Okt 18:00</span></div>
<div class="event--date"><span class="event--date--detail">Sön 4 Okt 15:00</span></div></div>`;
        const r = dateFromDetailSelector(html, '.event--date:not(:has(.event--passed)) .event--date--detail', NOW)!;
        expect([r.date.getMonth(), r.date.getDate(), r.date.getHours()]).toEqual([9, 3, 18]);
        const allPassed = html.replace(/<span class="event--date--detail">(?:Lör|Sön)[^<]*<\/span>/g, '');
        expect(dateFromDetailSelector(allPassed, '.event--date:not(:has(.event--passed)) .event--date--detail', NOW)).toBeNull();
    });

    it('månad-först med flera föreställningar — första vinner', () => {
        const html = `<div class="dc"><div><div>oktober</div><div>30</div><div>Kl 19:30</div></div>
<div><div>oktober</div><div>31</div><div>Kl 15:00</div></div></div>`;
        const r = dateFromDetailSelector(html, '.dc', NOW)!;
        expect([r.date.getMonth(), r.date.getDate(), r.date.getHours()]).toEqual([9, 30, 19]);
    });
});

describe('Växjö-sluttiden: SiteVision-props skriver endDate före startDate', () => {
    // Nedskalat ur upplev.vaxjo.se (Tengstrandfestivalen 5/10, 19.00-20.00).
    // Sidans ld+json är inte schema.org → cheerioFallback, vars textskanning
    // tar med <script> och hittade endDate först.
    const PAGE = `<html><head><title>Tengstrandfestivalen: Staffan Mårtensson - Växjös officiella upplevelseguide</title></head>
<body><main><h1>Tengstrandfestivalen: Staffan Mårtensson</h1>
<script>AppRegistry.registerInitialState('12.x',{"next":{"date":"5","endDate":"2027-10-05T20:00","city":"Växjö","startTime":"19.00","endTime":"20.00","place":"Nygatan 6","startDate":"2027-10-05T19:00","title":"Tengstrandfestivalen: Staffan Mårtensson"}});</script>
</main></body></html>`;

    it('eventet får starttiden, inte sluttiden', () => {
        const ev = cheerioFallback(PAGE, 'https://upplev.vaxjo.se/evenemang/evenemang/2026-08-19-x', 'Växjö')!;
        const s = ev.startDate;
        expect([s.getMonth(), s.getDate(), s.getHours(), s.getMinutes()]).toEqual([9, 5, 19, 0]);
    });

    it('rör inte ett datum som inte är ett endDate', () => {
        const picked = new Date('2027-10-05T19:00');
        expect(startInsteadOfEnd(PAGE, picked)).toBe(picked);
    });

    it('byter aldrig till en annan dags startDate (relaterade evenemang)', () => {
        const html = '{"endDate":"2027-10-05T20:00"} {"startDate":"2027-10-04T18:00"}';
        const picked = new Date('2027-10-05T20:00');
        expect(startInsteadOfEnd(html, picked)).toBe(picked);
    });
});

describe('cheerioFallback - titel med eget bindestreck slår logga-h1:an', () => {
    // upplev.vaxjo.se 28/9: första h1 är loggan, sidtiteln har bindestreck i
    // själva eventnamnet → 19 event hette "Upplev Växjö".
    const PAGE = `<html><head><title>Kicki i Soläng – en helt vanlig person från Småland - Växjös officiella upplevelseguide</title>
<meta property="og:title" content="Kicki i Soläng – en helt vanlig person från Småland"></head>
<body><header><h1> <b>Upplev Växjö</b> </h1></header>
<main><h1>Kicki i Soläng – en helt vanlig person från Småland</h1><p>30 september 2027 kl 18.00</p></main></body></html>`;

    it('eventets h1 vinner, inte sajtloggan', () => {
        const ev = cheerioFallback(PAGE, 'https://upplev.vaxjo.se/evenemang/evenemang/2026-08-27-kicki', 'Växjö')!;
        expect(ev.title).toBe('Kicki i Soläng – en helt vanlig person från Småland');
    });
});

// Visit Isabergsregionen 28/9: sidorna saknar location-markup och allt landade
// på Gislaveds centroid — även Torghusets event i Smålandsstenar.
describe('applyTitlePlaces', () => {
    const rules = [
        { re: /torghuset/i, city: 'Smålandsstenar', venue: 'Torghuset Smålandsstenar' },
        { re: /smålandsstenar/i, city: 'Smålandsstenar' },
        { re: /anderstorp/i, city: 'Anderstorp' },
    ];
    const ev = (title: string, extra: Record<string, unknown> = {}) =>
        ({ title, url: 'https://x.se/e', startDate: new Date(), city: 'Gislaved', ...extra }) as any;

    it('Torghuset → Smålandsstenar med regelns venue', () => {
        const e = ev('Soppbio, Torghuset Smålandsstenar');
        applyTitlePlaces(e, rules, 'Gislaved');
        expect(e.city).toBe('Smålandsstenar');
        expect(e.venueName).toBe('Torghuset Smålandsstenar');
    });

    it('venue ur titelns komma-suffix när regeln saknar venue', () => {
        const e = ev('Näverworkshop, Anderstorps bibliotek');
        applyTitlePlaces(e, rules, 'Gislaved');
        expect(e.city).toBe('Anderstorp');
        expect(e.venueName).toBe('Anderstorps bibliotek');
    });

    it('suffix som bara är orten → city men ingen venue', () => {
        const e = ev('Berättelsen om Fornbolmen, Smålandsstenar');
        applyTitlePlaces(e, rules, 'Gislaved');
        expect(e.city).toBe('Smålandsstenar');
        expect(e.venueName).toBeUndefined();
    });

    it('ort i löptext utan komma → bara city', () => {
        const e = ev('Jobbmässa i Smålandsstenar');
        applyTitlePlaces(e, rules, 'Gislaved');
        expect(e.city).toBe('Smålandsstenar');
        expect(e.venueName).toBeUndefined();
    });

    it('rör inte sidans egen ort eller venue', () => {
        const own = ev('Soppbio på Torghuset', { city: 'Värnamo' });
        applyTitlePlaces(own, rules, 'Gislaved');
        expect(own.city).toBe('Värnamo');
        const venue = ev('Konsert, Smålandsstenar', { venueName: 'Kyrkan' });
        applyTitlePlaces(venue, rules, 'Gislaved');
        expect(venue.venueName).toBe('Kyrkan');
        expect(venue.city).toBe('Smålandsstenar');
    });

    it('ort ur sidans venue när titeln saknar ort', () => {
        const e = ev('Konsert med kören', { venueName: 'Anderstorps kyrka' });
        applyTitlePlaces(e, rules, 'Gislaved');
        expect(e.city).toBe('Anderstorp');
        expect(e.venueName).toBe('Anderstorps kyrka');
    });

    it('ingen träff → oförändrat', () => {
        const e = ev('Hur redo är du?, Torget i Gislaved');
        applyTitlePlaces(e, rules, 'Gislaved');
        expect(e.city).toBe('Gislaved');
        expect(e.venueName).toBeUndefined();
    });
});

// Visit Isabergsregionen 28/9: nya sajtens datumfält är "26-10-02 12:30 - 15:00".
describe('dateFromDetailSelector - numeriskt ÅÅ-MM-DD', () => {
    const now = new Date('2026-09-28T12:00:00');
    const at = (t: string) => dateFromDetailSelector(`<div class="d">${t}</div>`, '.d', now);

    it('ÅÅ-MM-DD med klockslag → rätt dag och tid', () => {
        const r = at('26-10-02 <div class="time">12:30 - 15:00</div>')!;
        expect([r.date.getFullYear(), r.date.getMonth(), r.date.getDate(), r.date.getHours(), r.date.getMinutes()]).toEqual([2026, 9, 2, 12, 30]);
        expect(r.hasTime).toBe(true);
    });

    it('start–slut utan tid → startdagen, ingen tid', () => {
        const r = at('26-10-21 26-10-22')!;
        expect([r.date.getMonth(), r.date.getDate()]).toEqual([9, 21]);
        expect(r.hasTime).toBe(false);
    });

    it('ÅÅÅÅ-MM-DD fungerar också; ogiltig månad rörs inte', () => {
        expect(at('2026-11-07')!.date.getDate()).toBe(7);
        expect(at('26-13-02')).toBeNull();
    });
});

describe('cheerioFallback - reservdatum ur datumfältet', () => {
    const html = '<html><head><title>Den stora schlagerfesten</title></head><body><h1>Den stora schlagerfesten</h1><p>En glittrande kavalkad.</p></body></html>';
    it('utan löptextdatum → null, med reservdatum → event', () => {
        expect(cheerioFallback(html, 'https://x.se/e')).toBeNull();
        const d = new Date('2026-11-07T00:00:00');
        const ev = cheerioFallback(html, 'https://x.se/e', 'Gislaved', d);
        expect(ev?.title).toBe('Den stora schlagerfesten');
        expect(ev?.startDate.getTime()).toBe(d.getTime());
    });
});

// Utsnitt ur bastad.com/evenemangskalender (Statamic, probad 2026-09-28): hela
// kalendern ligger som JS-array med json_encode-escapade snedstreck.
describe('extractJsonCatalogUrls - JSON-escapade snedstreck', () => {
    const js = `var BASTAD_EVENTS = [
    { id: "e878", title: "KULTURNATT i B\\u00e5stad", date: "2026-10-10",
      listBookingUrl: null, url: "\\/events\\/kulturnatt-i-bastad",
      image: "/assets/kulturnatten.jpg" },
    ];
    var SEARCH = [{ type: 'event', url: "https:\\/\\/bastad.com\\/events\\/kulturnatt-i-bastad" },
                  { type: 'event', url: "https:\\/\\/bastad.com\\/events\\/oppen-atelje3" }];`;
    const urls = extractJsonCatalogUrls(js, 'https://bastad.com/evenemangskalender').map(e => e.url);

    it('avkodar \\/ och löser relativa paths mot katalogens origin', () => {
        expect(urls).toContain('https://bastad.com/events/kulturnatt-i-bastad');
        expect(urls).toContain('https://bastad.com/events/oppen-atelje3');
        expect(urls).toContain('https://bastad.com/assets/kulturnatten.jpg');
    });

    it('relativ + absolut form av samma URL slås ihop', () => {
        expect(urls.filter(u => u.endsWith('/kulturnatt-i-bastad'))).toHaveLength(1);
    });

    it('vanlig JSON utan escapning fungerar som förut (Studiefrämjandet-formen)', () => {
        const r = extractJsonCatalogUrls('{"hits":[{"url":"/kurser/a-b-c"},{"u":"https://x.se/y/z"}]}', 'https://x.se/sok');
        expect(r.map(e => e.url)).toEqual(['https://x.se/kurser/a-b-c', 'https://x.se/y/z']);
    });
});

// Utsnitt ur bastad.com/events/kulturnatt-i-bastad (28/9): meta-description är
// sajtvid, den riktiga texten ligger i .article-body med <br />-radbrytningar.
describe('descFromDetailSelector', () => {
    const html = `<html><head><meta name="description" content="Allt om Båstad - besöksmål, evenemang, leder, boende och näringsliv på Bjärehalvön."></head><body>
        <h2>KULTURNATT i Båstad</h2>
        <div class="article-body">KULTURNATT i Båstad är en kväll där konst, musik &amp; kultur får ta plats!<br />
<br />
Programmet hittar du på vår hemsida.</div></body></html>`;

    it('tar brödtexten, <br> blir mellanslag, entiteter avkodas', () => {
        expect(descFromDetailSelector(html, '.article-body'))
            .toBe('KULTURNATT i Båstad är en kväll där konst, musik & kultur får ta plats! Programmet hittar du på vår hemsida.');
    });

    it('saknat eller för kort fält → null (meta-beskrivningen behålls)', () => {
        expect(descFromDetailSelector(html, '.finns-inte')).toBeNull();
        expect(descFromDetailSelector('<div class="b">Kort.</div>', '.b')).toBeNull();
    });
});
