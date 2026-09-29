import { describe, expect, it } from 'vitest';
import { nextFront, overlapClusters, type OverlapPoint } from './overlapCycle';

const pt = (key: string, x: number, y: number, sortKey = 1): OverlapPoint => ({ key, x, y, sortKey });

describe('overlapClusters', () => {
    it('ger inga kluster när brickorna står isär', () => {
        expect(overlapClusters([pt('a', 0, 0), pt('b', 100, 0)], 30)).toEqual([]);
    });

    it('tom lista och ensam punkt ger inga kluster', () => {
        expect(overlapClusters([], 30)).toEqual([]);
        expect(overlapClusters([pt('a', 0, 0)], 30)).toEqual([]);
    });

    it('två brickor inom radien bildar en hög', () => {
        const clusters = overlapClusters([pt('a', 0, 0), pt('b', 10, 10)], 30);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].members).toEqual(['a', 'b']);
    });

    it('exakt på radien räknas som överlapp', () => {
        expect(overlapClusters([pt('a', 0, 0), pt('b', 30, 0)], 30)).toHaveLength(1);
        expect(overlapClusters([pt('a', 0, 0), pt('b', 31, 0)], 30)).toHaveLength(0);
    });

    it('id och medlemsordning är oberoende av punktlistans ordning', () => {
        const abc = [pt('a', 0, 0, 3), pt('b', 5, 5, 1), pt('c', 10, 0, 2)];
        const first = overlapClusters(abc, 30);
        const second = overlapClusters([...abc].reverse(), 30);
        expect(first).toEqual(second);
        expect(first[0].id).toBe('a|b|c');
    });

    it('medlemmarna sorteras i stapelordning: fallande sortKey, sedan nyckel', () => {
        const clusters = overlapClusters(
            [pt('ensam', 0, 0, 1), pt('hog', 5, 5, 4), pt('lika', 10, 0, 1)],
            30,
        );
        expect(clusters[0].members).toEqual(['hog', 'ensam', 'lika']);
        expect(clusters[0].topKey).toBe('hog');
    });

    it('kedjor räknas ihop: A nära B och B nära C ger en trio', () => {
        const clusters = overlapClusters(
            [pt('a', 0, 0), pt('b', 25, 0), pt('c', 50, 0)],
            30,
        );
        expect(clusters).toHaveLength(1);
        expect(clusters[0].members).toHaveLength(3);
    });

    it('skilda högar blir egna kluster i stabil id-ordning', () => {
        const clusters = overlapClusters(
            [pt('x', 500, 500), pt('y', 510, 500), pt('a', 0, 0), pt('b', 10, 0)],
            30,
        );
        expect(clusters.map(c => c.id)).toEqual(['a|b', 'x|y']);
    });

    it('en punkt utan granne inom radien lämnas utanför kluster', () => {
        const clusters = overlapClusters(
            [pt('a', 0, 0), pt('b', 10, 0), pt('ensam', 200, 200)],
            30,
        );
        expect(clusters).toHaveLength(1);
        expect(clusters[0].members).not.toContain('ensam');
    });
});

describe('nextFront', () => {
    const cluster = { id: 'a|b|c', members: ['a', 'b', 'c'], topKey: 'a' };

    it('utan känd front går turen till medlem två (toppen syns redan)', () => {
        expect(nextFront(cluster, null)).toBe('b');
        expect(nextFront(cluster, undefined)).toBe('b');
    });

    it('okänd front (försvunnen ur högen) behandlas som ingen', () => {
        expect(nextFront(cluster, 'finns-ej')).toBe('b');
    });

    it('roterar genom alla medlemmar och varvar runt via toppen', () => {
        expect(nextFront(cluster, 'b')).toBe('c');
        expect(nextFront(cluster, 'c')).toBe('a');
        expect(nextFront(cluster, 'a')).toBe('b');
    });

    it('tvåmedlemshög pendlar mellan medlemmarna', () => {
        const pair = { id: 'a|b', members: ['a', 'b'], topKey: 'a' };
        expect(nextFront(pair, null)).toBe('b');
        expect(nextFront(pair, 'b')).toBe('a');
        expect(nextFront(pair, 'a')).toBe('b');
    });
});
