import { describe, it, expect } from 'vitest';
import { eventKey, buildCardIndex } from './eventKey';

/**
 * FACIT-VÄRDEN — tvillinglåset.
 *
 * Exakt samma tabell finns i apps/scraper/src/utils/eventKey.test.ts. Scrapern
 * STÄMPLAR de här nycklarna i cards-lagret och webben SLÅR UPP på dem; går de
 * isär hittar inget kort sitt event och kartan tappar alla omslagsbilder utan
 * att något kastar fel. Ändra aldrig värdena här för att få testet grönt —
 * ändra tillbaka algoritmen.
 */
const FIXTURES: Array<[string, string]> = [
    ['https://www.facebook.com/events/1822828132503034/', '1jv0q4ni584'],
    ['https://www.gotabiblioteken.se/evenemang#d7095e78-769a-468a-993f-c0b3b396f6cb', 'i6fmfxdm5m'],
    ['https://ticketmaster.evyy.net/c/7528311/2038747/23885?u=x', '16dpqshhygn'],
    ['', 'wvjl67o803'],
    ['Åäö — unicode/test', 'tops181ist'],
];

describe('eventKey', () => {
    it.each(FIXTURES)('hashar %s stabilt', (url, expected) => {
        expect(eventKey(url)).toBe(expected);
    });

    it('ger samma nyckel för samma url varje gång', () => {
        const u = 'https://example.se/event/42';
        expect(eventKey(u)).toBe(eventKey(u));
    });

    it('skiljer på url:er som bara differerar i slutet', () => {
        expect(eventKey('https://example.se/event/1')).not.toBe(eventKey('https://example.se/event/2'));
    });

    it('kolliderar inte över en stor mängd realistiska url:er', () => {
        const keys = new Set<string>();
        for (let i = 0; i < 20000; i++) {
            keys.add(eventKey(`https://bibliotek.example.se/evenemang#${i}-${i * 7919}`));
        }
        expect(keys.size).toBe(20000);
    });
});

describe('buildCardIndex', () => {
    const DEST = 'https://example.se/event/1';

    it('slår upp GAMLA formatet (id = hela url:en)', () => {
        const lookup = buildCardIndex([{ id: DEST, hostName: 'Biblioteket' }]);
        expect(lookup(DEST)?.hostName).toBe('Biblioteket');
    });

    it('slår upp SLANKA formatet (h = hash)', () => {
        const lookup = buildCardIndex([{ h: eventKey(DEST), hostName: 'Biblioteket' }]);
        expect(lookup(DEST)?.hostName).toBe('Biblioteket');
    });

    it('ger undefined för event utan kort', () => {
        const lookup = buildCardIndex([{ h: eventKey(DEST) }]);
        expect(lookup('https://example.se/event/saknas')).toBeUndefined();
    });

    it('klarar ett tomt lager', () => {
        expect(buildCardIndex([])(DEST)).toBeUndefined();
    });

    it('låter exakt id vinna över hash i ett blandat lager', () => {
        const lookup = buildCardIndex([
            { h: eventKey(DEST), hostName: 'slank' },
            { id: DEST, hostName: 'gammal' },
        ]);
        expect(lookup(DEST)?.hostName).toBe('gammal');
    });
});
