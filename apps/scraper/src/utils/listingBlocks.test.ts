import { describe, it, expect } from 'vitest';
import { parseDateLine, parseListing, listingEventUrl, titleSlug, listingLines } from './listingBlocks';

/** Lördag 14 november 2026 — dagen läsaren byggdes. */
const NOW = new Date(2026, 10, 14, 12, 0);
const PAGE = 'https://www.exempel.se/evenemang/';

const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hm = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const brief = (html: string, page = PAGE) => parseListing(html, page, NOW).map((e) => `${ymd(e.start)} ${e.hasTime ? hm(e.start) : '--:--'} ${e.title}`);

describe('parseDateLine', () => {
    it('rena datumrader: veckodag, klockslag, förkortad månad, spann', () => {
        const a = parseDateLine('Lördag 21 november kl 19:00', NOW)!;
        expect([ymd(a.start), hm(a.start), a.hasTime, a.rest]).toEqual(['2026-11-21', '19:00', true, '']);
        const b = parseDateLine('Lördag 28 nov kl 11:00', NOW)!;
        expect([ymd(b.start), hm(b.start), b.rest]).toEqual(['2026-11-28', '11:00', '']);
        const c = parseDateLine('Lördag 19 december kl 16.00 & kl 19.00', NOW)!;
        expect([ymd(c.start), hm(c.start), c.rest.replace(/[^\p{L}]/gu, '')]).toEqual(['2026-12-19', '16:00', '']);
        const d = parseDateLine('Lördag 13 februari kl 17.00-19.00', NOW)!;
        expect([ymd(d.start), hm(d.start)]).toEqual(['2027-02-13', '17:00']);
        const e = parseDateLine('Söndag 29 november - 13 december', NOW)!;
        expect([ymd(e.start), e.end && ymd(e.end), e.hasTime]).toEqual(['2026-11-29', '2026-12-13', false]);
        const f = parseDateLine('26–27 november', NOW)!;
        expect([ymd(f.start), f.end && ymd(f.end)]).toEqual(['2026-11-26', '2026-11-27']);
        expect(ymd(parseDateLine('Lördag 7 Nov', NOW)!.start)).toBe('2026-11-07');
        expect(ymd(parseDateLine('Datum: 2026-12-03', NOW)!.start)).toBe('2026-12-03');
    });

    it('en mening som nämner ett datum är ingen datumrad: resten bär bokstäver', () => {
        const prose = parseDateLine('Vi kommer ha två konserter på Palladium lördagen den 19:e december kl. 16.00 och 19.00.', NOW)!;
        expect(prose.atStart).toBe(false);
        expect(prose.rest).toMatch(/konserter/);
        const opening = parseDateLine('Fredag 6 november: öppet mellan 15-01', NOW)!;
        expect(opening.atStart).toBe(true);
        expect(opening.rest).toMatch(/öppet/);
        expect(parseDateLine('Välkommen in på en öl och en bit mat.', NOW)).toBeNull();
    });

    it('listrader: datumet först, titeln efter — klockslaget hör inte till titeln', () => {
        const a = parseDateLine('Fre 20/11 Quiz med Kalle', NOW)!;
        expect([ymd(a.start), a.atStart, a.tail]).toEqual(['2026-11-20', true, 'Quiz med Kalle']);
        const b = parseDateLine('21 nov kl 19:00 – Livemusik: Bandet och vännerna', NOW)!;
        expect([ymd(b.start), hm(b.start), b.tail]).toEqual(['2026-11-21', '19:00', '– Livemusik: Bandet och vännerna']);
    });

    it('fel veckodag = gammal programpunkt, inget datum', () => {
        // 12 september 2026 var en lördag; "fredag 12 september" stämmer inte med något närliggande år.
        expect(parseDateLine('Fredag 12 september', NOW)).toBeNull();
    });

    it('datum utan år och veckodag som hamnar nio månader fram är en kvarglömd sida', () => {
        expect(parseDateLine('12 september', NOW)).toBeNull();           // skulle bli 2027-09-12
        expect(ymd(parseDateLine('12 september 2027', NOW)!.start)).toBe('2027-09-12');
        expect(ymd(parseDateLine('12 mars', NOW)!.start)).toBe('2027-03-12');
    });

    it('veckodagen får inte flytta datumet mer än ett år fram (Villa Karlsro 15/11)', () => {
        // 26 dec 2026 är en lördag. "Söndag 26 dec" stämmer först 2027 — en kvarglömd rad.
        expect(parseDateLine('Söndag 26 dec kl 11-15', NOW)).toBeNull();
        expect(ymd(parseDateLine('Lördag 26 dec kl 11-15', NOW)!.start)).toBe('2026-12-26');
    });

    it('bråk och dygnet-runt är inga datum', () => {
        expect(parseDateLine('1/2 kyckling med pommes', NOW)).toBeNull();
        expect(parseDateLine('Öppet 24/7', NOW)).toBeNull();
        expect(parseDateLine('150/200 kr', NOW)).toBeNull();
        expect(ymd(parseDateLine('21/11', NOW)!.start)).toBe('2026-11-21');
        expect(ymd(parseDateLine('Lör 21/11-26 kl 22', NOW)!.start)).toBe('2026-11-21');
    });
});

