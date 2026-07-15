import { describe, it, expect } from 'vitest';
import { cleanDescription } from './text';

describe('cleanDescription', () => {
    it('strippar HTML-taggar, avkodar entities, kollapsar whitespace', () => {
        // &amp; ska AVKODAS till &, inte blankas (encoding-fixen 2026-07-09).
        expect(cleanDescription('<p>Hej &amp; välkommen</p>\n\n  <b>alla</b>'))
            .toBe('Hej & välkommen\n\nalla');
    });

    it('gör <br> och blockslut till radbrytningar', () => {
        expect(cleanDescription('<p>Ett stycke.</p><p>Nästa stycke.</p>rad1<br>rad2'))
            .toBe('Ett stycke.\nNästa stycke.\nrad1\nrad2');
        expect(cleanDescription('a<br/>b<br />c')).toBe('a\nb\nc');
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
