import { describe, it, expect } from 'vitest';
import { parseCbisCard, applyCbisDetail, stripWeekday } from './cbis';

const NOW = new Date('2026-07-02T10:00:00');
const CFG = { baseUrl: 'https://visitumea.se', nodeId: 1262, defaultCity: 'Umeå' };

// Umeå-temat: .title / .cbis-date / .cbis-event-arena
const UMEA_CARD = `
<div class="node cbis-product-item">
  <a href="/sv/breathwork-med-love-yoga"><img src="/sites/cb_umea/files/styles/x/img.webp"/>
    <strong class="title">Breathwork med Love Yoga</strong>
    <div class="cbis-date"><span>02 Jul</span></div>
    <div class="cbis-event-arena"><span>Döbelns park</span></div>
  </a>
</div>`;

// Karlskrona-temat: .card-title / .cbis-occasions (intervall) / .card-text
const KARLSKRONA_CARD = `
<div class="card cbis-product-teaser">
  <a href="/sv/dragso-sommarprogram" class="btn stretched-link">Läs mer</a>
  <strong class="h3 card-title text-uppercase">Dragsö Camping Sommarprogram 2026</strong>
  <div class="cbis-occasions">03 Jul
                   - 13 Aug</div>
  <p class="card-text">Upptäck sommarens aktiviteter på Dragsö Camping i Karlskrona skärgård.</p>
</div>`;

describe('parseCbisCard', () => {
    it('Umeå-temat: titel/datum/venue/bild', () => {
        const ev = parseCbisCard(UMEA_CARD, CFG, NOW)!;
        expect(ev.title).toBe('Breathwork med Love Yoga');
        expect(ev.url).toBe('https://visitumea.se/sv/breathwork-med-love-yoga');
        expect(ev.startDate.getMonth()).toBe(6);   // juli
        expect(ev.startDate.getDate()).toBe(2);
        expect(ev.venueName).toBe('Döbelns park');
        expect(ev.city).toBe('Umeå');
        expect(ev.imageUrl).toContain('https://visitumea.se/sites/');
    });

    it('Karlskrona-temat: card-title + intervallets FÖRSTA datum + card-text-desc', () => {
        const ev = parseCbisCard(KARLSKRONA_CARD, { ...CFG, baseUrl: 'https://www.visitkarlskrona.se', defaultCity: 'Karlskrona' }, NOW)!;
        expect(ev.title).toBe('Dragsö Camping Sommarprogram 2026');
        expect(ev.startDate.getMonth()).toBe(6);
        expect(ev.startDate.getDate()).toBe(3);
        expect(ev.description).toContain('Dragsö Camping');
        expect(ev.city).toBe('Karlskrona');
    });

    it('kort utan datum eller länk → null', () => {
        expect(parseCbisCard('<div><strong class="title">X</strong></div>', CFG, NOW)).toBeNull();
        expect(parseCbisCard('<div><a href="/x"><strong class="title">X</strong></a><div class="cbis-date"><span>ogiltigt</span></div></div>', CFG, NOW)).toBeNull();
    });
});

describe('applyCbisDetail', () => {
    it('meta-desc + första klockslag fylls', () => {
        const ev = parseCbisCard(UMEA_CARD, CFG, NOW)!;
        ev.description = undefined;
        applyCbisDetail('<meta name="description" content="Andetaget är kanske det närmaste du har en fjärrkontroll."/><p>Tid: 12:00 - 13:00</p>', ev);
        expect(ev.description).toContain('fjärrkontroll');
        expect(ev.startDate.getHours()).toBe(12);
        expect(ev.hasSpecificTime).toBe(true);
    });

    it('befintlig kort-desc skrivs inte över; befintlig tid rörs inte', () => {
        const ev = parseCbisCard(KARLSKRONA_CARD, CFG, NOW)!;
        const before = ev.description;
        ev.startDate.setHours(19, 30);
        applyCbisDetail('<meta name="description" content="Något helt annat innehåll här."/><p>08:00</p>', ev);
        expect(ev.description).toBe(before);
        expect(ev.startDate.getHours()).toBe(19);
    });
});

describe('stripWeekday', () => {
    it('kapar Kinda-temats veckodagsprefix', () => {
        expect(stripWeekday('ons 26 aug')).toBe('26 aug');
        expect(stripWeekday('sön 06 sep')).toBe('06 sep');
        expect(stripWeekday('tors 3 juli')).toBe('3 juli');
        expect(stripWeekday('måndag 1 maj')).toBe('1 maj');
    });

    it('rör inte datum utan veckodag', () => {
        expect(stripWeekday('26 aug')).toBe('26 aug');
        expect(stripWeekday('2026-08-26')).toBe('2026-08-26');
    });

    it('kapar inte ord som bara börjar likadant', () => {
        expect(stripWeekday('Onsdagsklubben 5 maj')).toBe('Onsdagsklubben 5 maj');
    });
});