describe('parseListing — kort med rubrik och datumrad (Palladium, Växjö 14/11)', () => {
    const card = (cat: string, title: string, sub: string, date: string, body: string) => `
        <div class="fw-col-xs-12 fw-col-sm-4">
            <header><h2 class="center">${cat}</h2></header>
            <img src="/wp-content/uploads/2026/11/${title.toLowerCase().replace(/\W+/g, '-')}.png" width="917" height="832" />
            <aside><h3 class="left">${title}</h3><p><strong>${sub}</strong></p><p><b>${date}</b></p></aside>
            <aside><div><p>${body}</p></div></aside>
            <a href="https://www.tickster.com/se/sv/events/abc" class="fw-btn"><span>BILJETTER HÄR</span></a>
        </div>`;
    const html = `<html><body>
        <div class="menu"><a href="/biljetter/">BILJETTER</a><a href="/evenemang/">EVENEMANG</a></div>
        <main><div class="fw-row">
        ${card('STAND-UP', 'EN KVÄLL MED SHAN ATCI', 'en helt ny och personlig standup-show', 'Lördag 21 november kl 19:00', 'Shan Atci är en av Sveriges mest etablerade komiker.')}
        ${card('TROLLERISHOW', 'Tobbe Trollkarl', '30 års jubileumsshow!', 'Lördag 28 nov kl 11:00', 'Barn under två går gratis i förälders knä.')}
        ${card('KONSERT', "Blandad Konfekt - 'Jul, jul strålande jul'", 'Julkonsert', 'Lördag 19 december kl 16.00 &amp; kl 19.00', 'Vi kommer ha två konserter på Palladium lördagen den 19:e december kl. 16.00 och 19.00.')}
        ${card('STORSEANS', 'Storseans med Martin Ohlson Medium', 'En kväll', 'Lördag 13 februari kl 17.00-19.00', 'Upplev en kväll där gränsen känns extra tunn.')}
        </div></main></body></html>`;

    it('titeln är kortets rubrik, inte underrubriken i fetstil eller kategorin', () => {
        expect(brief(html)).toEqual([
            '2026-11-21 19:00 EN KVÄLL MED SHAN ATCI',
            '2026-11-28 11:00 Tobbe Trollkarl',
            "2026-12-19 16:00 Blandad Konfekt - 'Jul, jul strålande jul'",
            '2027-02-13 17:00 Storseans med Martin Ohlson Medium',
        ]);
    });

    it('beskrivning, bild och adress kommer ur eventets eget kort', () => {
        const [shan, tobbe] = parseListing(html, PAGE, NOW);
        expect(shan.description).toContain('Shan Atci är en av Sveriges mest etablerade komiker.');
        expect(shan.description).not.toContain('Barn under två');
        expect(shan.description).not.toMatch(/BILJETTER HÄR/);
        expect(shan.imageUrl).toBe('https://www.exempel.se/wp-content/uploads/2026/11/en-kv-ll-med-shan-atci.png');
        expect(tobbe.imageUrl).toContain('tobbe-trollkarl');
        expect(shan.url).toBe('https://www.exempel.se/evenemang/#2026-11-21-en-kvall-med-shan-atci');
    });
});

