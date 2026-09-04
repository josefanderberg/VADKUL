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

    it('ordgränser: "bad" ≠ badminton, "golf" ≠ discgolf, ingen träff på vanlig text', () => {
        expect(activityEmojiFor('Badminton drop-in')).toBe('🏸');
        expect(activityEmojiFor('Golfens dag på Skellefteå GK')).toBeNull();     // vanlig golf lämnas åt auditen (⛳)
        expect(activityEmojiFor('Konsert i kyrkan')).toBeNull();
        expect(activityEmojiFor('Tennisbanan är stängd')).toBe('🎾');
        expect(activityEmojiFor('')).toBeNull();
        expect(activityEmojiFor(null)).toBeNull();
    });
});
