import { describe, expect, it } from 'vitest';
import { valideraMeProfilIn } from './konto';

describe('valideraMeProfilIn', () => {
    it('släpper igenom en giltig kropp och trimmar namnet', () => {
        expect(valideraMeProfilIn({ displayName: '  Anna   Berg ', age: 34, gender: 'kvinna', citySlug: 'umea', hasChildren: true }))
            .toEqual({ ok: true, värde: { displayName: 'Anna Berg', age: 34, gender: 'kvinna', citySlug: 'umea', hasChildren: true } });
    });
    it('tom kropp är giltig (PUT slår ihop)', () => {
        expect(valideraMeProfilIn({})).toEqual({ ok: true, värde: {} });
    });
    it('null rensar staden', () => {
        expect(valideraMeProfilIn({ citySlug: null })).toEqual({ ok: true, värde: { citySlug: null } });
    });
    it('avvisar okända och servergivna fält', () => {
        expect(valideraMeProfilIn({ starsAvailable: 5 })).toMatchObject({ ok: false });
        expect(valideraMeProfilIn({ isVerified: true })).toMatchObject({ ok: false });
    });
    it('avvisar trasiga värden', () => {
        expect(valideraMeProfilIn({ displayName: '   ' })).toMatchObject({ ok: false });
        expect(valideraMeProfilIn({ displayName: 'x'.repeat(61) })).toMatchObject({ ok: false });
        expect(valideraMeProfilIn({ age: 12 })).toMatchObject({ ok: false });
        expect(valideraMeProfilIn({ age: 30.5 })).toMatchObject({ ok: false });
        expect(valideraMeProfilIn({ gender: 'robot' })).toMatchObject({ ok: false });
        expect(valideraMeProfilIn({ citySlug: 'atlantis' })).toMatchObject({ ok: false });
        expect(valideraMeProfilIn({ hasChildren: 'ja' })).toMatchObject({ ok: false });
        expect(valideraMeProfilIn(null)).toMatchObject({ ok: false });
        expect(valideraMeProfilIn([])).toMatchObject({ ok: false });
    });
});
