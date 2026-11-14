import { describe, it, expect } from 'vitest';
import { priceFromMarkup, readMarkupPrice, priceFromJsonLd, priceFromLabelledLines, priceFromBareLines, markupLines } from './priceFromMarkup';

/** Slår in ett utsnitt i en sida som är lång nog att räknas som detaljsida. */
const page = (body: string, head = ''): string =>
    `<!doctype html><html><head><title>Evenemang</title>${head}</head><body><main><h1>Ett evenemang</h1>`
    + `<p>${'Välkommen till en kväll med musik och samtal. '.repeat(6)}</p>${body}</main></body></html>`;

describe('priceFromMarkup — faktarutans etiketterade rader (riktig markup från källorna)', () => {
    it('dt/dd: Ljungby, ABF, Norrtälje, Hedemora', () => {
        expect(priceFromMarkup(page('<dl><dt class="app-13vtstx">Pris</dt> <dd class="app-13vtstx">365 kr/st</dd><dt class="app-13vtstx">Arrangör</dt> <dd class="app-13vtstx">Tobbe Blom</dd></dl>'))).toBe('365 kr');
        expect(priceFromMarkup(page('<dl><dt>Pris</dt><dd>från 99 kr</dd><dt>Arrangör</dt><dd>IF Troja-Ljungby</dd></dl>'))).toBe('från 99 kr');
        expect(priceFromMarkup(page('<div><dt class="HeroBlock-CourseInfo-Heading">Pris</dt> <dd class="HeroBlock-CourseInfo-Text"> Gratis </dd> </div> <div> <dt class="HeroBlock-CourseInfo-Heading">Typ</dt> <dd>Evenemang</dd></div>'))).toBe('Gratis');
        expect(priceFromMarkup(page('<dl><div><dt>Kostnad:</dt> <dd>150 SEK</dd> </div> </dl>'))).toBe('150 kr');
        expect(priceFromMarkup(page('<dl><div><dt>Kostnad:</dt> <dd>Kostnadsfri</dd> </div> </dl>'))).toBe('Gratis');
        expect(priceFromMarkup(page('<div><dt class="font-bold inline"> Priser: </dt> <dd class="inline"> Barn 50 kr, Vuxna 100 kr </dd> </div> <div> <dt class="font-bold inline"> Tider: </dt><dd>10-16</dd></div>'))).toBe('50–100 kr');
    });

    it('nyckel/värde i syskon-div:ar: Studiefrämjandet, Gävle', () => {
        expect(priceFromMarkup(page('<li><div class="c-articlemeta__list__item__key">Pris</div> <div class="c-articlemeta__list__item__value" id="priceItem"> 200 kr </div> </li>'))).toBe('200 kr');
        expect(priceFromMarkup(page('<div class="item"><div class="item-key"><span>Kostnad</span> </div> <div class="item-value-list"> <div class="item-value"> Gratis </div> </div> </div>'))).toBe('Gratis');
    });

    it('dold etikett + ikon + stycke: Göteborgs Stad', () => {
        expect(priceFromMarkup(page('<div><span class="t-visually-hidden">Arrangör</span><span class="rc-icon" aria-hidden="true"></span><p>Kyrkbyns bibliotek</p></div><div><span class="t-visually-hidden">Kostnad</span><span data-testid="rc-icon" class="rc-icon rc-icon--small" aria-hidden="true"></span><p>Gratis</p></div>'))).toBe('Gratis');
    });

    it('etikett och värde på samma rad: Hallstahammar, Kalmar, Höganäs, Varberg, Östersund', () => {
        expect(priceFromMarkup(page('<li><p class="hiq-p"> <strong>Pris:</strong> 90 Kr </p></li><li><p><strong>Plats:</strong> Sagabiografen</p></li>'))).toBe('90 kr');
        expect(priceFromMarkup(page('<p><strong>Pris:</strong> Ingen kostnad. Fri entré. Gratis. </p>'))).toBe('Gratis');
        expect(priceFromMarkup(page('<div class="sol-event-info-field"> Pris: från 540 kr. </div> <a href="https://exempel.se/boka">BOKA HÄR</a>'))).toBe('från 540 kr');
        expect(priceFromMarkup(page('<div class="sol-event-info-field"> Pris: Kostnadsfritt att besöka </div>'))).toBe('Gratis');
        expect(priceFromMarkup(page('<p> Ålder: Barntillåten </p> <p> Pris: 30 kr </p>'))).toBe('30 kr');
        expect(priceFromMarkup(page('<p>Längd: ca 2 tim och 30 min inkl. paus</p> <p>Pris: fr 760 kr<br />Biljetter via Tickster.com</p>'))).toBe('från 760 kr');
        expect(priceFromMarkup(page('<p>Pris &amp; anmälan: Kostnadsfritt, ingen föranmälan behövs</p>'))).toBe('Gratis');
    });

    it('valutan i ett eget element: Skellefteå', () => {
        expect(priceFromMarkup(page('<h1><span class="h3">Pris:</span> <strong>499</strong> <span class="h3">sek</span></h1>'))).toBe('499 kr');
    });

    it('rubrik + pristabell: Västervik, Riksteatern, Eslöv', () => {
        expect(priceFromMarkup(page('<div><h3>Pris</h3> </div> <div class="secondary-card__info"> <div class="pricing-table"><p>Vuxen: 100 kr</p><p> Barn t.o.m 12 år: Gratis</p></div> </div>'))).toBe('100 kr');
        expect(priceFromMarkup(page('<div class="biljettinfo"> <span>Om biljetter</span> <p>Ordinarie: 195 kr&#xD;&#xA;Scenpass/pension&#xE4;r: 175 kr&#xD;&#xA;Studerande/under 26: 155 kr</p> </div>'))).toBe('155–195 kr');
        expect(priceFromMarkup(page('<h2>Biljetter &amp; bokning</h2><p>Standard/Vuxen: 50 kr</p><h2>Länkar</h2>'))).toBe('50 kr');
        expect(priceFromMarkup(page('<table><tr><th>Biljettyp</th><th>Pris</th></tr><tr><td>Ordinarie</td><td>595-795:-</td></tr></table><p>Alla priser är inkl. serviceavgift</p>'))).toBe('595–795 kr');
        expect(priceFromMarkup(page('<h3>Priser</h3><p>Vuxen: 120 kr</p><p>Barn: 60 kr</p><p>Familj: 300 kr</p><p>Varmt välkomna</p>'))).toBe('60–300 kr');
    });

    it('ja/nej-fält och rubrik med värdet under: Bollnäs, Järfälla', () => {
        expect(priceFromMarkup(page('<ul><li><strong>Fri entré</strong> <span>Ja</span></li><li><strong>Arrangör</strong> <span>Kulturkvarteret</span></li></ul>'))).toBe('Gratis');
        expect(priceFromMarkup(page('<ul><li><strong>Fri entré</strong> <span>Nej</span></li></ul>'))).toBeUndefined();
        expect(priceFromMarkup(page('<ul><li><strong>Biljettinformation</strong> <span>50 kr per tillfälle. Swishas på plats.</span></li></ul>'))).toBeUndefined();
        expect(priceFromMarkup(page('<div><strong>Biljettinformation</strong></div><div>50 kr per tillfälle. Swishas på plats.</div>'))).toBe('50 kr');
        expect(priceFromMarkup(page('<div class="mt-4"> <p class="h5 mb-0">Kostnad och information om anmälan</p> <p>Kostnadsfritt</p> </div> <div class="mt-4"> <p class="h5 mb-0">Arrangör</p> <span>Huset på höjden</span> </div>'))).toBe('Gratis');
    });

    it('prisfältets alla meningar hör till priset: Österåker, Riksteatern', () => {
        expect(priceFromMarkup(page('<p><strong>Pris:</strong> 250 kronor för medlemmar. Ordinarie pris 300 kronor.</p>'))).toBe('250–300 kr');
        expect(priceFromMarkup(page('<div class="biljettinfo"> <span>Om biljetter</span> <p>Medlemspriser: 316/268/120 kr. Ordinarie: 395/335/150 kr</p> </div>'))).toBe('120–395 kr');
        expect(priceFromMarkup(page('<p>Biljettpris: 495 sek + Service</p>'))).toBe('495 kr');
        expect(priceFromMarkup(page('<dl><dt>Pris</dt><dd>0</dd></dl>'))).toBe('Gratis');
        // Första meningen avgör gratis; det som kostar efteråt är tillägg.
        expect(priceFromMarkup(page('<p>Pris: Fri entré. Lunch 95 kr.</p>'))).toBe('Gratis');
        // Datum i prisfältet är inga belopp.
        expect(priceFromMarkup(page('<p>Pris: 100 kr t.o.m 24/12, därefter 150 kr</p>'))).toBe('100 kr');
    });

    it('avgiftssvansen fäller inte priset', () => {
        expect(priceFromMarkup(page('<div>Läs mer om kvällen via evenemangslänken.<br /> <br /> Pris: 495 kr + serviceavgift<br /> Biljetter via bokningslänken.</div>'))).toBe('495 kr');
    });
});

