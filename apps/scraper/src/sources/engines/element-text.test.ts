import { describe, it, expect } from 'vitest';
import { elementTextWithBreaks } from './sitemap';

describe('elementTextWithBreaks', () => {
    it('separerar syskon-spans som sätts rad för rad (gummifabriken.se)', () => {
        const h1 = '<h1><span class="block"><span class="table">Kultursöndag</span>'
            + '<span class="table">Den andre</span></span></h1>';
        expect(elementTextWithBreaks(h1)).toBe('Kultursöndag Den andre');
    });

    it('bryter INTE ord som formaterats inline', () => {
        expect(elementTextWithBreaks('<h1>Thank<em>s</em> for the music</h1>')).toBe('Thanks for the music');
        expect(elementTextWithBreaks('<h1>H<sub>2</sub>O-dagen</h1>')).toBe('H2O-dagen');
    });

    it('lämnar enkla rubriker orörda', () => {
        expect(elementTextWithBreaks('<h1>Wernamo Filmstudio</h1>')).toBe('Wernamo Filmstudio');
    });

    it('kollapsar överflödig whitespace', () => {
        expect(elementTextWithBreaks('<h1>  Lunchlyrik\n\n  </h1>')).toBe('Lunchlyrik');
    });

    it('separerar blockelement', () => {
        expect(elementTextWithBreaks('<h1><div>Rad ett</div><div>Rad två</div></h1>')).toBe('Rad ett Rad två');
    });
});
