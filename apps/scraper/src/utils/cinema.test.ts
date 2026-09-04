import { describe, it, expect } from 'vitest';
import { looksLikeCinema, withCinemaEmoji } from './cinema';

describe('looksLikeCinema', () => {
    it('platsen avslöjar biografen', () => {
        expect(looksLikeCinema('The Invite', 'Röda Kvarn - Bio 3:an')).toBe(true);
        expect(looksLikeCinema('One Night Only', 'Salong Lillan - Garvaren Bio')).toBe(true);
        expect(looksLikeCinema('The Invite', 'Biocafé Tellus')).toBe(true);
        expect(looksLikeCinema('Dokumentär: Strejkarna', 'Bio Röda Kvarn')).toBe(true);
        expect(looksLikeCinema('Vaiana', 'Filmstaden Lund')).toBe(true);
    });
    it('titeln avslöjar filmen', () => {
        expect(looksLikeCinema('Minioner & Monster (Sv. tal)', 'Saga')).toBe(true);
        expect(looksLikeCinema('Carola! (Tal: Svenska) (Text: Svenska)', '')).toBe(true);
        expect(looksLikeCinema('Biopremiär – One Night Only', 'Västervik')).toBe(true);
    });
    it('inte konserter/teater i kulturhus som råkar heta Röda Kvarn', () => {
        expect(looksLikeCinema('Anna och Ale Möller', 'Röda Kvarn Ideella Kulturförening Ljusdal')).toBe(false);
        expect(looksLikeCinema('Barnlördag – Bludderblad', 'Studio Acusticum, Black Box')).toBe(false);
        expect(looksLikeCinema('Biologins dag', 'Naturum')).toBe(false);
        expect(looksLikeCinema('', '')).toBe(false);
    });
});

describe('withCinemaEmoji', () => {
    it('byter till 🎬 för biovisningar och lämnar andra', () => {
        expect(withCinemaEmoji('🎭', 'The Invite', 'Metropol - Bio 3:an')).toBe('🎬');
        expect(withCinemaEmoji('🎸', 'Konsert', 'Konserthuset')).toBe('🎸');
        expect(withCinemaEmoji(null, 'Konsert', 'Konserthuset')).toBeNull();
    });
});