describe('priceFromMarkup — precision: hellre tomt än fel', () => {
    it('belopp i löptext utan etikett först på raden räknas inte', () => {
        expect(priceFromMarkup(page('<p>För allas trivsel ska ytterkläder hängas in i garderoben. Pris: 30 kr betalas med Swish.</p>'))).toBeUndefined();
        expect(priceFromMarkup(page('<p>Kaffe till självkostnadspris.</p><p>50kr i medlemsavgift</p>'))).toBeUndefined();
        expect(priceFromMarkup(page('<p>Garderoben kostar 30 kr per plagg.</p>'))).toBeUndefined();
    });

    it('oeniga prisuppgifter ger inget: Helsingborg Arenas paket är inte showens pris', () => {
        // Riktig struktur 14/11: biljettrutan utan etikett, paketen med "Pris:".
        const arena = page(
            '<div><p>395 kr - 725 kr</p><ul><li>Ordinarie 725 kr</li><li>Rullstol 725 kr</li><li>Barn/Ungdom - upp till 16 år 395 kr</li></ul></div>'
            + '<div><p>395 kr - 725 kr</p></div>'
            + '<h3>Bästa showupplevelsen får du från terrassen</h3><p>Pris: 1300 kronor/person. Priset avser showbiljett på terrassen och mat.</p>'
            + '<h3>Kombinera er showbiljett med ett besök i Arenans restaurang</h3><p>Pris: 575 kronor/person. Priset avser endast julbuffé, showbiljett köpes separat.</p>');
        expect(priceFromLabelledLines(markupLines(arena))).toBeUndefined();
        expect(priceFromMarkup(arena)).toBe('395–725 kr');
        expect(readMarkupPrice(arena).via).toBe('prisrad');
        // Gratis mot belopp är också oenigt.
        expect(priceFromMarkup(page('<p>Pris: Gratis</p><p>Entré: 120 kr</p>'))).toBeUndefined();
    });

    it('tilläggets pris är inte eventets, även när det står ensamt', () => {
        expect(priceFromMarkup(page('<p>Pris: 345 kronor/person. Priset avser endast konsertbuffé, showbiljett köpes separat.</p>'))).toBeUndefined();
        expect(priceFromMarkup(page('<p>Pris: 1260 kronor/person plus serviceavgift 70 kronor/bord. Priset avser showbiljett på terrassen och mat.</p>'))).toBeUndefined();
        // … men biljettrutans egen prisrad på samma sida gäller.
        expect(priceFromMarkup(page('<p>395 kr - 725 kr</p><p>Pris: 345 kronor/person. Priset avser endast konsertbuffé, showbiljett köpes separat.</p>'))).toBe('395–725 kr');
    });

    it('samma pris skrivet två gånger är överens, och intervall som går ihop likaså', () => {
        expect(priceFromMarkup(page('<p>Pris: 250 kr</p><div class="mobile"><p>Pris: 250 kr</p></div>'))).toBe('250 kr');
        expect(priceFromMarkup(page('<p>Pris: från 150 kr</p><dl><dt>Biljettpris</dt><dd>150–250 kr</dd></dl>'))).toBe('från 150 kr');
    });

    it('ensam prisrad utan etikett: bara när sidans alla prisrader säger samma sak', () => {
        expect(priceFromMarkup(page('<p>Köp biljett</p><p>320 kr</p>'))).toBe('320 kr');
        expect(priceFromMarkup(page('<p>från 150 kr</p>'))).toBe('från 150 kr');
        expect(priceFromMarkup(page('<p>595-795:-</p>'))).toBe('595–795 kr');
        // Andra evenemangs kort bär egna belopp — då är inget säkert.
        expect(priceFromMarkup(page('<p>320 kr</p><ul><li><h4>Annan konsert</h4><p>250 kr</p></li></ul>'))).toBeUndefined();
        expect(priceFromBareLines(['2026', '16:00', '0 kr'])).toBeUndefined();
    });

    it('etikett utan pris under sig ger inget', () => {
        expect(priceFromMarkup(page('<h3>Priser</h3><p>Köp biljett</p><p>Köp biljett</p><p>Boka pausmeny</p>'))).toBeUndefined();
        expect(priceFromMarkup(page('<dl><dt>Pris</dt><dd>Se arrangörens webbplats</dd><dt>Entré</dt><dd>Storgatan 5</dd></dl>'))).toBeUndefined();
        expect(priceFromMarkup(page('<p>Entré via Storgatan 5, hiss finns.</p>'))).toBeUndefined();
    });

    it('nästa fält läcker inte in i priset', () => {
        expect(priceFromMarkup(page('<dl><dt>Pris</dt><dd>100 kr</dd><dt>Garderob</dt><dd>30 kr</dd></dl>'))).toBe('100 kr');
        expect(priceFromMarkup(page('<dl><dt>Pris</dt><dd></dd><dt>Kostnad</dt><dd>75 kr</dd></dl>'))).toBe('75 kr');
    });

    it('villkorad gratis är inte eventets pris', () => {
        expect(priceFromMarkup(page('<dl><dt>Pris</dt><dd>Gratis för medlemmar</dd></dl>'))).toBeUndefined();
        // Livrustkammaren: åldersgränsen står sist i meningen.
        expect(priceFromMarkup(page('<p>Pris: Fri entré för alla riddare, prinsar och prinsessor under 18 år.</p>'))).toBeUndefined();
        expect(priceFromMarkup(page('<p>Pris: Barn 50 kronor. Vuxen 180 kronor. Entré till museet ingår.</p>'))).toBe('50–180 kr');
        expect(priceFromMarkup(page('<p>Entré: 80 kr. Under 20 år gratis.</p>'))).toBe('80 kr');
    });

    it('navigering, sidfot och andra evenemang läses inte', () => {
        expect(priceFromMarkup(page('<nav><ul><li>Priser</li><li>Entré: 120 kr</li></ul></nav>'))).toBeUndefined();
        expect(priceFromMarkup(page('</main><footer><p>Pris: 50 kr</p></footer><main>'))).toBeUndefined();
        expect(priceFromMarkup(page('<section class="related-events"><article><h3>Annan konsert</h3><p>Pris: 250 kr</p></article></section>'))).toBeUndefined();
        expect(priceFromMarkup(page('<div id="AndraevenemangSkript"><p>Pris: 250 kr</p></div>'))).toBeUndefined();
    });

    it('allt efter "Liknande kurser" hör till andra event (ABF 14/11)', () => {
        // Riktig struktur: egen faktaruta, sedan kort med andra evenemangs priser.
        const related = '<h2 class="heading-md">Liknande kurser</h2>'
            + '<article><h3>Musik med Haga-Lennart</h3><p>Plats: Stala Bygdegård</p><p>Pris: Gratis</p></article>'
            + '<article><h3>Musik med Trebello</h3><p>Plats: Ellösparken Orust</p><p>Pris: Gratis</p></article>';
        const own = '<dl><dt>Plats</dt><dd>ÖGAT, Götaholmsgatan 22 Göteborg</dd><dt>Pris</dt><dd>150:-</dd><dt>Typ</dt><dd>Evenemang</dd></dl>';
        expect(readMarkupPrice(page(own + related))).toMatchObject({ price: '150 kr', via: 'etikett' });
        // Utan eget pris får kortens "Gratis" inte bli eventets.
        expect(priceFromMarkup(page('<dl><dt>Plats</dt><dd>ÖGAT</dd></dl>' + related))).toBeUndefined();
        expect(priceFromMarkup(page('<p>Mer information kommer.</p><h3>Fler evenemang</h3><ul><li>Konsert<br>250 kr</li></ul>'))).toBeUndefined();
        // "Fler datum" är samma event, och en länk före sidans h1 är sidhuvudet.
        expect(priceFromMarkup(page('<h3>Fler datum</h3><p>Pris: 90 kr</p>'))).toBe('90 kr');
        const header = '<!doctype html><html><head><title>Evenemang</title></head><body><div class="top"><a href="/kalender">Fler evenemang</a></div>'
            + `<main><h1>Höstkonsert</h1><p>${'Välkommen till en kväll med musik. '.repeat(8)}</p><p>Pris: 90 kr</p></main></body></html>`;
        expect(priceFromMarkup(header)).toBe('90 kr');
    });

    it('ensamt gratismärke bara när sidan har exakt ett', () => {
        expect(priceFromMarkup(page('<div class="badge--free_entry badge-container"> <p>Fri entré</p> </div>'))).toBe('Gratis');
        expect(priceFromMarkup(page('<span class="event-date-panel__admission-label">Gratis inträde</span>'))).toBe('Gratis');
        expect(priceFromMarkup(page('<p>Fri entré</p><ul><li><h4>Guidad tur</h4><p>Fri entré</p></li><li><h4>Kryssning</h4><p>Fri entré</p></li></ul>'))).toBeUndefined();
        // "Gratis" ensamt är för ofta ett filter eller en kategori ("Barn och familj | Gratis | Sport").
        expect(priceFromMarkup(page('<ul><li>Barn och familj</li><li>Gratis</li><li>Sport</li></ul>'))).toBeUndefined();
    });

    it('tom eller för kort sida', () => {
        expect(priceFromMarkup('')).toBeUndefined();
        expect(priceFromMarkup(null)).toBeUndefined();
        expect(priceFromMarkup('<p>Pris: 50 kr</p>')).toBeUndefined();
    });
});

