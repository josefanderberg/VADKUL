import { describe, it, expect } from 'vitest';
import { cleanDescription } from './text';

describe('cleanDescription', () => {
    it('strippar HTML-taggar, avkodar entities, kollapsar whitespace', () => {
        // &amp; ska AVKODAS till &, inte blankas (encoding-fixen 2026-07-09).
        expect(cleanDescription('<p>Hej &amp; välkommen</p>\n\n  <b>alla</b>'))
            .toBe('Hej & välkommen alla');
    });

    it('tar bort WP-excerpt-rester', () => {
        expect(cleanDescription('Läs mer […]')).toBe('Läs mer');
        expect(cleanDescription('Läs mer [...]')).toBe('Läs mer');
    });

    it('klipper till maxlängd (default 500)', () => {
        expect(cleanDescription('x'.repeat(600))).toHaveLength(500);
        expect(cleanDescription('abcdef', 3)).toBe('abc');
    });

    it('tål null/undefined/icke-strängar', () => {
        expect(cleanDescription(null)).toBe('');
        expect(cleanDescription(undefined)).toBe('');
        expect(cleanDescription(42)).toBe('42');
    });
});
