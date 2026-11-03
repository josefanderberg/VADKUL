import { describe, it, expect } from 'vitest';
import { brickorKort, kortSpec, PALETT, siffraKort, slutkort, texterI } from './bild';

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
});
