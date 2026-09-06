import { describe, it, expect } from 'vitest';
import { composeSpotlightRows, spotDistKm, spotWhen, spotFrame, SPOTLIGHT_MAX_BOOSTED, SPOTLIGHT_MAX_VADKUL } from './citySpotlight';

const NOW = new Date('2026-09-04T18:00:00Z').getTime();
const at = (h: number) => new Date(NOW + h * 36e5).toISOString();
const ev = (id: string, time: string) => ({ id, title: id, time });

describe('composeSpotlightRows', () => {
    it('boost vinner över vadkul och dubbletter hamnar bara i boost-nivån', () => {
        const user = [ev('u1', at(2)), ev('u2', at(4))];
        const statics = [ev('s1', at(1)), ev('s2', at(3))];
        const { boosted, vadkul } = composeSpotlightRows(user, statics, new Set(['u1', 's2']), NOW);
        expect(boosted.map(e => e.id)).toEqual(['u1', 's2']);
        expect(boosted.find(e => e.id === 'u1')).toMatchObject({ vadkul: true, boosted: true });
        expect(boosted.find(e => e.id === 's2')).toMatchObject({ vadkul: false, boosted: true });
        // u1 får inte dubblera i vadkul-nivån; s1 (extern, oboostat) hör inte hemma alls.
        expect(vadkul.map(e => e.id)).toEqual(['u2']);
    });

    it('filtrerar passerade event men behåller nyss startade (1 h-fönstret)', () => {
        const user = [ev('gammal', at(-3)), ev('nyss', at(-0.5)), ev('snart', at(1))];
        const { vadkul } = composeSpotlightRows(user, [], new Set(), NOW);
        expect(vadkul.map(e => e.id)).toEqual(['nyss', 'snart']);
    });

    it('respekterar nivåernas tak', () => {
        const user = Array.from({ length: 10 }, (_, i) => ev(`u${i}`, at(i + 1)));
        const boostedIds = new Set(user.slice(0, 6).map(e => e.id));
        const { boosted, vadkul } = composeSpotlightRows(user, [], boostedIds, NOW);
        expect(boosted.length).toBe(SPOTLIGHT_MAX_BOOSTED);
        expect(vadkul.length).toBeLessThanOrEqual(SPOTLIGHT_MAX_VADKUL);
    });
});

describe('spotDistKm', () => {
    it('Piteå–Boden är ~57 km, samma punkt är 0', () => {
        expect(spotDistKm(65.317, 21.479, 65.317, 21.479)).toBe(0);
        const d = spotDistKm(65.317, 21.479, 65.825, 21.689);
        expect(d).toBeGreaterThan(50);
        expect(d).toBeLessThan(65);
    });
});

describe('spotWhen', () => {
    it('idag/imorgon/veckodag och midnatt utan klockslag', () => {
        expect(spotWhen(at(1), NOW)).toMatch(/^Idag /);
        expect(spotWhen(at(26), NOW)).toMatch(/^Imorgon /);
        expect(spotWhen('2026-09-12T15:00:00Z', NOW)).toMatch(/12 sep/);
        // Lokal midnatt (22:00Z sommartid) = datum utan klockslag.
        expect(spotWhen('2026-09-11T22:00:00Z', NOW)).not.toMatch(/\d\d:\d\d/);
    });
});

describe('spotFrame', () => {
    it('guld vinner över grön, grön över blå, tips är blå', () => {
        expect(spotFrame({ boosted: true, hosted: true })).toBe('gold');
        expect(spotFrame({ boosted: false, hosted: true })).toBe('hosted');
        expect(spotFrame({ boosted: false, hosted: false })).toBe('tip');
    });

    it('hosted följer med raden genom composeSpotlightRows', () => {
        const { vadkul } = composeSpotlightRows([{ ...ev('u1', at(1)), hosted: true }], [], new Set(), NOW);
        expect(vadkul[0]).toMatchObject({ hosted: true, vadkul: true, boosted: false });
    });
});
