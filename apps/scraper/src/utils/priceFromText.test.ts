import { describe, it, expect } from 'vitest';
import { extractPriceFromText } from './priceFromText';

describe('extractPriceFromText — etiketterade belopp', () => {
    it('plockar "Pris: N kr"-formerna', () => {
        expect(extractPriceFromText('Kom och dansa! Pris: 50 kr per person. Fika ingår.')).toBe('50 kr');
        expect(extractPriceFromText('Entré 100:-')).toBe('100 kr');
        expect(extractPriceFromText('Inträde: 80 kronor')).toBe('80 kr');
        expect(extractPriceFromText('Pris 700:- per person')).toBe('700 kr');
        expect(extractPriceFromText('Biljetter 295 kr, köps i dörren.')).toBe('295 kr');
        expect(extractPriceFromText('Kostnad: 1 195 kr inkl. lunch')).toBe('1195 kr');
        expect(extractPriceFromText('Investering: 2.122kr')).toBe('2122 kr');
    });

    it('slår ihop flera belopp i samma prismening till intervall', () => {
        expect(extractPriceFromText('Startavgift: 150 kr för vuxna, 50 kr för barn')).toBe('50–150 kr');
        expect(extractPriceFromText('Pris: 100 kr, Ungdom 12-18 år: 80 kr, barn upp till 11 år: 60 kr. Biljetter via bio.se'))
            .toBe('60–100 kr');
        expect(extractPriceFromText('Entré 150–250 kr beroende på plats')).toBe('150–250 kr');
        expect(extractPriceFromText('Biljettpris 200/300 kr')).toBe('200–300 kr');
    });

    it('behåller "från"', () => {
        expect(extractPriceFromText('Biljetter från 250 kr')).toBe('från 250 kr');
    });

    it('per-person-form utan etikett', () => {
        expect(extractPriceFromText('Vi bjuder på musik. 30kr/person, swisha vid entrén.')).toBe('30 kr');
        expect(extractPriceFromText('120 kr per deltagare, anmäl dig i förväg.')).toBe('120 kr');
    });
});

describe('extractPriceFromText — gratis', () => {
    it('entré-fraser', () => {
        expect(extractPriceFromText('Konsert i kyrkan. Fri entré!')).toBe('Gratis');
        expect(extractPriceFromText('Kostnadsfritt. Ingen anmälan krävs.')).toBe('Gratis');
        expect(extractPriceFromText('Gratis inträde för alla åldrar')).toBe('Gratis');
        expect(extractPriceFromText('Det kostar inget att delta, gratis kaffe o te')).toBe('Gratis');
        expect(extractPriceFromText('Arrangemanget är kostnadsfritt och sponsras av Hedera Assist')).toBe('Gratis');
        expect(extractPriceFromText('Free entry, all welcome')).toBe('Gratis');
        expect(extractPriceFromText('- Pris: Gratis (du som deltar får även fri entré till utställningen)')).toBe('Gratis');
    });

    it('"Gratis" som egen utsaga', () => {
        expect(extractPriceFromText('Föreläsning om fåglar.\nGratis!\nVälkomna')).toBe('Gratis');
        expect(extractPriceFromText('Gratis. Ingen anmälan.')).toBe('Gratis');
    });

    it('etiketterat pris slår gratis-fras om något annat ("Fri entré till museet, guidning 50 kr" → kostar)', () => {
        expect(extractPriceFromText('Entré 60 kr. Gratis för barn under 12.')).toBe('60 kr');
    });
});

