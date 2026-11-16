import { describe, it, expect } from 'vitest';
import { osmNames } from './seed-venues-overpass';

describe('osmNames (#247: arenornas sponsornamn)', () => {
    it('namn, alternativa och gamla namn, utan dubbletter', () => {
        expect(osmNames({ name: 'CYLOQ Arena', old_name: 'Sollentuna Ishall;Sollentunahallen', alt_name: 'cyloq arena' }))
            .toEqual(['CYLOQ Arena', 'Sollentuna Ishall', 'Sollentunahallen']);
        expect(osmNames({ leisure: 'ice_rink' })).toEqual([]);
        expect(osmNames(undefined)).toEqual([]);
    });
});
