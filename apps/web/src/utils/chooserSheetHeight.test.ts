import { describe, expect, it } from 'vitest';
import { chooserDefaultTargetPx } from './chooserSheetHeight';

describe('chooserDefaultTargetPx', () => {
    it('visar hela innehållet när det ryms i budgeten', () => {
        // 2 rader + "har varit"-knapp = 267 px → kortet blir exakt så högt.
        expect(chooserDefaultTargetPx([165, 228], 267, 300)).toBe(267);
    });

    it('tar så många hela rader som ryms (dagsläget: 3 rader)', () => {
        expect(chooserDefaultTargetPx([165, 228, 290, 353, 415], 600, 300)).toBe(290);
    });

    it('räknar in dagrubriken — i veckovyn ryms bara 2 rader', () => {
        expect(chooserDefaultTargetPx([217, 279, 342, 404], 800, 300)).toBe(279);
    });

    it('visar alltid minst en rad även om den spränger budgeten', () => {
        expect(chooserDefaultTargetPx([320, 380], 900, 300)).toBe(320);
    });

    it('faller tillbaka på budgeten utan rader', () => {
        expect(chooserDefaultTargetPx([], 900, 300)).toBe(300);
    });

    it('rad som slutar exakt på budgeten räknas som rymd', () => {
        expect(chooserDefaultTargetPx([150, 300, 450], 900, 300)).toBe(300);
    });
});