describe('parseListing — löptext med fetstilsrubriker (Chapter House, Växjö 14/11)', () => {
    const html = `<html><body><main>
        <h1>Event &amp; Nyheter</h1>
        <h4>Vill du delta i något av våra event?</h4>
        <p>Maila din förfrågan till: <a href="mailto:x@exempel.se">x@exempel.se</a></p>
        <div class="et_pb_row"><div class="et_pb_text_inner">
            <p><strong>*EVENTET ÄR FULLBOKAT*</strong></p>
            <p><span><strong>ÖPPEN GINPROVNING MED SATURNUS 1893</strong></span></p>
            <p>För första gången bjuder vi in till en ginprovning med <strong>Saturnus 1893</strong>. Vi utforskar deras <strong>Malmö Gin Collection</strong>.</p>
            <p><strong>Lördag 21 november</strong></p>
            <p><strong>Klockan 14-16</strong></p>
            <p><strong>Pris: 525:-</strong></p>
            <p><strong>Vill du boka plats?</strong></p>
            <p><strong>Vänligen maila din förfrågan till: x@exempel.se</strong></p>
        </div></div>
        <div class="et_pb_row"><div class="et_pb_text_inner">
            <p>När kylan smyger sig på bjuder vi in till en riktigt mysig decemberlördag.</p>
            <p><b>Julinspirerad Ölprovning</b></p>
            <p><b>inkl. 4-rätters middag</b></p>
            <p><b>Lördag 5 december</b></p>
            <p><b>Klockan 14-16.30</b></p>
            <p><b>725kr / person</b></p>
            <p><b>Förfrågan sker via mail till:</b></p>
        </div></div>
        <div class="et_pb_row"><div class="et_pb_text_inner">
            <p><strong>Höstens tap takeover är spikad!</strong></p>
            <p><strong>Vi välkomnar:</strong></p>
            <p><strong>-Hyllie Bryggeri</strong></p>
            <p><strong>-Malmö Brewing co</strong></p>
            <p>Fredag 20 november: öppet mellan 15-01</p>
            <p>Lördag 21 november: öppet mellan 12-01</p>
        </div></div>
        </main></body></html>`;

    it('sidrubriken som alla datum delar förlorar mot fetstilsrubrikerna i varje block', () => {
        expect(brief(html)).toEqual([
            '2026-11-21 14:00 ÖPPEN GINPROVNING MED SATURNUS 1893',
            '2026-12-05 14:00 Julinspirerad Ölprovning inkl. 4-rätters middag',
        ]);
    });

    it('priset läses ur eventets eget block; öppettidsrader blir inga event', () => {
        const [gin] = parseListing(html, PAGE, NOW);
        expect(gin.price).toBe('525 kr');
        expect(gin.description).toContain('ginprovning');
        expect(brief(html).join(' ')).not.toMatch(/öppet|Bryggeri|FULLBOKAT|Vill du/);
    });
});

