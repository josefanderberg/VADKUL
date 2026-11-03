import { describe, it, expect } from 'vitest';
import {
    gardagensTema, helgKlipp, nastaBudskapsvariant, valjKlipp, valjTema, veckodagFor, VECKOHJUL,
} from './teman';
import type { Klipp } from './typer';

const klipp = (over: Partial<Klipp> = {}): Klipp => ({
    fil: '2026-11-01-ikvall-1.mp4', tema: 'ikvall', status: 'ny', mottaget: 1, ...over,
});

// 2026-11-02 är en måndag.
const MAN = '2026-11-02', TIS = '2026-11-03', ONS = '2026-11-04', TOR = '2026-11-05',
    FRE = '2026-11-06', LOR = '2026-11-07', SON = '2026-11-08';

describe('veckodagFor och hjulet', () => {
    it('vet att 2/11 2026 är måndag och 8/11 söndag', () => {
        expect(veckodagFor(MAN)).toBe(1);
        expect(veckodagFor(SON)).toBe(0);
    });

    it('hjulet: mån siffra, tis video, ons gissa, tor helg, fre video, lör quiz, sön budskap', () => {
        expect([MAN, TIS, ONS, TOR, FRE, LOR, SON].map(d => VECKOHJUL[veckodagFor(d)]))
            .toEqual(['siffra', 'video', 'gissa', 'helg', 'video', 'quiz', 'budskap']);
    });
});

describe('valjKlipp', () => {
    it('tar första temat i prioriteten som har ett ledigt klipp', () => {
        const k = [klipp({ fil: 'a.mp4', tema: 'fredag' }), klipp({ fil: 'b.mp4', tema: 'ikvall' })];
        expect(valjKlipp(k, ['ikvall', 'fredag'])?.fil).toBe('b.mp4');
        expect(valjKlipp(k, ['fredag', 'ikvall'])?.fil).toBe('a.mp4');
    });

    it('hoppar över avvisade och använda klipp', () => {
        const k = [klipp({ fil: 'a.mp4', status: 'avvisad' }), klipp({ fil: 'b.mp4', status: 'använd' })];
        expect(valjKlipp(k)).toBeNull();
    });

    it('godkänt med högst betyg först, sedan äldst mottaget', () => {
        const k = [
            klipp({ fil: 'ny.mp4', mottaget: 1 }),
            klipp({ fil: 'bra.mp4', status: 'godkänd', betyg: 80, mottaget: 3 }),
            klipp({ fil: 'ok.mp4', status: 'godkänd', betyg: 72, mottaget: 2 }),
        ];
        expect(valjKlipp(k)?.fil).toBe('bra.mp4');
        const bara = [klipp({ fil: 'sen.mp4', mottaget: 9 }), klipp({ fil: 'tidig.mp4', mottaget: 2 })];
        expect(valjKlipp(bara)?.fil).toBe('tidig.mp4');
    });

    it('helgKlipp kräver rätt stad', () => {
        const k = [klipp({ fil: 'v.mp4', tema: 'helg', stad: 'vaxjo' })];
        expect(helgKlipp(k, 'vaxjo')?.fil).toBe('v.mp4');
        expect(helgKlipp(k, 'umea')).toBeNull();
    });
});

