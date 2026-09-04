import { describe, it, expect } from 'vitest';
import { cleanDescription, cleanLocationName, truncateAtBoundary } from './text';

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

    it('tar bort "Läs mer"-svansar ur utdrag', () => {
        expect(cleanDescription('Bra konsert i kyrkan. Läs mer »')).toBe('Bra konsert i kyrkan.');
        expect(cleanDescription('Great show.\nRead more')).toBe('Great show.');
        expect(cleanDescription('Läs mer om oss på hemsidan.')).toBe('Läs mer om oss på hemsidan.');
    });

    it('tar bort WP-excerpt-rester', () => {
        expect(cleanDescription('Mer info […]')).toBe('Mer info');
        expect(cleanDescription('Mer info [...]')).toBe('Mer info');
    });

    it('klipper vid ordgräns med ellips — aldrig mitt i ett ord (default 1500)', () => {
        const long = cleanDescription('ord '.repeat(600));
        expect(long.length).toBeLessThanOrEqual(1500);
        expect(long.endsWith('ord…')).toBe(true);
        expect(cleanDescription('abc def ghi', 8)).toBe('abc def…');
        expect(cleanDescription('x'.repeat(600), 500)).toHaveLength(500);   // inget ord att bryta vid
        expect(cleanDescription('kort text')).toBe('kort text');
    });

    it('föredrar meningsslut framför ordgräns när det finns i bakre halvan', () => {
        expect(cleanDescription('Första meningen är här. Andra meningen är lång och fortsätter länge.', 40))
            .toBe('Första meningen är här.');
    });

    it('tar bort ersättningstecken och ensamma surrogathalvor men behåller emoji', () => {
        expect(cleanDescription('Hej \uFFFD världen \uFFFD\uFFFD')).toBe('Hej världen');
        expect(cleanDescription('Fest 🎉 i kväll')).toBe('Fest 🎉 i kväll');
        expect(cleanDescription('trasig \uD83C halva')).toBe('trasig halva');
    });

    it('klipper aldrig mitt i ett emoji', () => {
        expect(cleanDescription('🎉'.repeat(10), 5)).toBe('🎉🎉…');
        expect(cleanDescription('🎉'.repeat(10), 4)).toBe('🎉…');
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

describe('truncateAtBoundary', () => {
    it('returnerar text som ryms orörd', () => {
        expect(truncateAtBoundary('hej', 10)).toBe('hej');
        expect(truncateAtBoundary('exakt', 5)).toBe('exakt');
    });
    it('trimmar hängande skiljetecken före ellipsen', () => {
        expect(truncateAtBoundary('Konsert med kören, orkestern och solister', 30)).toBe('Konsert med kören, orkestern…');
    });
});