describe('parseListing — ordningen i en platt lista', () => {
    it('datumet står FÖRE rubriken: varje datum hör till rubriken efter, inte grannens', () => {
        const html = `<html><body><main>
            <p class="d">Fredag 20 november kl 21:00</p><h3>Bandet Ett</h3><p>Rock hela kvällen.</p>
            <p class="d">Lördag 21 november kl 21:00</p><h3>Bandet Två</h3><p>Soul och funk.</p>
            <p class="d">Fredag 27 november kl 21:00</p><h3>Bandet Tre</h3><p>Covers.</p>
            </main></body></html>`;
        expect(brief(html)).toEqual(['2026-11-20 21:00 Bandet Ett', '2026-11-21 21:00 Bandet Två', '2026-11-27 21:00 Bandet Tre']);
        expect(parseListing(html, PAGE, NOW)[0].description).toBe('Rock hela kvällen.');
    });

    it('rubriken står först: en serie får samma titel på varje datum', () => {
        const html = `<html><body><main>
            <h2>Musikquiz</h2><ul><li>Onsdag 18 november kl 19</li><li>Onsdag 25 november kl 19</li><li>Onsdag 2 december kl 19</li></ul>
            </main></body></html>`;
        expect(brief(html)).toEqual(['2026-11-18 19:00 Musikquiz', '2026-11-25 19:00 Musikquiz', '2026-12-02 19:00 Musikquiz']);
    });

    it('kort där titeln är en länk: adressen blir eventets egen sida med datumfragment', () => {
        const html = `<html><body><main>
            <div class="card"><div class="date">21 november 2026</div><a href="/pa-scen/jazzkvall/">Jazzkväll med trion</a><a href="/pa-scen/jazzkvall/">Läs mer</a></div>
            <div class="card"><div class="date">28 november 2026</div><a href="/pa-scen/standup/">Standup: Öppen scen</a><a href="/pa-scen/standup/">Läs mer</a></div>
            </main></body></html>`;
        const evs = parseListing(html, PAGE, NOW);
        expect(evs.map((e) => e.title)).toEqual(['Jazzkväll med trion', 'Standup: Öppen scen']);
        expect(evs[0].url).toBe('https://www.exempel.se/pa-scen/jazzkvall/#2026-11-21');
    });
});

describe('parseListing — två datumrader för samma event', () => {
    it('slutdatumet efter midnatt blir inget eget event dagen efter (Kafé de luxe 14/11)', () => {
        // Squarespace: datumbrickan skriver slutdagen på egen rad ("till 15 nov."),
        // metaraden bär start och slut utan streck emellan.
        const item = (title: string, slug: string, d1: string, d2: string, tag: string) => `<article class="eventlist-event">
            <div class="eventlist-datetag"><div class="eventlist-datetag-enddate">${tag}</div></div>
            <div class="eventlist-column-info"><h1 class="eventlist-title"><a href="/kalendarium/${slug}">${title}</a></h1>
            <ul class="eventlist-meta"><li class="eventlist-meta-date"><time class="event-date">${d1}</time> <span><time>21:00</time></span>
                <span class="event-datetime-divider"></span> <time class="event-date">${d2}</time> <span><time>00:00</time></span></li>
            <li class="eventlist-meta-address">Kafé de luxe <a href="http://maps.google.com?q=x">(se karta)</a></li></ul>
            <div class="eventlist-excerpt"><p>En kväll med livemusik.</p></div></div></article>`;
        const html = `<html><body><main>
            ${item('Live: De Clair + Juni', 'de-clair', 'lör 14 nov. 2026', 'sön 15 nov. 2026', 'till 15 nov.')}
            ${item('Live: Vit Päls', 'vit-pals-2026', 'fre 20 nov. 2026', 'lör 21 nov. 2026', 'till 21 nov.')}
            </main></body></html>`;
        const evs = parseListing(html, 'https://www.kafedeluxe.se/kalendarium', NOW);
        expect(evs.map((e) => `${ymd(e.start)} ${hm(e.start)} ${e.title}`)).toEqual(['2026-11-14 21:00 Live: De Clair + Juni', '2026-11-20 21:00 Live: Vit Päls']);
        expect(evs[0].end && ymd(evs[0].end)).toBe('2026-11-15');
    });

    it('datumbricka + rad med klockslag samma dag är ett event, och klockslaget följer med', () => {
        const html = `<html><body><main>
            <article><p class="tag">19 november</p><h3><a href="/event/pub-torsdag-5/">Pub-Torsdag</a></h3><p>19 november kl. 19:00 - 23:00</p></article>
            <article><p class="tag">20 november</p><h3><a href="/event/disco-fredag-8/">Disco-Fredag</a></h3><p>20 november kl. 22:00 - 02:00</p></article>
            </main></body></html>`;
        expect(brief(html)).toEqual(['2026-11-19 19:00 Pub-Torsdag', '2026-11-20 22:00 Disco-Fredag']);
    });

    it('två föreställningar samma dag och en tvådagarsmarknad med tider står kvar som två', () => {
        const html = `<html><body><main>
            <h2>Julmarknad på museet</h2><ul><li>28 november, 11:00 - 17:00</li><li>29 november, 11:00 - 17:00</li></ul>
            <h2>Familjeföreställning</h2><ul><li>5 december kl 13:00</li><li>5 december kl 16:00</li></ul>
            </main></body></html>`;
        expect(brief(html)).toEqual([
            '2026-11-28 11:00 Julmarknad på museet', '2026-11-29 11:00 Julmarknad på museet',
            '2026-12-05 13:00 Familjeföreställning', '2026-12-05 16:00 Familjeföreställning',
        ]);
    });
});

