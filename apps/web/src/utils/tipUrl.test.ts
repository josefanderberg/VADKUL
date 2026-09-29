import { describe, it, expect } from 'vitest';
import { normalizeTipUrl } from './tipUrl';

describe('normalizeTipUrl', () => {
    it('vanlig länk går igenom oförändrad', () => {
        expect(normalizeTipUrl('https://vaxjocity.com/halloween/')).toBe('https://vaxjocity.com/halloween/');
        expect(normalizeTipUrl('https://x.se/a?b=1#c')).toBe('https://x.se/a?b=1#c');
    });

    it('protokoll saknas → https:// läggs på', () => {
        expect(normalizeTipUrl('vaxjocity.com/halloween/')).toBe('https://vaxjocity.com/halloween/');
        expect(normalizeTipUrl('  www.x.se  ')).toBe('https://www.x.se/');
    });

    it('ogiltigt → null', () => {
        expect(normalizeTipUrl('')).toBeNull();
        expect(normalizeTipUrl('   ')).toBeNull();
        expect(normalizeTipUrl('aftonbladet')).toBeNull();
        expect(normalizeTipUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeTipUrl('ftp://x.se/a')).toBeNull();
    });

    it('mellanslag + LRM efter länken (FB/mobilens dela-meny) skalas bort', () => {
        expect(normalizeTipUrl('https://vaxjocity.com/halloween/ \u200E')).toBe('https://vaxjocity.com/halloween/');
        expect(normalizeTipUrl('\u200Fhttps://x.se/a\u200B')).toBe('https://x.se/a');
        expect(normalizeTipUrl('\uFEFFx.se/a\u2066\u2069')).toBe('https://x.se/a');
    });

    it('bara osynliga tecken → null', () => {
        expect(normalizeTipUrl('\u200E \u200B')).toBeNull();
    });

    it('redan kodat skräp sist (gamla sparade tips) lagas', () => {
        expect(normalizeTipUrl('https://vaxjocity.com/halloween/%20%E2%80%8E')).toBe('https://vaxjocity.com/halloween/');
        expect(normalizeTipUrl('https://x.se/a?q=1%C2%A0%e2%80%8b')).toBe('https://x.se/a?q=1');
    });

    it('kodade tecken MITT i länken rörs inte', () => {
        expect(normalizeTipUrl('https://x.se/a%20b/c')).toBe('https://x.se/a%20b/c');
    });
});
