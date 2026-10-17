import { describe, expect, it } from 'vitest';
import { hittaStötandeOrd, ORDFILTER_STOPP } from './chattfilter';

describe('hittaStötandeOrd', () => {
    it('släpper igenom vanliga meddelanden', () => {
        expect(hittaStötandeOrd('Vi ses vid scenen kl 19!')).toBeNull();
        expect(hittaStötandeOrd('Jävla kul event, fan vad bra det var')).toBeNull();
        expect(hittaStötandeOrd('')).toBeNull();
    });

    it('stoppar svenska tillmälen som egna ord', () => {
        expect(hittaStötandeOrd('din jävla hora')).toBe('hora');
        expect(hittaStötandeOrd('vilken fitta han är')).toBe('fitta');
        expect(hittaStötandeOrd('håll käften din slampa')).toBe('slampa');
    });

    it('stoppar slurs även i sammansättningar och med mellanslag', () => {
        expect(hittaStötandeOrd('jävla negerjävlar')).toBe('negerjäv');
        expect(hittaStötandeOrd('n i g g e r')).toBe('nigger');
        expect(hittaStötandeOrd('era svartskallar')).toBe('svartskall');
    });

    it('stoppar engelska tillmälen', () => {
        expect(hittaStötandeOrd('fuck you')).toBe('fuck');
        expect(hittaStötandeOrd('what a CUNT')).toBe('cunt');
    });

    it('fångas trots versaler och leet-stavning', () => {
        expect(hittaStötandeOrd('H0RA')).toBe('hora');
        expect(hittaStötandeOrd('F1TTA')).toBe('fitta');
        expect(hittaStötandeOrd('FUCK DIG')).toBe('fuck');
    });

    it('fäller inte oskyldiga ord som innehåller listade ord', () => {
        // "hora" i "thorax", "cunt" i "Scunthorpe", "mongo" i "Mongoliet":
        // ordlistan matchar egna ord, inte delsträngar.
        expect(hittaStötandeOrd('en föreläsning om thorax')).toBeNull();
        expect(hittaStötandeOrd('Scunthorpe United spelar ikväll')).toBeNull();
        expect(hittaStötandeOrd('resan går genom Mongoliet')).toBeNull();
        // "slut" är svenska - engelska slur-betydelsen är medvetet inte med.
        expect(hittaStötandeOrd('nu är det slut för ikväll')).toBeNull();
        // "negerade" (verbet negera) är inte "neger".
        expect(hittaStötandeOrd('han negerade påståendet')).toBeNull();
    });

    it('har en stopptext att visa användaren', () => {
        expect(ORDFILTER_STOPP.length).toBeGreaterThan(10);
    });
});