describe('parseListing — spelplan med status på datumraden (Byttan, Kalmar 15/11)', () => {
    const html = `<html><body><main>
        <section><div class="eyebrow">Julshow 2026 · Nytt datum 17/12</div><div class="body">
            <h2>Julshow med The Rockettes</h2>
            <ul><li><span>27 nov</span><span>Fullbokat</span></li><li><span>28 nov</span><span>Fullbokat</span></li><li><span>17 dec</span><span>Nytt datum</span></li></ul>
            <p>Från julstämning till partystämning — en helkväll med julbord, livemusik och show.</p>
            <div class="steps"><div><h3>Glöggmingel</h3><p>Kvällen börjar i foajén.</p></div><div><h3>Show</h3><p>The Rockettes bjuder på show.</p></div></div>
            <p>845 kr per person</p></div><a href="https://www.nortic.se/x">Köp biljett 17/12</a></section>
        <section><div class="eyebrow">Jullunch 2026</div><div class="body">
            <h2>Jullunch på Byttan</h2>
            <p>Samla familjen och njut av en stämningsfull jullunch.</p>
            <ul><li><span>Söndag 29 november</span><span>12.00–13.45 · 14.00–16.00</span></li><li><span>Lördag 5 december</span><span>12.00–14.30</span></li></ul>
            <p>349 kr per person</p></div><a href="/boka">Boka bord</a></section>
        </main></body></html>`;

    it('statusen är ingen titel: datumen hör till rubriken ovanför', () => {
        expect(brief(html)).toEqual([
            '2026-11-27 --:-- Julshow med The Rockettes',
            '2026-11-28 --:-- Julshow med The Rockettes',
            '2026-12-17 --:-- Julshow med The Rockettes',
            '2026-11-29 12:00 Jullunch på Byttan',
            '2026-12-05 12:00 Jullunch på Byttan',
        ]);
    });

    it('ett avsnitts text och pris följer inte med till grannens event', () => {
        const evs = parseListing(html, PAGE, NOW);
        const show = evs.find((e) => e.title.startsWith('Julshow'))!;
        const lunch = evs.find((e) => e.title.startsWith('Jullunch'))!;
        expect(lunch.description).toContain('stämningsfull jullunch');
        expect(lunch.description).not.toMatch(/Rockettes|Glöggmingel/);
        expect(lunch.price).toBe('349 kr');
        expect(show.price).toBe('845 kr');
        expect(show.description).toContain('Glöggmingel');
        expect(show.description).not.toMatch(/jullunch/);
    });
});

