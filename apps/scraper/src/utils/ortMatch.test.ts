import { describe, it, expect } from 'vitest';
import { matchOrt } from './ortMatch';

interface Town { key: string; name: string }
const towns: Town[] = [
    { key: 'hedemora', name: 'Hedemora' },
    { key: 'mora', name: 'Mora' },
    { key: 'sundsvalls-kommun', name: 'Sundsvall' },
    { key: 'ostersund', name: 'Östersund' },
];
const keys = (t: Town) => [t.key, t.name.toLowerCase()];

describe('matchOrt', () => {
    it('exakt träff vinner över substring — Mora får inte bli Hedemora', () => {
        expect(matchOrt(towns, 'mora', keys)).toEqual([{ key: 'mora', name: 'Mora' }]);
    });

    it('substring-fallback när ingen exakt träff finns', () => {
        expect(matchOrt(towns, 'sundsvalls-kom', keys)).toEqual([
            { key: 'sundsvalls-kommun', name: 'Sundsvall' },
        ]);
    });

    it('exakt träff på ENDERA nyckeln räcker (key eller namn)', () => {
        // "sundsvall" är exakt lika med namnet fast inte med key:n.
        expect(matchOrt(towns, 'sundsvall', keys)).toEqual([
            { key: 'sundsvalls-kommun', name: 'Sundsvall' },
        ]);
    });

    it('skiftlägesokänsligt åt båda håll', () => {
        expect(matchOrt(towns, 'MORA', keys)).toEqual([{ key: 'mora', name: 'Mora' }]);
        expect(matchOrt(towns, 'östersund', keys)).toEqual([{ key: 'ostersund', name: 'Östersund' }]);
    });

    it('alla exakta träffar returneras, inte bara den första', () => {
        const dubbel = [...towns, { key: 'mora-kommun', name: 'Mora' }];
        expect(matchOrt(dubbel, 'mora', keys).map(t => t.key)).toEqual(['mora', 'mora-kommun']);
    });

    it('tom array när inget matchar', () => {
        expect(matchOrt(towns, 'kiruna', keys)).toEqual([]);
    });
});
