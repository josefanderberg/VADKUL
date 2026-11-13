import { describe, expect, it } from 'vitest';
import { cardSelectionKind } from './cardSelectionKind';

const base = { prevId: 'a', id: 'b', isPickNext: false, isDayStepLanding: false, isListPick: false };

describe('cardSelectionKind (#226)', () => {
    it('kartklick på ett annat event är ett nytt val', () => {
        expect(cardSelectionKind(base)).toBe('fresh');
    });

    it('första valet (kortet var stängt) är ett nytt val, även på samma event som sist', () => {
        expect(cardSelectionKind({ ...base, prevId: null, id: 'a' })).toBe('fresh');
    });

    it('samma event med ett färskare objekt är inget val - historiken står kvar', () => {
        // Sidan pekar om det öppna kortet när bild/värd/beskrivning landar.
        expect(cardSelectionKind({ ...base, prevId: 'a', id: 'a' })).toBe('refresh');
    });

    it('kortets egen Nästa/Bakåt är intern navigering', () => {
        expect(cardSelectionKind({ ...base, isPickNext: true })).toBe('internal');
        expect(cardSelectionKind({ ...base, prevId: 'a', id: 'a', isPickNext: true })).toBe('internal');
    });

    it('landningen efter kortets dagbyte och val ur kortets lista behåller stackarna', () => {
        expect(cardSelectionKind({ ...base, isDayStepLanding: true })).toBe('landing');
        expect(cardSelectionKind({ ...base, isListPick: true })).toBe('landing');
        // Landar dagbytet på samma event (flerdagarsevent) är det fortfarande en landning.
        expect(cardSelectionKind({ ...base, prevId: 'a', id: 'a', isDayStepLanding: true })).toBe('landing');
    });
});
