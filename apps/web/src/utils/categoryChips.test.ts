import { describe, it, expect } from 'vitest';
import { planCategoryChips, categoryChipHref, activeCategorySlug, categoryPageMin } from './categoryChips';

const KEYS = ['music', 'family', 'sport', 'market', 'food'];

describe('planCategoryChips', () => {
    it('chips för kategorier med ≥3 event, undersida vid ≥5 i storstad', () => {
        const plan = planCategoryChips(KEYS, { music: 12, family: 5, sport: 4, market: 2, food: 0 }, false);
        expect(plan).toEqual([
            { dataKey: 'music', count: 12, hasPage: true },
            { dataKey: 'family', count: 5, hasPage: true },
            { dataKey: 'sport', count: 4, hasPage: false },
        ]);
    });

    it('småort: chippen finns från 3, undersidan först vid 10 (Borgholm-fallet)', () => {
        const plan = planCategoryChips(KEYS, { market: 6, food: 9, family: 2, music: 3 }, true);
        expect(plan.map(p => `${p.dataKey}:${p.hasPage}`)).toEqual(['music:false', 'market:false', 'food:false']);
        expect(planCategoryChips(KEYS, { family: 132 }, true)).toEqual([{ dataKey: 'family', count: 132, hasPage: true }]);
    });

    it('behåller kategoriordningen och tar Map lika gärna som objekt', () => {
        const m = new Map([['food', 7], ['music', 7]]);
        expect(planCategoryChips(KEYS, m, false).map(p => p.dataKey)).toEqual(['music', 'food']);
    });

    it('trösklarna per stadstyp', () => {
        expect(categoryPageMin(false)).toBe(5);
        expect(categoryPageMin(true)).toBe(10);
        expect(categoryPageMin(undefined)).toBe(5);
    });
});

describe('categoryChipHref', () => {
    it('undersidan när den finns, annars stadssidan med fråga', () => {
        expect(categoryChipHref('borgholm', 'marknader', true)).toBe('/evenemang/borgholm/marknader');
        expect(categoryChipHref('borgholm', 'marknader', false)).toBe('/evenemang/borgholm?kategori=marknader');
    });
});

describe('activeCategorySlug', () => {
    it('läser undersidans segment', () => {
        expect(activeCategorySlug('/evenemang/stockholm/barn', '', 'stockholm')).toBe('barn');
    });

    it('läser ?kategori= på stadssidan', () => {
        expect(activeCategorySlug('/evenemang/borgholm', '?kategori=marknader', 'borgholm')).toBe('marknader');
        expect(activeCategorySlug('/evenemang/borgholm', '?kategori=&x=1', 'borgholm')).toBeNull();
    });

    it('stadssidan utan fråga = alla; annan stad = null', () => {
        expect(activeCategorySlug('/evenemang/borgholm', '', 'borgholm')).toBeNull();
        expect(activeCategorySlug('/evenemang/stockholm/barn', '', 'borgholm')).toBeNull();
        expect(activeCategorySlug('/', '?kategori=barn', 'borgholm')).toBeNull();
    });
});
