import { describe, it, expect } from 'vitest';
import { parseAbfDescription } from './abf';

describe('parseAbfDescription', () => {
    it('tar og:description och avkodar entiteter', () => {
        const html = '<html><head><meta property="og:description" content="F&ouml;rel&auml;sning om Kalmars historia med Anna Svensson. Fri entr&eacute;!" /></head></html>';
        expect(parseAbfDescription(html)).toBe('Föreläsning om Kalmars historia med Anna Svensson. Fri entré!');
    });
    it('faller tillbaka på meta name=description och hoppar korta/tomma', () => {
        expect(parseAbfDescription('<meta name="description" content="Kom och lyssna på en kväll om folkbildningens roll i samhället.">'))
            .toBe('Kom och lyssna på en kväll om folkbildningens roll i samhället.');
        expect(parseAbfDescription('<meta property="og:description" content="ABF">')).toBeUndefined();
        expect(parseAbfDescription('<html></html>')).toBeUndefined();
    });
});
