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
    it('ligamatch via url mot riktiga registryt — titeln bär bara lagnamn', () => {
        expect(ruleEmojiFor('Växjö Vipers – Team Thorengruppen', 'Fortnox Arena', 'https://www.ssl.se/match/ef6unkoa54')).toBe('🏑');
        expect(ruleEmojiFor('Djurgårdens IF – Björklöven', null, 'https://www.shl.se/match/wza53fczpy')).toBe('🏒');
        expect(ruleEmojiFor('Visby Ladies – Norrköping Dolphins', null, 'https://www.sbldam.se/match/jaet6rlsxo')).toBe('🏀');
        expect(ruleEmojiFor('Brynäs IF – Frölunda HC', null, 'https://stats.swehockey.se/ScheduleAndResults/Schedule/20961?game=1')).toBe('🏒');
        expect(ruleEmojiFor('IFK Göteborg – AIK', null, 'https://allsvenskan.se/matcher/2026/123')).toBe('⚽');
    });
    it('utan url faller den tillbaka på titelreglerna', () => {
        expect(ruleEmojiFor('Växjö Vipers – Team Thorengruppen', 'Fortnox Arena')).toBeNull();
    });
});
