import { describe, it, expect } from 'vitest';
import { guessEventLanguage, mentionsPlace } from './eventLanguage';

// Riktiga texter ur Sala-incidenten 2026-09-11 (FB-stadssöket på "Sala").
const RO = 'Brainstorm Sala Luceafărul (str. Ion Ghica nr. 3) 12 Septembrie 2026 ora 19:00 Teatrul Independent Luceafărul pune în scenă cea de-a doua sa producție, spectacolul „Brainstorm”, o analiză unică asupra felului în care funcționează mintea';
const IT = 'Gae & Mari della BluMovida Band vi aspettano per una serata tutta da vivere tra musica, emozioni, ballo e tanto divertimento! Una serata pensata per stare insieme, cantare, ballare e divertirsi con la musica della BluMovida';
const LT = '"Nė vienas žmogus nėra tarsi atskira sala" - rašė anglų rašytojas Džonas Donas. Bet kai SALIEČIŲ GENTIS nubunda, atskiros sąmonės susilieja į vieną pulsuojančią visumą. ĮSILIEK. TAPK BANGA.';
const NO = 'Trening i sal. Styrke, utholdenhet, balanse og rolige bevegelser til musikk. Passer for alle. Påmelding Ellen Johansen tlf 47302397 Trenings avgift pr halvår, kr 450,- medlem og 800.- ikke medlem Vipps';
const DE = 'Boden verwalten - Erdgeschichten aus den Mooren. Wir laden euch herzlich ein, mit uns über den Boden zu sprechen. Der Eintritt ist frei und die Veranstaltung findet im Freien statt.';

const SV = 'Välkommen till höstens loppis i Folkets Hus! Här finns kläder, böcker och fika för alla. Fri entré, och barnen får fiska i fiskdammen. Anmälan till bord görs till föreningen.';
const EN = 'Join us for a night of live music at the pub! The band will play from 8pm and tickets are available at the door. We look forward to seeing you there.';
// Svensk text med utländska inslag ska förbli svensk (menyer, låttitlar, per person).
const SV_MIXED = 'Italiensk afton med O sole mio och Nessun dorma. Vi serverar pasta della casa, 250 kr per person. Anmälan till kansliet senast fredag, välkomna!';

describe('guessEventLanguage', () => {
    it.each([['ro', RO], ['it', IT], ['lt', LT], ['de', DE]])('känner igen %s som främmande', (_lang, text) => {
        expect(guessEventLanguage(text).verdict).toBe('foreign');
    });

    it('känner igen norska som grannspråk, inte svenska', () => {
        expect(guessEventLanguage(NO).verdict).toBe('nordic');
    });

    it('svensk och engelsk eventtext är aldrig främmande', () => {
        expect(guessEventLanguage(SV).verdict).toBe('sv');
        expect(guessEventLanguage(EN).verdict).toBe('en');
        expect(guessEventLanguage(SV_MIXED).verdict).toBe('sv');
    });

    it('kort eller tom text avgör ingenting', () => {
        expect(guessEventLanguage('').verdict).toBe('unknown');
        expect(guessEventLanguage('Loppis').verdict).toBe('unknown');
    });

    it('finska och icke-latinsk skrift räknas inte som främmande (föreningsevent i Sverige)', () => {
        expect(guessEventLanguage('Tervetuloa kaikki suomalaiset perheet tapahtumaan, ohjelmaa lapsille ja kahvia').verdict).not.toBe('foreign');
        expect(guessEventLanguage('مرحبا بكم في أمسية ثقافية مع موسيقى وطعام للعائلات').verdict).not.toBe('foreign');
    });
});

describe('mentionsPlace', () => {
    it('hittar orten som eget ord, med genitiv-s', () => {
        expect(mentionsPlace('Konsert i Sala på lördag', 'Sala')).toBe(true);
        expect(mentionsPlace('Salas bygdedräkter', 'Sala')).toBe(true);
    });

    it('skiljer ut FB-sökets fuzzy-träffar', () => {
        expect(mentionsPlace('Kirkeyoga i Bergen Domkirke', 'Berg')).toBe(false);
        expect(mentionsPlace('Sambabué Faro: Muralhas de Faro', 'Fårö')).toBe(false);
        expect(mentionsPlace('Mājas kafejnīca “MALA”', 'Malå')).toBe(false);
        expect(mentionsPlace('TRENING I SAL', 'Sala')).toBe(false);
    });

    it('normaliserar norsk/dansk stavning', () => {
        expect(mentionsPlace('Velkommen til en herlig yogahelg i Strømstad', 'Strömstad')).toBe(true);
    });
});
