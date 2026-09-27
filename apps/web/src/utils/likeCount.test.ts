import { describe, it, expect } from 'vitest';
import { displayedLikeCount } from './likeCount';

describe('displayedLikeCount', () => {
    it('oförändrat läge visar serverns bas rakt av', () => {
        expect(displayedLikeCount(5, false, false)).toBe(5);
        expect(displayedLikeCount(5, true, true)).toBe(5);
        expect(displayedLikeCount(0, false, false)).toBe(0);
    });

    it('gillning efter hämtningen bumpar +1 direkt', () => {
        expect(displayedLikeCount(5, false, true)).toBe(6);
        expect(displayedLikeCount(0, false, true)).toBe(1);
    });

    it('avgillning efter hämtningen backar -1 direkt', () => {
        expect(displayedLikeCount(5, true, false)).toBe(4);
    });

    it('går aldrig under noll (avgillning vars +1 aldrig nådde servern)', () => {
        expect(displayedLikeCount(0, true, false)).toBe(0);
    });

    it('toggle fram och tillbaka landar på basen igen', () => {
        // gilla → ångra inom samma kortöppning: savedNow === savedAtFetch.
        expect(displayedLikeCount(3, false, false)).toBe(3);
    });
});
