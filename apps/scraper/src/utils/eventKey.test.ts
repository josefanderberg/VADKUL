import { describe, it, expect } from 'vitest';
import { eventKey } from './eventKey';

/**
 * FACIT-VÄRDEN — tvillinglåset.
 *
 * Exakt samma tabell finns i apps/web/src/utils/eventKey.test.ts. Scrapern
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

    it('kolliderar inte över en stor mängd realistiska url:er', () => {
        const keys = new Set<string>();
        for (let i = 0; i < 20000; i++) {
            keys.add(eventKey(`https://bibliotek.example.se/evenemang#${i}-${i * 7919}`));
        }
        expect(keys.size).toBe(20000);
    });
});
