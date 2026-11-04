import { describe, it, expect } from 'vitest';
import { brickorKort, kartKort, kortSpec, PALETT, prickKort, siffraKort, slutkort, texterI } from './bild';

describe('kortSpec', () => {
    it('siffer-kortet har talet i gult och raden, måtten 1080x1350', () => {
        const s = kortSpec('siffra', { tal: '11 000+', rad: 'event i Sverige den här veckan', under: '3 400 bara i dag' });
        expect([s.bredd, s.hojd]).toEqual([1080, 1350]);
        const texter = texterI(s.element);
        expect(texter).toEqual(['VADKUL', '11 000+', 'event i Sverige den här veckan', '3 400 bara i dag', 'vadkul.se', 'Gratis · Hela Sverige']);
        const json = JSON.stringify(s.element);
        expect(json).toContain(`"color":"${PALETT.gul}"`);
        expect(json).toContain('Fredoka');
    });

    it('brickor-kortet: tre brickor med nummer, emoji, titel och stad', () => {
        const s = kortSpec('brickor', {
            rubrik: 'Vilket öppnar flest i dag?',
            brickor: [
                { nr: '1', emoji: '🎸', titel: 'Laleh', under: 'Göteborg' },
                { nr: '2', emoji: '🎄', titel: 'Julmarknad', under: 'Umeå' },
                { nr: '3', emoji: '🏒', titel: 'Växjö Lakers', under: 'Växjö' },
            ],
            fot: 'Svaret i morgon',
        });
        const texter = texterI(s.element);
        expect(texter).toContain('Vilket öppnar flest i dag?');
        expect(texter).toContain('🎸');
        expect(texter).toContain('Växjö Lakers');
        expect(texter).toContain('Svaret i morgon');
        expect(JSON.stringify(s.element).split('"borderRadius":40').length - 1).toBe(3);
    });

    it('rubrik-kortet med tal, utan under', () => {
        const s = kortSpec('rubrik', { rubrik: 'I helgen i Växjö', tal: '340+' });
        expect(texterI(s.element)).toEqual(['VADKUL', '340+', 'I helgen i Växjö', 'vadkul.se', 'Gratis · Hela Sverige']);
    });

    it('slutkortet är 1080x1920 utan siffror och tar en ikon', () => {
        const s = kortSpec('slutkort', { ikonDataUri: 'data:image/png;base64,AAAA' });
        expect([s.bredd, s.hojd]).toEqual([1080, 1920]);
        const texter = texterI(s.element).join(' ');
        expect(texter).not.toMatch(/\d/);
        expect(texter).toContain('Nu i App Store');
        expect(JSON.stringify(s.element)).toContain('data:image/png;base64,AAAA');
        expect(JSON.stringify(slutkort())).not.toContain('"img"');
    });

    it('alla kort följer paletten (inga främmande färger)', () => {
        const alla = [
            siffraKort({ tal: '1', rad: 'x' }),
            brickorKort({ rubrik: 'r', brickor: [{ emoji: '☕', titel: 't' }] }),
            kortSpec('rubrik', { rubrik: 'r', under: 'u' }).element,
            slutkort(),
        ];
        const tillatna = new Set(Object.values(PALETT).map(c => c.toLowerCase()));
        for (const e of alla) {
            const farger = JSON.stringify(e).match(/#[0-9a-f]{6}/gi) ?? [];
            for (const f of farger) expect(tillatna.has(f.toLowerCase())).toBe(true);
        }
    });

    it('kartkortet: kartbilden överst, en bricka per event, talet och raden under', () => {
        const s = kortSpec('karta', {
            kartbild: 'data:image/png;base64,KARTA', ytaHojd: 770, bildBredd: 1525, bildHojd: 770,
            brickor: [{ id: 'a', emoji: '🎸', kategori: 'music', x: 300, y: 400 }, { id: 'b', emoji: '⚽', kategori: 'sport', x: 600, y: 300 }],
            tal: '370+', rad: 'event i Göteborg i helgen', under: '🎨 76+ konst',
        });
        expect([s.bredd, s.hojd]).toEqual([1080, 1350]);
        const json = JSON.stringify(s.element);
        expect(json).toContain('data:image/png;base64,KARTA');
        expect(json.split('rotate(45deg)').length - 1).toBe(2);
        expect(texterI(s.element)).toEqual(['🎸', '⚽', 'VADKUL', '370+', 'event i Göteborg i helgen', '🎨 76+ konst', 'vadkul.se', 'Gratis · Hela Sverige']);
        // Bilden centreras: round((1080 - 1525) / 2).
        expect(json).toContain('"left":-222');
    });

    it('kartkortet utan tal: etiketten och rubriken, och den gula brickan med text', () => {
        const e = kartKort({
            kartbild: 'data:image/png;base64,K', ytaHojd: 770, bildBredd: 1525, bildHojd: 770, brickor: [],
            etikett: 'Lägg upp ditt eget', rad: 'Har du ett event på gång?', markera: { x: 400, y: 500, text: 'Ditt event?' },
        });
        const texter = texterI(e);
        expect(texter).toContain('Lägg upp ditt eget');
        expect(texter).toContain('Ditt event?');
        expect(texter).toContain('✨');
        expect(texter.some(t => /\d/.test(t))).toBe(false);
    });

    it('prickkortet: prickbilden till höger, brickor ovanpå, talet till vänster', () => {
        const s = kortSpec('prickar', {
            prickBild: 'data:image/svg+xml;base64,PRICK', bredd: 549, hojd: 1260, tal: '6 200+', rad: 'event i Sverige den här veckan',
            under: 'Varje prick är en plats där något händer', brickor: [{ id: 'x', emoji: '🎵', kategori: 'music', x: 290, y: 980 }],
        });
        const json = JSON.stringify(s.element);
        expect(json).toContain('PRICK');
        expect(json).toContain('"left":495');
        expect(texterI(s.element)).toEqual(['🎵', 'VADKUL', '6 200+', 'event i Sverige den här veckan', 'Varje prick är en plats där något händer', 'vadkul.se', 'Gratis · Hela Sverige']);
    });

    it('brickor-kortet: rund kartbild i stället för emoji, och utan emoji alls', () => {
        const med = JSON.stringify(brickorKort({ rubrik: 'r', brickor: [{ nr: '1', emoji: '', titel: 'Uppsala', bild: 'data:image/png;base64,UPP' }] }));
        expect(med).toContain('data:image/png;base64,UPP');
        const utan = brickorKort({ rubrik: 'r', brickor: [{ nr: '1', emoji: '', titel: 'måndag' }] });
        expect(texterI(utan)).toEqual(['VADKUL', 'r', '1', 'måndag', 'vadkul.se', 'Gratis · Hela Sverige']);
    });

    it('kartkortet och prickkortet håller paletten utanför brickorna', () => {
        const farger = (e: unknown): string[] => (JSON.stringify(e).replace(/linear-gradient\(145deg[^)]*\)[^"]*/g, '').match(/#[0-9a-f]{6}/gi) ?? []);
        const tillatna = new Set(Object.values(PALETT).map(c => c.toLowerCase()));
        const k = kartKort({ kartbild: 'x', ytaHojd: 770, bildBredd: 1525, bildHojd: 770, brickor: [{ id: 'a', emoji: '🎸', kategori: 'music', x: 1, y: 1 }], tal: '1', rad: 'r' });
        const p = prickKort({ prickBild: 'x', bredd: 1, hojd: 1, tal: '1', rad: 'r' });
        for (const f of [...farger(k), ...farger(p)]) expect(tillatna.has(f.toLowerCase())).toBe(true);
    });
});