describe('priceFromJsonLd', () => {
    const ld = (obj: unknown): string => page('', `<script type="application/ld+json">${JSON.stringify(obj)}</script>`);

    it('offers med priceSpecification-lista (Eslöv)', () => {
        const html = ld({
            '@context': 'https://schema.org', '@type': 'Event', name: 'Bland väringar',
            offers: [{ '@type': 'Offer', name: 'Standard/Vuxen', priceSpecification: [{ '@type': 'PriceSpecification', maxPrice: 50, minPrice: 50, price: 50, priceCurrency: 'SEK' }] }],
        });
        expect(priceFromJsonLd(html)).toEqual({ price: '50 kr' });
        expect(priceFromMarkup(html)).toBe('50 kr');
    });

    it('AggregateOffer ger intervall, noll ger Gratis', () => {
        expect(priceFromJsonLd(ld({ '@type': 'MusicEvent', offers: { '@type': 'AggregateOffer', lowPrice: '195', highPrice: '395', priceCurrency: 'SEK' } }))).toEqual({ price: '195–395 kr' });
        expect(priceFromJsonLd(ld({ '@type': 'Event', offers: { price: '0', priceCurrency: 'SEK' } }))).toEqual({ price: 'Gratis' });
        // Eventbrite: avgiftspåslaget ger ören — hela kronor på kortet.
        expect(priceFromJsonLd(ld({ '@type': 'Event', offers: { '@type': 'AggregateOffer', lowPrice: 0, highPrice: 662.44, priceCurrency: 'SEK' } }))).toEqual({ price: '0–662 kr' });
    });

    it('isAccessibleForFree ensam: bara med trustFreeFlag (Hörby sätter true på allt)', () => {
        const free = ld({ '@type': 'Event', name: 'KHC på storbild', isAccessibleForFree: true });
        const paid = ld({ '@type': 'Event', name: 'Christmas Night', isAccessibleForFree: false });
        expect(priceFromMarkup(free)).toBeUndefined();
        expect(priceFromMarkup(free, { trustFreeFlag: true })).toBe('Gratis');
        expect(priceFromMarkup(paid, { trustFreeFlag: true })).toBeUndefined();
        // Ursprunget följer med, och ett uttryckligt false syns — det är beviset
        // price-refine kräver av en värd innan dess true-flaggor räknas.
        expect(readMarkupPrice(free)).toEqual({ price: 'Gratis', via: 'ld-gratisflagga', flagFalse: false });
        expect(readMarkupPrice(paid)).toEqual({ flagFalse: true });
        expect(priceFromJsonLd(paid)).toEqual({ notFree: true });
    });

    it('ursprunget: etikett, offers, gratismärke', () => {
        expect(readMarkupPrice(page('<p>Pris: 60 kr</p>')).via).toBe('etikett');
        expect(readMarkupPrice(ld({ '@type': 'Event', offers: { price: 120, priceCurrency: 'SEK' } })).via).toBe('ld-offers');
        expect(readMarkupPrice(page('<div class="badge"><p>Fri entré</p></div>')).via).toBe('gratismärke');
        expect(readMarkupPrice(page('<p>Ingen prisuppgift här.</p>'))).toEqual({ flagFalse: false });
    });

    it('faktarutans pris slår JSON-LD-flaggan', () => {
        const html = page('<div class="sol-event-info-field"> Pris: från 540 kr. </div>',
            `<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', isAccessibleForFree: true })}</script>`);
        expect(priceFromMarkup(html)).toBe('från 540 kr');
    });

    it('annan valuta, andra nodtyper och oeniga noder ger inget', () => {
        expect(priceFromJsonLd(ld({ '@type': 'Event', offers: { price: 25, priceCurrency: 'EUR' } }))).toEqual({});
        expect(priceFromJsonLd(ld({ '@type': 'Product', offers: { price: 250, priceCurrency: 'SEK' } }))).toEqual({});
        expect(priceFromJsonLd(ld([{ '@type': 'Event', offers: { price: 100 } }, { '@type': 'Event', offers: { price: 250 } }]))).toEqual({});
    });

    it('@graph och maskerat plustecken i script-typen (vastsverige.com)', () => {
        const html = page('', `<script type="application/ld&#x2B;json">${JSON.stringify({ '@graph': [{ '@type': 'WebPage' }, { '@type': 'TheaterEvent', offers: [{ price: '120.00', priceCurrency: 'SEK' }] }] })}</script>`);
        expect(priceFromJsonLd(html)).toEqual({ price: '120 kr' });
    });

    it('trasig JSON-LD fäller inte sidan', () => {
        expect(priceFromMarkup(page('<p>Pris: 60 kr</p>', '<script type="application/ld+json">{ inte json </script>'))).toBe('60 kr');
    });
});

describe('markupLines / priceFromLabelledLines', () => {
    it('blockelement bryter rad, inline-taggar blir mellanslag', () => {
        const lines = markupLines(page('<dl><dt>Pris</dt><dd><b>365</b> kr/st</dd></dl><p>Rad ett<br>rad två</p>'));
        expect(lines).toContain('Pris');
        expect(lines).toContain('365 kr/st');
        expect(lines).toContain('Rad ett');
        expect(lines).toContain('rad två');
    });

    it('etikettrad följd av nästa etikett avbryter letandet', () => {
        expect(priceFromLabelledLines(['Pris', 'Kostnad', '75 kr'])).toBe('75 kr');
        expect(priceFromLabelledLines(['Pris', 'Arrangör', 'Tobbe Blom', 'Plats', 'Garaget', '200 kr'])).toBeUndefined();
    });
});
