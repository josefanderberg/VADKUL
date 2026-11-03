import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { eventShareSlug } from './eventShareSlug';

// GULDTEST, samma frysta värden som packages/kontrakt/src/eventShareSlug.test.ts.
// Går det rött har kopian glidit från kontraktet: rätta kopian, aldrig värdena.
describe('eventShareSlug (scraperns kopia av kontraktet)', () => {
    it('ger exakt samma hash som kontraktet (frysta guldvärden)', () => {
        expect(eventShareSlug('https://www.ticketmaster.se/event/123')).toBe('a7dc327fb4e63ab1');
        expect(eventShareSlug('https://kulturbolaget.se/evenemang/test')).toBe('c8a332eb29581ebd');
        expect(eventShareSlug('abc')).toBe('1a47e90bea894dc5');
        expect(eventShareSlug('')).toBe('811c9dc57ee3623b');
    });

    it('har samma funktionskropp som kontraktets källa', () => {
        const kontrakt = fs.readFileSync(path.resolve(__dirname, '../../../../packages/kontrakt/src/eventShareSlug.ts'), 'utf-8');
        const kopia = fs.readFileSync(path.resolve(__dirname, 'eventShareSlug.ts'), 'utf-8');
        const kropp = (s: string) => s.slice(s.indexOf('function fnv1a')).replace(/\s+/g, ' ').trim();
        expect(kropp(kopia)).toBe(kropp(kontrakt));
    });
});
