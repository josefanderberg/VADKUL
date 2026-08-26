import { describe, it, expect } from 'vitest';
import { toggleCategory } from './categoryToggle';

describe('toggleCategory', () => {
    it('kryssar i och ur en vanlig kategori', () => {
        const on = toggleCategory(new Set(), 'music');
        expect([...on]).toEqual(['music']);
        expect([...toggleCategory(on, 'music')]).toEqual([]);
    });

    it('PÅ-slag av vanlig kategori släcker opt-in-källorna (Josef 26/8)', () => {
        const prev = new Set(['pro', 'svenskakyrkan']);
        expect([...toggleCategory(prev, 'music')].sort()).toEqual(['music']);
    });

    it('släcker 🧸 bara i familj-opt-in-läget', () => {
        const prev = new Set(['pro', 'family']);
        expect([...toggleCategory(prev, 'music', { familyOptIn: true })].sort())
            .toEqual(['music']);
        // Utan opt-in-läget är family en vanlig kategori och står kvar.
        expect([...toggleCategory(prev, 'music')].sort())
            .toEqual(['family', 'music']);
    });

    it('flerval av vanliga kategorier lever kvar', () => {
        const prev = new Set(['music', 'svenskakyrkan']);
        expect([...toggleCategory(prev, 'sports')].sort()).toEqual(['music', 'sports']);
    });

    it('PÅ-slag av opt-in-källa rör inte normal-valet ("PRO OCKSÅ")', () => {
        const prev = new Set(['music']);
        expect([...toggleCategory(prev, 'pro')].sort()).toEqual(['music', 'pro']);
    });

    it('🧸 i opt-in-läget beter sig som en opt-in-källa vid PÅ-slag', () => {
        const prev = new Set(['pro']);
        expect([...toggleCategory(prev, 'family', { familyOptIn: true })].sort())
            .toEqual(['family', 'pro']);
    });

    it('ur-kryss släcker aldrig något annat', () => {
        const prev = new Set(['music', 'pro']);
        expect([...toggleCategory(prev, 'music')].sort()).toEqual(['pro']);
    });

    it('muterar inte inskickade setet', () => {
        const prev = new Set(['pro']);
        toggleCategory(prev, 'music');
        expect([...prev]).toEqual(['pro']);
    });
});
