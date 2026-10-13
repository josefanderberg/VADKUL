import { describe, it, expect } from 'vitest';
import { dateFromContentRegex, findVenueInHtml, findVenueInText, htmlToLines } from './wp-rest';
import { SOURCES } from '../registry';
import { findFirstDateInText } from '../../utils/swedishDate';

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

const configOf = (id: string) => SOURCES.find((x) => x.id === id)!.config as { contentDateRegex?: RegExp; detailDateRegex?: RegExp };
const ymdh = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
const NOW = new Date(2026, 9, 12, 0, 0);   // mån 12 okt 2026

// Örebro läns museum 12/10: API:ts content renderar hela sidan inkl. tre puffar
// med ANDRA events datum. Passerade "fredag 7 augusti" föll på veckodags-
// kontrollen och fritext-skanningen tog puffens "26 oktober" (14 av 19 event).
describe('dateFromContentRegex — bara sidans egen datumruta (OLM)', () => {
    const re = configOf('olm').contentDateRegex!;
    const content = (info: string) => `<div class="beige-bg info-box"><h2 class="pb-1">Bra att veta</h2>
<div class="custom-info">${info}</div></div>
<div class="custom-block"><div class="container acf-two-columns three-puffs">
<a href="https://olm.se/kalender/fortbildning-for-slojdlarare/" class="puff-link"><h3 class="puff-title">Fortbildning för slöjdlärare</h3>
<div class="date-range pb-0-5">26 oktober–27 oktober</div></a>
<a href="https://olm.se/kalender/ung-slojd/" class="puff-link"><h3 class="puff-title">Ung slöjd</h3>
<div class="date-range pb-0-5">28 oktober</div></a></div></div>`;
    const MAY = new Date('2026-05-19T13:21:33');

    it('passerat event ("fredag 7 augusti") → null, inte puffens 26 oktober', () => {
        const html = content('<p><strong>Datum:</strong> fredag 7 augusti</p>\n<p><strong>Tid: </strong>kl. 11.00–12.30 och 13.00–15.00 (drop-in).</p>');
        expect(dateFromContentRegex(html, re, NOW, MAY)).toBeNull();
        // Helsides-skanningen (det gamla beteendet) tog puffens datum.
        expect(ymdh(findFirstDateInText(html, NOW)!).slice(0, 3)).toEqual([2026, 10, 26]);
    });

    it('kommande event: dag + klockslag ur "Tid:"-raden', () => {
        const html = content('<p><strong>Datum:</strong> Onsdag 28 oktober</p>\n<p><strong>Tid: </strong>Kl. 16.00–20.00</p>\n<p><strong>Plats: </strong>NBV Kulturpalatset</p>');
        expect(ymdh(dateFromContentRegex(html, re, NOW, new Date('2026-10-05T08:20:37'))!)).toEqual([2026, 10, 28, 16, 0]);
    });

    it('intervall → startdagen, "Tider:" ger klockslaget', () => {
        const html = content('<p><strong>Datum:</strong> 26–27 oktober</p>\n<p><strong>Tider:</strong> 9.00–16.00</p>');
        expect(ymdh(dateFromContentRegex(html, re, NOW, new Date('2026-09-24T11:43:25'))!)).toEqual([2026, 10, 26, 9, 0]);
    });

    it('årslöst datum mer än ett år efter publiceringen → null (spök-event nästa år)', () => {
        const html = content('<p>Mobila museet är öppet 22–23 augusti kl. 11–17</p>');
        expect(dateFromContentRegex(html, re, NOW, new Date('2026-05-29T10:33:08'))).toBeNull();
        // Utan publiceringsdatum hade det blivit 2027-08-22.
        expect(dateFromContentRegex(html, re, NOW)!.getFullYear()).toBe(2027);
    });

    it('rutan saknas → null', () => {
        expect(dateFromContentRegex('<p>Välkommen 28 oktober!</p>', re, NOW, MAY)).toBeNull();
    });
});

// Stora Teatern 12/10: helsides-skanningen tog "På gång"-hjulets första kort
// ("15 okt 2026") på passerade föreställningar — 70 av 106 på 2026-10-15.
describe('Stora Teatern: detailDateRegex läser bara "Speltillfällen"-listan', () => {
    const re = configOf('stora-teatern-gbg').detailDateRegex!;
    const slot = (day: string, date: string, time: string, current = '') => `<a tabindex="0" class="event__sidebar--show--date" href="https://storateatern.se/sv/program/x/?date=2610160700 ">
<div class="info-box__item info-box__item--date info-box__item--sidebar ${current}"><span class="event-day"><h5 class="_uppercase">${day}</h5></span>
<div class="date-time"><h3 class="h3a"> ${date} </h3><span class="time"><h5>${time} </h5><h5 class="_thin"> 1h 40min, inklusive paus</h5></span></div></div></a>`;
    const page = (slots: string) => `<div class="event__sidebar"><div class="event__sidebar__dates">
<div class="event__sidebar__header"><h5 class="event__sidebar__title">Speltillfällen</h5></div>${slots}</div>
<div class="event__sidebar__prices"><h5 class="event__sidebar__title">Priser</h5><p>Ordinarie 445 kr</p></div></div>
<div class="events-wheel"><h3>På gång</h3><a class="swiper-slide" href="https://storateatern.se/sv/program/trubbel/?date=2610150700">
<div class="content__date__row"><span class="_bold _uppercase">15 okt 2026</span><span class="_thin"> Torsdag </span><span class="_thin"> 19:00 </span></div></a></div>`;
    const dateOf = (html: string) => {
        const m = html.match(re);
        return m?.[1] ? findFirstDateInText(m[1].replace(/,/g, ' '), NOW) : null;
    };

    it('passerad föreställning → sitt eget datum (faller på fönstret), inte hjulets 15 okt', () => {
        expect(ymdh(dateOf(page(slot('Lördag', '18 apr 2026', '19:00', 'info-box__item--current')))!)).toEqual([2026, 4, 18, 19, 0]);
    });

    it('flera tillfällen → första kommande, med klockslag', () => {
        const html = page(slot('Lördag', '10 okt 2026', '19:00') + slot('Fredag', '16 okt 2026', '19:00') + slot('Lördag', '17 okt 2026', '15:00'));
        expect(ymdh(dateOf(html)!)).toEqual([2026, 10, 16, 19, 0]);
    });
});
