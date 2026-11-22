import { describe, expect, it } from 'vitest';
import { ärJulevent } from './julevent';

describe('ärJulevent', () => {
    it('träffar julens egna ord', () => {
        for (const titel of [
            'Julmarknad på Huseby Bruk',
            'Stora julkonserten 2026',
            'Julbord på Teleborgs slott',
            'Gammaldags jul',
            'JUL I FOLKETS PARK',
            'Julgransplundring',
            'Julpyssel för barn',
            'Förjulsmys i hembygdsgården',
            'Jul- och nyårskonsert',
            'Julinsamling för stadsmissionen',
            'Christmas Night with the Stars',
            'Xmas Party',
        ]) expect(ärJulevent(titel), titel).toBe(true);
    });

    it('träffar lucia, advent, tomte, glögg och pepparkakor', () => {
        for (const titel of [
            'Luciatåg i domkyrkan',
            'Lucia',
            'Lussekattsbak',
            'Första advent i Linnéparken',
            'Adventskonsert med kören',
            'Adventsfika',
            'Träffa tomten',
            'Tomteverkstad',
            'Tomtarnas julnatt',
            'Glöggmingel',
            'Glögg & pepparkakor',
            'Pepparkaksbak för hela familjen',
        ]) expect(ärJulevent(titel), titel).toBe(true);
    });

    it('träffar inte juli och namnen på Jul-', () => {
        for (const titel of [
            'Sommarfest 12 juli',
            'Juli-festen',
            'Julia Dufvenius läser',
            'Julias bokcafé',
            'Julius Caesar',
            'Juliette och Romeo',
            'Julian Lage Trio',
            'Julio Iglesias',
            'Julie Bergan',
            'Romeo & Julia',
            'Fourth of July',
        ]) expect(ärJulevent(titel), titel).toBe(false);
    });

    it('träffar inte ord som bara liknar', () => {
        for (const titel of [
            'Cykelhjul och verkstad',
            'Hjulafton på motorbanan',
            'Adventure Golf',
            'Adventurer Night',
            'Visning av lediga tomter',
            'Loppis i Tomtebo',
            'Tomt och tyst - en föreställning',
        ]) expect(ärJulevent(titel), titel).toBe(false);
    });

    it('nyår räknas inte som jul', () => {
        expect(ärJulevent('Nyårskonsert')).toBe(false);
        expect(ärJulevent('Nyårsfirande på torget')).toBe(false);
        expect(ärJulevent('Nyårsbal')).toBe(false);
    });

    it('tom eller saknad titel är inte ett julevent', () => {
        expect(ärJulevent('')).toBe(false);
        expect(ärJulevent(null)).toBe(false);
        expect(ärJulevent(undefined)).toBe(false);
    });
});