describe('extractPriceFromText — det som INTE ska bli pris', () => {
    it('villkorad gratis är inte eventets pris', () => {
        expect(extractPriceFromText('Fri entré för barn under 12 år.')).toBeNull();
        expect(extractPriceFromText('Gratis för medlemmar, övriga 50 kr')).toBeNull();
        expect(extractPriceFromText('Kostnadsfritt t.o.m. 18 år')).toBeNull();
        expect(extractPriceFromText('Fri entré för alla!')).toBe('Gratis');
        expect(extractPriceFromText('Fri entré innan kl 22.00 därefter 120kr')).toBeNull();
        expect(extractPriceFromText('Bebisar behöver ingen egen biljett, de har alltid fri entré hos oss!')).toBeNull();
    });

    it('bestämd form på etiketten ("Startavgiften", "Priset", "Entrén")', () => {
        expect(extractPriceFromText('Startavgiften för rallyt är 160kr och betalas på plats med Swish.')).toBe('160 kr');
        expect(extractPriceFromText('Priset är 120 kr och entrén öppnar 18.00')).toBe('120 kr');
    });

    it('uttrycklig fri entré slår andra etiketterade belopp (buffén kostar, entrén inte)', () => {
        expect(extractPriceFromText('Fri entré. Pris för buffé 150 kr.')).toBe('Gratis');
        expect(extractPriceFromText('Entré: Gratis. Knallar betalar 150 kr för plats.')).toBe('Gratis');
    });

    it('per person-form räknas inte för mat, och "per år" spärrar', () => {
        expect(extractPriceFromText('Mat, dryck, kaffe och kaka 75:-/person.')).toBeNull();
        expect(extractPriceFromText('Kaffe och våffla serveras till ett pris av 60 kr, barn 20 kr.')).toBeNull();
        expect(extractPriceFromText('Vid utomhusspel måste du vara medlem till en kostnad av 200 kronor per år.')).toBeNull();
    });

    it('beloppen efter etiketten tas i ett kort fönster, inte hela meningen', () => {
        expect(extractPriceFromText('Pris 30 kr, klot finns att låna, kaffe 20 kr och terminskort 200 kr betalas separat'))
            .toBe('30 kr');
        expect(extractPriceFromText('Kursavgift: 950kr exklusive lunch 99kr, alternativt egen lunch.')).toBe('950 kr');
        expect(extractPriceFromText('Pris 200kr var av 25kr går till Barncancercentrum Sverige.')).toBe('200 kr');
    });

    it('gratis-ord som handlar om annat än entrén', () => {
        expect(extractPriceFromText('Gratis buss avgår från Högsjö Folkets Hus')).toBeNull();
        expect(extractPriceFromText('Begagnade cykeldelar gratis. Skolungdomar kan välja')).toBeNull();
        expect(extractPriceFromText('Maten er gratis. Det er mulighet til å gi ei gave')).toBeNull();
        expect(extractPriceFromText('trevliga medspelare är gratis.')).toBeNull();
        expect(extractPriceFromText('Inte gratis, men billigt: pris kommer.')).toBeNull();
    });

    it('nakna belopp i löptext lämnas (vinst, insamling, kursupplägg)', () => {
        expect(extractPriceFromText('Kursstart 10 september. 8 tillfällen, 1020 kr.')).toBeNull();
        expect(extractPriceFromText('1:a pris 1000 kr, 2:a pris 500 kr')).toBeNull();
        expect(extractPriceFromText('Vi samlade in 5 000 kr till Barncancerfonden')).toBeNull();
        expect(extractPriceFromText('Lotter 20 kr styck, vinster till ett värde av 3000 kr')).toBeNull();
    });

    it('spärrord: serviceavgift/medlemsavgift/hyra', () => {
        expect(extractPriceFromText('Biljetter köps på Tickster. Serviceavgift tillkommer, max 800 kr.')).toBeNull();
        expect(extractPriceFromText('Medlemsavgift 200 kr/år betalas till klubben')).toBeNull();
        expect(extractPriceFromText('Kostnad för hyra av lokal: 500 kr')).toBeNull();
    });

    it('tomt/kort/skräp', () => {
        expect(extractPriceFromText('')).toBeNull();
        expect(extractPriceFromText(null)).toBeNull();
        expect(extractPriceFromText('kr')).toBeNull();
        expect(extractPriceFromText('Pris: 0 kr')).toBe('Gratis');
        expect(extractPriceFromText('Pris: 999999 kr')).toBeNull();
    });
});
