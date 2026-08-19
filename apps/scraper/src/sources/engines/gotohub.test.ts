import { describe, it, expect } from 'vitest';
import { extractDetailUrls, extractMapsCoords } from './gotohub';

describe('extractDetailUrls', () => {
    const BASE = 'https://visitskelleftea.se';
    const PAT = /\/evenemangsarkiv\//i;

    it('plockar relativa detaljlänkar, gör absoluta, dedupar', () => {
        const frag = `
            <a href="/sv/evenemangsarkiv/konsert-a/">A</a>
            <a href="/sv/evenemangsarkiv/konsert-a/">A igen</a>
            <a href="/sv/evenemangsarkiv/teater-b/">B</a>
            <a href="/sv/arrangorer/">inte event</a>`;
        const urls = extractDetailUrls(frag, BASE, PAT);
        expect(urls).toHaveLength(2);
        expect(urls[0]).toBe('https://visitskelleftea.se/sv/evenemangsarkiv/konsert-a/');
    });

    it('släpper igenom absoluta länkar på samma sajt men inte externa', () => {
        const frag = `
            <a href="https://visitskelleftea.se/sv/evenemangsarkiv/c/">C</a>
            <a href="https://annansajt.se/evenemangsarkiv/d/">extern</a>`;
        const urls = extractDetailUrls(frag, BASE, PAT);
        expect(urls).toHaveLength(1);
        expect(urls[0]).toContain('visitskelleftea');
    });

    it('hoppar över hrefs med query/fragment (paginerings-/filterlänkar)', () => {
        const frag = `<a href="/sv/evenemangsarkiv/e/?page=2">E</a><a href="/sv/evenemangsarkiv/f/#tab">F</a>`;
        expect(extractDetailUrls(frag, BASE, PAT)).toHaveLength(0);
    });
});

describe('extractMapsCoords', () => {
    it('maps.google-länk med q=lat,lng', () => {
        const html = '<a href="http://maps.google.com/maps?q=64.7069644,21.1608729">karta</a>';
        expect(extractMapsCoords(html)).toEqual([64.7069644, 21.1608729]);
    });

    it('iframe-varianten !3d<lat>!2d<lng> oavsett ordning', () => {
        expect(extractMapsCoords('src="...!3d64.75!2d20.95..."')).toEqual([64.75, 20.95]);
        expect(extractMapsCoords('src="...!2d20.95...!3d64.75..."')).toEqual([64.75, 20.95]);
    });

    it('ingen kartlänk → undefined', () => {
        expect(extractMapsCoords('<html>inget här</html>')).toBeUndefined();
    });
});
