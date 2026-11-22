import { describe, it, expect } from 'vitest';
import {
    compareRevealRank, favoritesFirst, isFavoriteEvent, parseFavoriteCategories, pickFavoriteFirst,
} from './favoriteCategories';

describe('parseFavoriteCategories', () => {
    it('tolkar en sparad lista', () => {
        expect(parseFavoriteCategories(JSON.stringify(['music', 'sport']))).toEqual(['music', 'sport']);
    });

    it('ger tom lista för null, skräp och fel typ', () => {
        expect(parseFavoriteCategories(null)).toEqual([]);
        expect(parseFavoriteCategories('inte json')).toEqual([]);
        expect(parseFavoriteCategories('42')).toEqual([]);
        expect(parseFavoriteCategories(JSON.stringify({ kats: ['music'] }))).toEqual([]);
    });

    it('filtrerar bort okända nycklar och dubbletter', () => {
        expect(parseFavoriteCategories(JSON.stringify(['music', 'finnsinte', 7, 'music']))).toEqual(['music']);
    });
});

describe('isFavoriteEvent', () => {
    const favs = new Set(['music', 'other']);

    it('träffar event i en vald kategori', () => {
        expect(isFavoriteEvent({ category: 'music', url: 'https://exempel.se/a' }, favs)).toBe(true);
        expect(isFavoriteEvent({ category: 'sport', url: 'https://exempel.se/b' }, favs)).toBe(false);
    });

    it('räknar okänd eller saknad kategori som Övrigt', () => {
        expect(isFavoriteEvent({ category: 'finnsinte', url: 'https://exempel.se/c' }, favs)).toBe(true);
        expect(isFavoriteEvent({ url: 'https://exempel.se/d' }, favs)).toBe(true);
        expect(isFavoriteEvent({ url: 'https://exempel.se/d' }, new Set(['music']))).toBe(false);
    });

    it('är aldrig sant utan favoriter', () => {
        expect(isFavoriteEvent({ category: 'music' }, new Set())).toBe(false);
        expect(isFavoriteEvent({ category: 'music' }, null)).toBe(false);
        expect(isFavoriteEvent({ category: 'music' }, undefined)).toBe(false);
    });

    it('räknar aldrig opt-in-källorna som favoriter', () => {
        expect(isFavoriteEvent({ category: 'music', url: 'https://www.svenskakyrkan.se/kalender?eventId=1' }, favs)).toBe(false);
    });
});

describe('favoritesFirst', () => {
    const fav = (s: string) => s.startsWith('f');

    it('lyfter favoriterna stabilt och lämnar resten i sin ordning', () => {
        expect(favoritesFirst(['a', 'f1', 'b', 'f2', 'c'], fav)).toEqual(['f1', 'f2', 'a', 'b', 'c']);
    });

    it('ändrar ingenting utan favoriter eller när allt är favoriter', () => {
        expect(favoritesFirst(['a', 'b', 'c'], fav)).toEqual(['a', 'b', 'c']);
        expect(favoritesFirst(['f2', 'f1'], fav)).toEqual(['f2', 'f1']);
        expect(favoritesFirst(['a', 'f1'], () => false)).toEqual(['a', 'f1']);
    });

    it('returnerar en ny lista', () => {
        const src = ['a', 'b'];
        expect(favoritesFirst(src, fav)).not.toBe(src);
    });
});

describe('pickFavoriteFirst', () => {
    type E = { id: string; fav: boolean };
    const isFav = (e: E) => e.fav;
    // "Närmast" = första obesökta i poolens ordning.
    const pickUnvisited = (visited: Set<string>) => (cands: E[]) => cands.find(e => !visited.has(e.id)) ?? null;
    const pool: E[] = [{ id: 'a', fav: false }, { id: 'f1', fav: true }, { id: 'b', fav: false }, { id: 'f2', fav: true }];

    it('tar favoriterna före övriga', () => {
        expect(pickFavoriteFirst(pool, isFav, pickUnvisited(new Set()))?.id).toBe('f1');
        expect(pickFavoriteFirst(pool, isFav, pickUnvisited(new Set(['f1'])))?.id).toBe('f2');
    });

    it('går vidare till övriga när favoriterna är genomgångna', () => {
        expect(pickFavoriteFirst(pool, isFav, pickUnvisited(new Set(['f1', 'f2'])))?.id).toBe('a');
        expect(pickFavoriteFirst(pool, isFav, pickUnvisited(new Set(['f1', 'f2', 'a'])))?.id).toBe('b');
    });

    it('ger null när allt är genomgånget', () => {
        expect(pickFavoriteFirst(pool, isFav, pickUnvisited(new Set(['a', 'b', 'f1', 'f2'])))).toBeNull();
    });

    it('är exakt det vanliga valet utan favoriter', () => {
        expect(pickFavoriteFirst(pool, () => false, pickUnvisited(new Set()))?.id).toBe('a');
        let calls = 0;
        pickFavoriteFirst(pool, () => false, c => { calls++; return c[0]; });
        expect(calls).toBe(1);
    });
});

describe('compareRevealRank', () => {
    it('populära först, sedan favoriter, sedan närmast', () => {
        const cands = [
            { key: 'nara', pop: false, fav: false, d2: 1 },
            { key: 'fav', pop: false, fav: true, d2: 9 },
            { key: 'favNara', pop: false, fav: true, d2: 4 },
            { key: 'pop', pop: true, fav: false, d2: 16 },
        ];
        expect([...cands].sort(compareRevealRank).map(c => c.key)).toEqual(['pop', 'favNara', 'fav', 'nara']);
    });

    it('utan favoriter gäller dagens ordning (populära, sedan närmast)', () => {
        const cands = [{ key: 'b', pop: false, d2: 2 }, { key: 'p', pop: true, d2: 5 }, { key: 'a', pop: false, d2: 1 }];
        expect([...cands].sort(compareRevealRank).map(c => c.key)).toEqual(['p', 'a', 'b']);
    });
});