describe('parseListing — rader som sitter ihop i källan', () => {
    it('element utan mellanrum emellan är ändå skilda ord, och varje rad får ha egna omslag', () => {
        const row = (d: string, t: string) => `<li class="past"><a href="#"><span class="d">${d}</span><span class="t">${t}</span></a></li>`;
        const html = `<html><body><main><ul>${row('20 november', 'Sonic Stories')}${row('21 november', 'Fransk afton med Simone')}${row('27 november', 'AW med Peter')}</ul></main></body></html>`;
        expect(brief(html)).toEqual(['2026-11-20 --:-- Sonic Stories', '2026-11-21 --:-- Fransk afton med Simone', '2026-11-27 --:-- AW med Peter']);
    });

    it('en menyrad med pil är ingen titel', () => {
        const html = `<html><body><div class="top"><h3>HITTA TILL OSS ▼</h3></div><main>
            <p>Onsdag 18 november</p><p>Söndag 22 november</p><p>Onsdag 25 november</p></main></body></html>`;
        expect(brief(html)).toEqual([]);
    });
});

describe('parseListing — listrader', () => {
    it('minst tre syskon med datum först är en lista; titeln är resten av raden', () => {
        const html = `<html><body><main><ul>
            <li>Fre 20/11 Quiz med Kalle</li>
            <li>Lör 21/11 kl 22 – DJ Aron och gäster</li>
            <li>Fre 27/11 Livemusik: Bandet</li>
            </ul></main></body></html>`;
        expect(brief(html)).toEqual(['2026-11-20 --:-- Quiz med Kalle', '2026-11-21 22:00 DJ Aron och gäster', '2026-11-27 --:-- Livemusik: Bandet']);
    });

    it('tabellrader: datum, titel, tid och pris i var sin cell', () => {
        const html = `<html><body><main><table>
            <tr><td>20 nov</td><td>Trubadurkväll</td><td>20:00</td><td>120 kr</td></tr>
            <tr><td>21 nov</td><td>Schlagerbingo</td><td>19:00</td><td>150 kr</td></tr>
            <tr><td>27 nov</td><td>After work med DJ</td><td>17:00</td><td></td></tr>
            </table></main></body></html>`;
        const evs = parseListing(html, PAGE, NOW);
        expect(evs.map((e) => `${ymd(e.start)} ${hm(e.start)} ${e.title}`)).toEqual(['2026-11-20 20:00 Trubadurkväll', '2026-11-21 19:00 Schlagerbingo', '2026-11-27 17:00 After work med DJ']);
        expect(evs.map((e) => e.price)).toEqual(['120 kr', '150 kr', undefined]);
    });

    it('två rader räcker inte, och öppettider är inga event', () => {
        const two = '<html><body><main><p>Fre 20/11 Quiz med Kalle</p><p>Lör 21/11 Livemusik</p></main></body></html>';
        expect(brief(two)).toEqual([]);
        const hours = `<html><body><main><ul>
            <li>24 december: stängt</li><li>25 december: öppet 12-01</li><li>26 december: öppet 15-01</li><li>31 december: 18-03</li>
            </ul></main></body></html>`;
        expect(brief(hours)).toEqual([]);
    });

    it('en meny med halva och hela portioner är ingen kalender', () => {
        const menu = '<html><body><main><ul><li>1/2 kyckling 95 kr</li><li>1/1 kyckling 165 kr</li><li>1/2 revbensspjäll 120 kr</li></ul></main></body></html>';
        expect(brief(menu)).toEqual([]);
    });
});

