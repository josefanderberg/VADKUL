import { describe, it, expect } from 'vitest';
import { isTruncatedTitle } from './sitevision';

describe('isTruncatedTitle', () => {
    it('känner igen kortlistornas ellips', () => {
        expect(isTruncatedTitle('Musikcafé: Miraim Aïda – …')).toBe(true);
        expect(isTruncatedTitle('Temakväll: Klimat och dem...')).toBe(true);
        expect(isTruncatedTitle('DANS Parkhallen Tranås - …  ')).toBe(true);
    });

    it('rör inte hela titlar', () => {
        expect(isTruncatedTitle('Tranås Vinfestival')).toBe(false);
        expect(isTruncatedTitle('Bakluckeloppis!')).toBe(false);
        // Ellips MITT i titeln är inte en kapning.
        expect(isTruncatedTitle('Vad … händer sen')).toBe(false);
    });
});

import { fullTitleFromHtml } from './sitevision';

describe('fullTitleFromHtml', () => {
    it('föredrar og:title när den finns', () => {
        expect(fullTitleFromHtml('<meta property="og:title" content="Hela titeln"><h1>H1</h1>'))
            .toBe('Hela titeln');
    });

    it('faller till h1 när og-taggar saknas (entretranas.se)', () => {
        expect(fullTitleFromHtml('<title>Paradmarscher 2026 - Entré Tranås</title><h1>Paradmarscher 2026</h1>'))
            .toBe('Paradmarscher 2026');
    });

    it('kapar sajtnamnet ur <title> som sista utväg', () => {
        expect(fullTitleFromHtml('<title>Musikcafé: Miraim Aïda – Sinatra - Entré Tranås</title>'))
            .toBe('Musikcafé: Miraim Aïda – Sinatra');
    });

    it('ger tom sträng när inget finns', () => {
        expect(fullTitleFromHtml('<div>inget</div>')).toBe('');
    });
});
