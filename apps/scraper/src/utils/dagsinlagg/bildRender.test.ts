import { describe, it, expect } from 'vitest';
import { emojiKod, twemojiSvgPath } from './bildRender';

describe('emojiKod', () => {
    it('följer twemojis namngivning', () => {
        expect(emojiKod('🗓️')).toBe('1f5d3');
        expect(emojiKod('☁️')).toBe('2601');
        expect(emojiKod('1️⃣')).toBe('31-20e3');
        expect(emojiKod('🎸')).toBe('1f3b8');
        expect(emojiKod('👨‍👩‍👧')).toBe('1f468-200d-1f469-200d-1f467');
    });

    it('hittar svg-filerna lokalt för kortens emojis', () => {
        for (const e of ['🗓️', '📍', '✨', '☁️', '1️⃣', '2️⃣', '3️⃣', '🎸', '🧠', '🏒', '🎭', '🛍️', '🍽️', '🧸']) {
            expect(twemojiSvgPath(e), e).not.toBeNull();
        }
    });
});
