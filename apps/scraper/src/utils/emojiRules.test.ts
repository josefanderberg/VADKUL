import { describe, it, expect } from 'vitest';
import { ruleEmojiFor } from './emojiRules';

describe('ruleEmojiFor', () => {
    it('bio vinner över allt', () => {
        expect(ruleEmojiFor('Discgolf-filmen (sv. tal)', 'Saga - Bio 3:an')).toBe('🎬');
    });
    it('aktivitet när ingen bio', () => {
        expect(ruleEmojiFor('KM Piteå discgolf', 'Norrfjärdens discgolfbana')).toBe('🥏');
    });
    it('null när ingen regel träffar', () => {
        expect(ruleEmojiFor('Konsert med Piteå Kammarkör', 'Studio Acusticum')).toBeNull();
    });
});
