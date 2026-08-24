import { describe, it, expect } from 'vitest';
import { cleanDescription, cleanLocationName } from './text';

describe('cleanDescription', () => {
    it('strippar HTML-taggar, avkodar entities, kollapsar whitespace', () => {
        // &amp; ska AVKODAS till &, inte blankas (encoding-fixen 2026-07-09).
        expect(cleanDescription('<p>Hej &amp; välkommen</p>\n\n  <b>alla</b>'))
            .toBe('Hej & välkommen\n\nalla');
    });

    it('gör <br> och blockslut till radbrytningar', () => {
        expect(cleanDescription('<p>Ett stycke.</p><p>Nästa stycke.</p>rad1<br>rad2'))
            .toBe('Ett stycke.\nNästa stycke.\nrad1\nrad2');
        expect(cleanDescription('a<br/>b<br />c')).toBe('a\nb\nc');
    });

    it('tar bort WP-excerpt-rester', () => {
        expect(cleanDescription('Läs mer […]')).toBe('Läs mer');
        expect(cleanDescription('Läs mer [...]')).toBe('Läs mer');
    });

    it('klipper till maxlängd (default 500)', () => {
        expect(cleanDescription('x'.repeat(600))).toHaveLength(500);
        expect(cleanDescription('abcdef', 3)).toBe('abc');
    });

    it('tål null/undefined/icke-strängar', () => {
        expect(cleanDescription(null)).toBe('');
        expect(cleanDescription(undefined)).toBe('');
        expect(cleanDescription(42)).toBe('42');
    });
});

describe('cleanLocationName', () => {
    it('strippar UI-rester och landssvansar (Linköpings-skräpet 25/8)', () => {
        expect(cleanLocationName('Ljung slott (Öppnas i ett nytt fönster)')).toBe('Ljung slott');
        expect(cleanLocationName('Folke Filbyterstatyn (Öppnas i ett nytt fönster')).toBe('Folke Filbyterstatyn');
        expect(cleanLocationName('Storgatan 5, 632 20 Eskilstuna, Sweden')).toBe('Storgatan 5, 632 20 Eskilstuna');
        expect(cleanLocationName('Kafé &amp; Scen, Växjö')).toBe('Kafé & Scen, Växjö');
    });

    it('kapar ihopklistrade metadatafält (Uppsala-källan)', () => {
        expect(cleanLocationName('Parksnäckan (Stadsträdgården)  Arrangör:  Kaliber Live  Webbsida: https://x'))
            .toBe('Parksnäckan (Stadsträdgården)');
        expect(cleanLocationName('Gamla Uppsala  Arrangör:  Gamla Uppsala museum')).toBe('Gamla Uppsala');
    });

    it('rör inte rena namn', () => {
        expect(cleanLocationName('Kulturhuset Spira')).toBe('Kulturhuset Spira');
        expect(cleanLocationName('Vreta klosterkyrka, Linköping')).toBe('Vreta klosterkyrka, Linköping');
    });
});
