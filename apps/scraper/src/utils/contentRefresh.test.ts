import { describe, it, expect } from 'vitest';
import { pickBetterDescription, pickBetterPrice, looksStripped, isPlaceholderDescription } from './contentRefresh';

describe('pickBetterDescription', () => {
    const full = 'Vi firar en enkel mässa tillsammans. Efteråt serveras frukost i församlingshemmet, och alla är välkomna att stanna kvar en stund.';

    it('fyller tom sparad', () => {
        expect(pickBetterDescription('', full)).toBe(full);
        expect(pickBetterDescription(null, full)).toBe(full);
        expect(pickBetterDescription('', 'kort')).toBeNull();
    });

    it('byter när sparad är en kapad början av färsk (500-taket)', () => {
        const stored = full.slice(0, 60);                       // mitt i ett ord
        expect(pickBetterDescription(stored, full)).toBe(full);
        expect(pickBetterDescription(full.slice(0, 60) + '…', full)).toBe(full);
        expect(pickBetterDescription(full.slice(0, 60) + ' [...]', full)).toBe(full);
    });

    it('tål whitespace-skillnad mellan gammal och ny städning', () => {
        const stored = full.replace('. ', '.\n').slice(0, 70);
        expect(pickBetterDescription(stored, full)).toBe(full);
    });

    it('byter när sparad saknar å/ä/ö och färsk har dem', () => {
        const stripped = 'Ystad Studios Visitor Center r ett upplevelsecenter f r film, d r Ystad Kommun erbjuder upplevelser.';
        const fresh = 'Ystad Studios Visitor Center är ett upplevelsecenter för film, där Ystad Kommun erbjuder upplevelser.';
        expect(pickBetterDescription(stripped, fresh)).toBe(fresh);
    });

    it('byter när sparad har ersättningstecken', () => {
        expect(pickBetterDescription('� VI ÄR TILLBAKA! � Efter sommaruppehållet är det dags igen.', 'VI ÄR TILLBAKA! Efter sommaruppehållet är det dags igen.'))
            .toBe('VI ÄR TILLBAKA! Efter sommaruppehållet är det dags igen.');
    });

    it('byter platshållare mot riktig text — även långa PRO-platshållare', () => {
        expect(pickBetterDescription('PRO Eksjö-aktivitet, Eksjo.', full)).toBe(full);
        expect(pickBetterDescription('PRO Falköping-aktivitet på Folkets hus Falköping, Falköping.', full)).toBe(full);
        expect(pickBetterDescription('ABF-evenemang i Kalmar.', 'ABF-evenemang i Växjö.')).toBeNull();
        expect(pickBetterDescription('ABF-evenemang i Kalmar.', full)).toBe(full);
    });

    it('isPlaceholderDescription känner igen motorernas mallar men inte riktig text', () => {
        expect(isPlaceholderDescription('PRO-aktivitet, Sverige.')).toBe(true);
        expect(isPlaceholderDescription('Kurs med Medborgarskolan i Lund.')).toBe(true);
        expect(isPlaceholderDescription('Vi spelar boule varje tisdag. Alla är välkomna, PRO bjuder på fika.')).toBe(false);
    });

    it('byter när sparad bara är färsk + påhängd taggsoppa', () => {
        const fresh = 'Upptäck en värld av magi! Bludderblad är en föreställning för de yngre barnen som genom dans och musik funderar.';
        expect(pickBetterDescription(fresh + ' aktiviteter & upplevelser kultur & nöje musik & underhållning teater & scenkonst', fresh)).toBe(fresh);
    });

    it('rör inte omformuleringar, kortare texter eller identisk text', () => {
        expect(pickBetterDescription(full, full)).toBeNull();
        expect(pickBetterDescription(full, full.slice(0, 80))).toBeNull();
        expect(pickBetterDescription(full, 'Helt annan text om samma event som är minst lika lång som den gamla, men omskriven.')).toBeNull();
    });
});

describe('pickBetterPrice', () => {
    it('fyller bara tomt', () => {
        expect(pickBetterPrice('', '150 kr')).toBe('150 kr');
        expect(pickBetterPrice(null, 'Gratis')).toBe('Gratis');
        expect(pickBetterPrice('100 kr', '150 kr')).toBeNull();
        expect(pickBetterPrice('', '')).toBeNull();
    });
});

describe('looksStripped', () => {
    it('känner igen mellanslagshål men inte vanlig text', () => {
        expect(looksStripped('V lkommen till oss h r i kv ll')).toBe(true);
        expect(looksStripped('Välkommen till oss här i kväll')).toBe(false);
        expect(looksStripped('Det är också roligt')).toBe(false);
    });
});
