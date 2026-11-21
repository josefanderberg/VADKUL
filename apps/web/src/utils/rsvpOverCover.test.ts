import { describe, expect, it } from 'vitest';
import { plateOverCover } from './rsvpOverCover';

describe('plateOverCover', () => {
    const cover = { top: 200, bottom: 424 }; // h-56

    it('är sann när hela raden ligger inom bilden', () => {
        expect(plateOverCover({ top: 270, bottom: 322 }, cover)).toBe(true);
    });

    it('tål ett par pixlars avrundning i kanterna', () => {
        expect(plateOverCover({ top: 373, bottom: 425 }, cover)).toBe(true);
    });

    it('är sann redan när raden sticker upp över bildens överkant', () => {
        expect(plateOverCover({ top: 180, bottom: 232 }, cover)).toBe(true);
    });

    it('är sann medan arket växer och raden ännu står ovanför bilden', () => {
        expect(plateOverCover({ top: 120, bottom: 172 }, cover)).toBe(true);
    });

    it('är falsk när raden sticker ner under bilden, mot beskrivningen', () => {
        expect(plateOverCover({ top: 390, bottom: 442 }, cover)).toBe(false);
    });

    it('är falsk när raden ligger helt under bilden', () => {
        expect(plateOverCover({ top: 600, bottom: 652 }, cover)).toBe(false);
    });

    it('är falsk utan bild eller utan rad', () => {
        expect(plateOverCover({ top: 270, bottom: 322 }, null)).toBe(false);
        expect(plateOverCover(null, cover)).toBe(false);
    });

    it('är falsk för en bild utan höjd (trasig länk, ännu inte utritad)', () => {
        expect(plateOverCover({ top: 200, bottom: 200 }, { top: 200, bottom: 200 })).toBe(false);
        expect(plateOverCover({ top: 270, bottom: 322 }, { top: 300, bottom: 300 })).toBe(false);
    });
});
