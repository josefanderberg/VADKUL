import { describe, it, expect } from 'vitest';
import {
    FORTUR_MAX_AGE_MS,
    forturPost,
    franFromSearch,
    parsePendingFortur,
    serializePendingFortur,
} from './forturInbjudan';
import { eventShareSlug } from './eventShareSlug';

const NOW = 1_790_000_000_000;
const INBJUDARE = 'Abc123Def456Ghi789Jkl012Mn';
const INBJUDEN = 'Zyx987Wvu654Tsr321Qpo098Lk';
const SLUG = eventShareSlug('https://ex.se/event/1');

describe('franFromSearch', () => {
    it('läser inbjudarens uid ur Bjud med-länken', () => {
        expect(franFromSearch(`?event=x&inb=1&fran=${INBJUDARE}`)).toBe(INBJUDARE);
    });

    it('fungerar på vilken länk som helst, utan inb=1', () => {
        expect(franFromSearch(`?fran=${INBJUDARE}`)).toBe(INBJUDARE);
    });

    it('ger null utan fran eller med trasigt värde', () => {
        expect(franFromSearch('')).toBeNull();
        expect(franFromSearch('?inb=1')).toBeNull();
        expect(franFromSearch('?fran=kort')).toBeNull();
        expect(franFromSearch('?fran=abc%20123def456')).toBeNull();
        expect(franFromSearch(`?fran=${'a'.repeat(65)}`)).toBeNull();
    });
});

describe('parsePendingFortur', () => {
    it('tolkar en sparad inbjudan', () => {
        expect(parsePendingFortur(serializePendingFortur(INBJUDARE, NOW), NOW))
            .toEqual({ fran: INBJUDARE, at: NOW });
    });

    it('ger null för null/skräp/fel typ', () => {
        expect(parsePendingFortur(null, NOW)).toBeNull();
        expect(parsePendingFortur('inte json', NOW)).toBeNull();
        expect(parsePendingFortur('42', NOW)).toBeNull();
        expect(parsePendingFortur(JSON.stringify({ fran: INBJUDARE }), NOW)).toBeNull();
        expect(parsePendingFortur(JSON.stringify({ fran: 'x y', at: NOW }), NOW)).toBeNull();
    });

    it('respekterar månadsgränsen', () => {
        const raw = serializePendingFortur(INBJUDARE, NOW);
        expect(parsePendingFortur(raw, NOW + FORTUR_MAX_AGE_MS)).not.toBeNull();
        expect(parsePendingFortur(raw, NOW + FORTUR_MAX_AGE_MS + 1)).toBeNull();
    });
});

describe('forturPost', () => {
    const pending = { fran: INBJUDARE, at: NOW };

    it('bokför ett nytt konto per par (inbjuden, inbjudare)', () => {
        expect(forturPost(pending, INBJUDEN, 'konto')).toEqual({
            id: `${INBJUDEN}_${INBJUDARE}`,
            data: { inbjuden: INBJUDEN, fran: INBJUDARE, typ: 'konto' },
        });
    });

    it('bokför ett svar med eventets slug', () => {
        expect(forturPost(pending, INBJUDEN, 'svar', SLUG)).toEqual({
            id: `${INBJUDEN}_${INBJUDARE}`,
            data: { inbjuden: INBJUDEN, fran: INBJUDARE, typ: 'svar', eventSlug: SLUG },
        });
    });

    it('konto bär aldrig eventSlug (reglerna nekar det)', () => {
        expect(forturPost(pending, INBJUDEN, 'konto', SLUG)?.data).not.toHaveProperty('eventSlug');
    });

    it('ingen väntande inbjudan = inget att bokföra', () => {
        expect(forturPost(null, INBJUDEN, 'konto')).toBeNull();
        expect(forturPost(null, INBJUDEN, 'svar', SLUG)).toBeNull();
    });

    it('egen länk räknas inte', () => {
        expect(forturPost(pending, INBJUDARE, 'konto')).toBeNull();
        expect(forturPost(pending, INBJUDARE, 'svar', SLUG)).toBeNull();
    });

    it('svar kräver ett giltigt event-slug', () => {
        expect(forturPost(pending, INBJUDEN, 'svar')).toBeNull();
        expect(forturPost(pending, INBJUDEN, 'svar', 'https://ex.se/event/1')).toBeNull();
        expect(forturPost(pending, INBJUDEN, 'svar', '0123456789ABCDEF')).toBeNull();
    });

    it('slug-mönstret matchar eventShareSlug (samma som i reglerna)', () => {
        expect(SLUG).toMatch(/^[0-9a-f]{16}$/);
    });
});
