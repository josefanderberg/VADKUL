import { describe, it, expect } from 'vitest';
import { activityEmojiFor } from './activityEmoji';

describe('activityEmojiFor', () => {
    it('discgolf/frisbee → 🥏 (inte ⛳/⚽)', () => {
        expect(activityEmojiFor('KM Piteå discgolf')).toBe('🥏');
        expect(activityEmojiFor('Disc golf-kväll på Norrfjärden')).toBe('🥏');
        expect(activityEmojiFor('Frisbeegolf för nybörjare')).toBe('🥏');
    });

    it('smalare sporter får sin egen', () => {
        expect(activityEmojiFor('Orienteringsträning tisdag')).toBe('🧭');
        expect(activityEmojiFor('Padelturnering dubbel')).toBe('🎾');
        expect(activityEmojiFor('Pingis drop-in')).toBe('🏓');
        expect(activityEmojiFor('Simskola för barn')).toBe('🏊');
        expect(activityEmojiFor('Skridskodisco i ishallen')).toBe('⛸️');
        expect(activityEmojiFor('Schack på biblioteket')).toBe('♟️');
    });

    it('innebandy → 🏑, hockeyligor i titeln → 🏒 (aggregatet 15/9: ⚽/🏃/🥒)', () => {
        expect(activityEmojiFor('Testa på Innebandy')).toBe('🏑');
        expect(activityEmojiFor('Innebandykul 5-9 år')).toBe('🏑');
        expect(activityEmojiFor('Innebandy, SSL Mullsjö AIS - Visby IBK')).toBe('🏑');
        expect(activityEmojiFor('SDHL: LHC – Skellefteå AIK')).toBe('🏒');
        expect(activityEmojiFor('Brynäs IF - HV 71 SDHL')).toBe('🏒');
        expect(activityEmojiFor('Växjö Vipers – Team Thorengruppen')).toBeNull();   // lagnamn ensamma → leagueSport via url
    });

    it('ordgränser: "bad" ≠ badminton, "golf" ≠ discgolf, ingen träff på vanlig text', () => {
        expect(activityEmojiFor('Badminton drop-in')).toBe('🏸');
        expect(activityEmojiFor('Golfens dag på Skellefteå GK')).toBeNull();     // vanlig golf lämnas åt auditen (⛳)
        expect(activityEmojiFor('Konsert i kyrkan')).toBeNull();
        expect(activityEmojiFor('Tennisbanan är stängd')).toBe('🎾');
        expect(activityEmojiFor('')).toBeNull();
        expect(activityEmojiFor(null)).toBeNull();
    });
});