describe('parseListing — det som inte är ett program', () => {
    it('nyhetsarkiv: inläggens publiceringsdatum är inga eventdatum', () => {
        const post = (title: string, date: string) => `<article class="post"><header><h2><a href="/2026/11/${title.toLowerCase()}/">${title}</a></h2>
            <div class="entry-meta"><time class="entry-date published" datetime="2026-11-14">${date}</time></div></header><p>Text om ${title}.</p></article>`;
        const html = `<html><body><main>${post('Nyöppning', '14 november 2026')}${post('Höstmeny', '14 november 2026')}${post('Rekrytering', '15 november 2026')}</main></body></html>`;
        expect(brief(html)).toEqual([]);
    });

    it('knappar, avdelningsrubriker och etiketter blir aldrig titlar', () => {
        const html = `<html><body><main>
            <h2>Kommande evenemang</h2>
            <div class="row"><p>Lördag 21 november kl 19:00</p><h3>Biljetter här</h3></div>
            <div class="row"><p>Lördag 28 november kl 19:00</p><h3>Läs mer</h3></div>
            </main></body></html>`;
        expect(brief(html)).toEqual([]);
    });

    it('en månadsrubrik är ingen titel (Hälsinglands Museum 15/11)', () => {
        const html = `<html><body><main><h2>November 2026</h2>
            <div class="ev"><p>Lördag 21 november kl 13:00</p><h3>Visning: Hälsingegårdar</h3></div>
            <div class="ev"><p>Söndag 22 november kl 14:00</p><h3>Sagostund</h3></div></main></body></html>`;
        expect(brief(html)).toEqual(['2026-11-21 13:00 Visning: Hälsingegårdar', '2026-11-22 14:00 Sagostund']);
    });

    it('biografens statusrad är ingen filmtitel (Kino i Lund 15/11)', () => {
        const html = `<html><body><main>
            <div class="film"><h3>Visas</h3><p>Söndag 22 november</p><h4>Wild Horse Nine</h4></div>
            <div class="film"><h3>Visas på Kino fr.o.m.</h3><p>Fredag 27 november</p><h4>Woman and Child</h4></div>
            </main></body></html>`;
        expect(brief(html).join(' ')).not.toMatch(/Visas/);
    });

    it('sidhuvud, meny och sidfot läses inte; ett <header> inne i kortet står kvar', () => {
        const html = `<html><body>
            <header class="site-header"><h2>Krogen</h2><nav><a href="/x">Fredag 20 november</a></nav></header>
            <main><article><header><h2>Julkonsert</h2></header><p>Söndag 13 december kl 16:00</p></article></main>
            <footer><h3>Kontakt</h3><p>Lördag 21 november</p></footer></body></html>`;
        const { lines } = listingLines(html, PAGE);
        expect(lines.map((l) => l.text)).toEqual(['Julkonsert', 'Söndag 13 december kl 16:00']);
        expect(brief(html)).toEqual(['2026-12-13 16:00 Julkonsert']);
    });

    it('ett yttre element med "has-sidebar" tar inte med sig hela sidan', () => {
        const html = '<html><body><div id="page" class="site has-sidebar"><main><h3>Jazzkväll</h3><p>Lördag 21 november kl 20:00</p></main><aside class="sidebar"><h3>Arkiv</h3></aside></div></body></html>';
        expect(brief(html)).toEqual(['2026-11-21 20:00 Jazzkväll']);
    });
});

describe('listingEventUrl / titleSlug', () => {
    it('listsidan + datum + titel när titeln inte har egen sida', () => {
        expect(titleSlug('Quiz med Kalle & Ör-jan!')).toBe('quiz-med-kalle-or-jan');
        expect(listingEventUrl('https://x.se/program/#top', 'Quiz med Kalle', new Date(2026, 10, 20))).toBe('https://x.se/program/#2026-11-20-quiz-med-kalle');
    });

    it('titellänken vinner bara på samma sajt och aldrig när den pekar på listan eller roten', () => {
        const d = new Date(2026, 10, 20);
        expect(listingEventUrl('https://x.se/program/', 'Quiz', d, 'https://www.x.se/program/quiz/')).toBe('https://www.x.se/program/quiz/#2026-11-20');
        expect(listingEventUrl('https://x.se/program/', 'Quiz', d, 'https://www.tickster.com/events/abc')).toBe('https://x.se/program/#2026-11-20-quiz');
        expect(listingEventUrl('https://x.se/program/', 'Quiz', d, 'https://x.se/program')).toBe('https://x.se/program/#2026-11-20-quiz');
        expect(listingEventUrl('https://x.se/program/', 'Quiz', d, 'https://x.se/')).toBe('https://x.se/program/#2026-11-20-quiz');
    });
});
