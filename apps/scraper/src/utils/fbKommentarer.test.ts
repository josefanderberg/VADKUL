import { describe, expect, it } from 'vitest';
import {
    bedomPositiv, byggRader, datumFranRelativ, normaliseraInlaggsUrl, ortFranGrupp, tillCsv,
} from './fbKommentarer';

describe('normaliseraInlaggsUrl', () => {
    it('ger samma länk oavsett kommentars-id och spårningsparametrar', () => {
        const a = normaliseraInlaggsUrl('https://www.facebook.com/groups/123/posts/456/?comment_id=789&__cft__[0]=x');
        const b = normaliseraInlaggsUrl('https://m.facebook.com/groups/123/permalink/456/');
        expect(a).toBe('https://www.facebook.com/groups/123/posts/456/');
        expect(b).toBe(a);
    });
    it('känner igen multi_permalinks och relativa länkar', () => {
        expect(normaliseraInlaggsUrl('/groups/vadhanderihallsta/?multi_permalinks=999'))
            .toBe('https://www.facebook.com/groups/vadhanderihallsta/posts/999/');
    });
    it('struntar i allt som inte är ett gruppinlägg', () => {
        expect(normaliseraInlaggsUrl('https://www.facebook.com/groups/123/')).toBeNull();
        expect(normaliseraInlaggsUrl('https://www.facebook.com/vadkul/posts/1')).toBeNull();
        expect(normaliseraInlaggsUrl('https://example.com/groups/1/posts/2/')).toBeNull();
        expect(normaliseraInlaggsUrl('inte en länk ::')).toBeNull();
    });
});

describe('ortFranGrupp', () => {
    it.each([
        ['Vad händer i Hallsta?', 'Hallsta'],
        ['Vad händer i Nyköping med omnejd.', 'Nyköping'],
        ['Vad händer i Landskrona och Kävlinge kommun 🇸🇪', 'Landskrona'],
        ['Vad händer i Tierp kommun', 'Tierp'],
        ['Du vet vad som händer i Torshälla', 'Torshälla'],
        ['Vad händer i Gränna (grupp)', 'Gränna'],
        ['Loppis Borlänge', ''],
    ])('%s -> %s', (grupp, ort) => {
        expect(ortFranGrupp(grupp)).toBe(ort);
    });
});

describe('bedomPositiv', () => {
    it('beröm utan invändningar är ja', () => {
        expect(bedomPositiv('Vad smart, äntligen vet man vad som händer!')).toBe('ja');
        expect(bedomPositiv('Grymt jobbat 👏')).toBe('ja');
        expect(bedomPositiv('❤️')).toBe('ja');
        expect(bedomPositiv('Tusen tack!')).toBe('ja');
    });
    it('beröm blandat med invändningar är kanske', () => {
        expect(bedomPositiv('Bra idé, men den hittar inte alla loppisar')).toBe('kanske');
    });
    it('frågor, eventtips och kritik är nej', () => {
        expect(bedomPositiv('Finns den som app?')).toBe('nej');
        expect(bedomPositiv('Barnkläderbytar dag 3/10 kl 10 bergalokalen')).toBe('nej');
        expect(bedomPositiv('Inget av det är i stan')).toBe('nej');
        expect(bedomPositiv('   ')).toBe('nej');
    });
    it('matchar från ordets början', () => {
        expect(bedomPositiv('Jag är så tacksam')).toBe('ja');
        expect(bedomPositiv('Nattåg')).toBe('nej');
    });
});

describe('datumFranRelativ', () => {
    const nu = new Date('2026-09-24T12:00:00Z');
    it.each([
        ['30 min', '2026-09-24'],
        ['2 tim', '2026-09-24'],
        ['3 d', '2026-09-21'],
        ['1 v', '2026-09-17'],
        ['2w', '2026-09-10'],
        ['1 år', '2025-09-24'],
        ['Gilla', ''],
    ])('%s -> %s', (rel, datum) => {
        expect(datumFranRelativ(rel, nu)).toBe(datum);
    });
});

describe('byggRader och tillCsv', () => {
    const nu = new Date('2026-09-24T12:00:00Z');
    const rader = byggRader([
        { id: '1', namn: 'Eva', text: 'Toppen; tack!', svar: false, relativTid: '2 d' },
        { id: '2', namn: 'Vadkul', text: 'Tack Eva!', svar: true, relativTid: '1 d' },
        { id: '1', namn: 'Eva', text: 'Toppen; tack!', svar: false, relativTid: '2 d' },
        { id: '', namn: 'Olle', text: 'Säger "vad kul"\nhär', svar: false, relativTid: '5 tim' },
        { id: '3', namn: 'Lisa', text: '  ', svar: false, relativTid: '1 d' },
    ], 'Vad händer i Piteå?', 'https://www.facebook.com/groups/1/posts/2/', 'Vadkul', nu);

    it('tar bort sidans egna svar, tomma och dubbletter', () => {
        expect(rader.map((r) => r.namn)).toEqual(['Eva', 'Olle']);
        expect(rader[0]).toMatchObject({ ort: 'Piteå', datum: '2026-09-22', positiv: 'ja' });
    });

    it('skriver en CSV som studions import läser (semikolon, BOM, citattecken)', () => {
        const csv = tillCsv(rader);
        expect(csv.startsWith('﻿kommentar;ort;grupp;länk;datum;id;namn;svar;positiv\r\n')).toBe(true);
        expect(csv).toContain('"Toppen; tack!";Piteå;Vad händer i Piteå?;');
        expect(csv).toContain('"Säger ""vad kul""\nhär"');
    });
});