describe('valjTema', () => {
    it('följer hjulet när inget hindrar', () => {
        expect(valjTema(MAN, { klipp: [], tidigare: [] })).toMatchObject({ tema: 'siffra', form: 'bild', variant: 'vecka' });
        expect(valjTema(ONS, { klipp: [], tidigare: [] })).toMatchObject({ tema: 'gissa', form: 'bild' });
        expect(valjTema(TOR, { klipp: [], tidigare: [] })).toMatchObject({ tema: 'helg', form: 'bild' });
        expect(valjTema(LOR, { klipp: [], tidigare: [] })).toMatchObject({ tema: 'quiz', form: 'bild' });
        expect(valjTema(SON, { klipp: [], tidigare: [] })).toMatchObject({ tema: 'budskap', form: 'bild', variant: 'skapa-eget' });
    });

    it('videodag med klipp blir video, tisdag föredrar tidlöst och fredag stämning', () => {
        const k = [klipp({ fil: 'f.mp4', tema: 'fredag' }), klipp({ fil: 'i.mp4', tema: 'ikvall' })];
        const tis = valjTema(TIS, { klipp: k, tidigare: [] });
        expect(tis).toMatchObject({ tema: 'video', form: 'video', variant: 'ikvall' });
        expect(tis.klipp?.fil).toBe('i.mp4');
        expect(valjTema(FRE, { klipp: k, tidigare: [] }).klipp?.fil).toBe('f.mp4');
    });

    it('videodag utan klipp tar sin reserv: tisdag budskap, fredag siffra i helgen', () => {
        expect(valjTema(TIS, { klipp: [], tidigare: [] }))
            .toMatchObject({ tema: 'budskap', form: 'bild', variant: 'skapa-eget', reserv: true });
        expect(valjTema(FRE, { klipp: [], tidigare: [] }))
            .toMatchObject({ tema: 'siffra', form: 'bild', variant: 'helg', reserv: true });
    });

    it('aldrig samma tema som i går', () => {
        const tidigare = [{ id: MAN, tema: 'gissa' as const, status: 'publicerad' as const }];
        // Tisdag utan klipp skulle bli budskap; måndag var gissa, så budskap går bra.
        expect(valjTema(TIS, { klipp: [], tidigare }).tema).toBe('budskap');
        // Onsdag är gissa i hjulet, men gick i går (tisdag tvingad) -> reserv.
        const gissaIgar = [{ id: TIS, tema: 'gissa' as const, status: 'publicerad' as const }];
        const ons = valjTema(ONS, { klipp: [], tidigare: gissaIgar });
        expect(ons.tema).not.toBe('gissa');
        expect(ons.reserv).toBe(true);
    });

    it('ett vetat inlägg i går räknas inte som gårdagens tema', () => {
        const tidigare = [{ id: TIS, tema: 'gissa' as const, status: 'vetad' as const }];
        expect(gardagensTema(tidigare, ONS)).toBeNull();
        expect(valjTema(ONS, { klipp: [], tidigare }).tema).toBe('gissa');
    });

    it('vikt 0 stänger av ett tema', () => {
        const ons = valjTema(ONS, { klipp: [], tidigare: [], vikter: { gissa: 0 } });
        expect(ons.tema).not.toBe('gissa');
        expect(ons.reserv).toBe(true);
    });

    it('vikter rangordnar reserven', () => {
        const ons = valjTema(ONS, { klipp: [], tidigare: [], vikter: { gissa: 0, quiz: 5, siffra: 1 } });
        expect(ons.tema).toBe('quiz');
    });

    it('--tema= gäller rakt av, utom video utan klipp', () => {
        expect(valjTema(MAN, { klipp: [], tidigare: [], tvinga: 'quiz' })).toMatchObject({ tema: 'quiz', reserv: false });
        expect(valjTema(MAN, { klipp: [], tidigare: [], tvinga: 'video' })).toMatchObject({ tema: 'budskap', reserv: true });
    });

    it('helg bara torsdag och fredag', () => {
        const man = valjTema(MAN, { klipp: [], tidigare: [], vikter: { siffra: 0 } });
        expect(man.tema).not.toBe('helg');
    });

    it('budskap blir video när ett passande klipp finns, och milstolpe går före rotationen', () => {
        const k = [klipp({ fil: 's.mp4', tema: 'skapa-eget' })];
        const son = valjTema(SON, { klipp: k, tidigare: [] });
        expect(son).toMatchObject({ tema: 'budskap', form: 'video', variant: 'skapa-eget' });
        expect(valjTema(SON, { klipp: k, tidigare: [], milstolpe: true }))
            .toMatchObject({ tema: 'budskap', form: 'bild', variant: 'milstolpe' });
    });
});

describe('nastaBudskapsvariant', () => {
    it('roterar skapa-eget -> appen -> bjud-med -> skapa-eget', () => {
        expect(nastaBudskapsvariant([])).toBe('skapa-eget');
        const pub = (id: string, variant: string) => ({ id, tema: 'budskap' as const, variant, status: 'publicerad' as const });
        expect(nastaBudskapsvariant([pub('2026-10-25', 'skapa-eget')])).toBe('appen');
        expect(nastaBudskapsvariant([pub('2026-10-25', 'skapa-eget'), pub('2026-11-01', 'bjud-med')])).toBe('skapa-eget');
        expect(nastaBudskapsvariant([pub('2026-11-01', 'milstolpe'), pub('2026-10-25', 'appen')])).toBe('bjud-med');
    });
});
