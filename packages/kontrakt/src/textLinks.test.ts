import { describe, expect, it } from 'vitest';
import { hasTextLinks, splitTextLinks } from './textLinks';

const join = (text: string) => splitTextLinks(text).map(s => s.text).join('');

describe('splitTextLinks', () => {
    it('tom text och text utan länkar', () => {
        expect(splitTextLinks('')).toEqual([]);
        expect(splitTextLinks('Fri entré kl. 19, ta med vänner.')).toEqual([{ text: 'Fri entré kl. 19, ta med vänner.' }]);
    });

    it('http(s)-länkar mitt i texten blir egna segment', () => {
        const t = 'Lyssna här: https://open.spotify.com/artist/abc och https://open.spotify.com/track/x?si=1 innan!';
        expect(splitTextLinks(t)).toEqual([
            { text: 'Lyssna här: ' },
            { text: 'https://open.spotify.com/artist/abc', href: 'https://open.spotify.com/artist/abc' },
            { text: ' och ' },
            { text: 'https://open.spotify.com/track/x?si=1', href: 'https://open.spotify.com/track/x?si=1' },
            { text: ' innan!' },
        ]);
        expect(join(t)).toBe(t);
    });

    it('www-länkar får https:// som adress men texten står kvar som den skrevs', () => {
        expect(splitTextLinks('Biljetter på www.tickster.com/sv/events')).toEqual([
            { text: 'Biljetter på ' },
            { text: 'www.tickster.com/sv/events', href: 'https://www.tickster.com/sv/events' },
        ]);
    });

    it('skiljetecken i slutet hör till meningen, inte länken', () => {
        expect(splitTextLinks('Se https://vadkul.se.')).toEqual([
            { text: 'Se ' }, { text: 'https://vadkul.se', href: 'https://vadkul.se' }, { text: '.' },
        ]);
        expect(splitTextLinks('(mer på https://vadkul.se/evenemang/vaxjo)')).toEqual([
            { text: '(mer på ' }, { text: 'https://vadkul.se/evenemang/vaxjo', href: 'https://vadkul.se/evenemang/vaxjo' }, { text: ')' },
        ]);
        expect(splitTextLinks('Kom! https://x.se/a?b=1!')[1]).toEqual({ text: 'https://x.se/a?b=1', href: 'https://x.se/a?b=1' });
        expect(splitTextLinks('"https://x.se"')).toEqual([{ text: '"' }, { text: 'https://x.se', href: 'https://x.se' }, { text: '"' }]);
    });

    it('en parentes som länken själv öppnade följer med', () => {
        const url = 'https://sv.wikipedia.org/wiki/Palatset_(Link%C3%B6ping)';
        expect(splitTextLinks(`Läs ${url}.`)).toEqual([
            { text: 'Läs ' }, { text: url, href: url }, { text: '.' },
        ]);
    });

    it('länken bryts vid blanksteg och radbrytning', () => {
        expect(splitTextLinks('https://a.se\nhttps://b.se')).toEqual([
            { text: 'https://a.se', href: 'https://a.se' },
            { text: '\n' },
            { text: 'https://b.se', href: 'https://b.se' },
        ]);
    });

    it('protokollet är okänsligt för versaler', () => {
        expect(splitTextLinks('HTTPS://VADKUL.SE')).toEqual([{ text: 'HTTPS://VADKUL.SE', href: 'HTTPS://VADKUL.SE' }]);
        expect(splitTextLinks('WWW.vadkul.se')[0].href).toBe('https://WWW.vadkul.se');
    });

    it('nakna domäner, "www" utan punkt och ord som råkar innehålla www är text', () => {
        expect(hasTextLinks('spotify.com är bra')).toBe(false);
        expect(hasTextLinks('www. ingenting')).toBe(false);
        expect(hasTextLinks('https:// trasigt')).toBe(false);
        expect(hasTextLinks('foowww.x.se')).toBe(false);
        expect(hasTextLinks('se www.x.se')).toBe(true);
    });

    it('segmenten sammanfogade är alltid originaltexten', () => {
        for (const t of [
            'a https://x.se b',
            'https://x.se',
            'x (www.y.se), z.',
            'Två: https://a.se/1. https://b.se/2!',
            'Radbryt\nwww.c.se\n',
        ]) expect(join(t)).toBe(t);
    });
});
