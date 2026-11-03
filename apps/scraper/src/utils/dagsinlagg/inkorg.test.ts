import { describe, it, expect } from 'vitest';
import { arVideo, inkorgsFilnamn, nastaLopnummer, temaUrBildtext } from './inkorg';
import { temaUrFilnamn } from './logg';

describe('temaUrBildtext', () => {
    it('känner igen temana på svenska', () => {
        expect(temaUrBildtext('ikväll')).toEqual({ tema: 'ikvall' });
        expect(temaUrBildtext('Ikväll!')).toEqual({ tema: 'ikvall' });
        expect(temaUrBildtext('fredag')).toEqual({ tema: 'fredag' });
        expect(temaUrBildtext('bjud med')).toEqual({ tema: 'bjud-med' });
        expect(temaUrBildtext('bjud-med')).toEqual({ tema: 'bjud-med' });
        expect(temaUrBildtext('regnig dag')).toEqual({ tema: 'regnig' });
        expect(temaUrBildtext('skapa eget')).toEqual({ tema: 'skapa-eget' });
        expect(temaUrBildtext('hitta på')).toEqual({ tema: 'hitta-pa' });
        expect(temaUrBildtext('allt på ett ställe')).toEqual({ tema: 'allt' });
    });

    it('helg med stad', () => {
        expect(temaUrBildtext('helg Växjö')).toEqual({ tema: 'helg', stad: 'vaxjo' });
        expect(temaUrBildtext('Helgen i Upplands Väsby')).toEqual({ tema: 'helg', stad: 'upplands-vasby' });
        expect(temaUrBildtext('helg')).toEqual({ tema: 'helg' });
    });

    it('tomt eller okänt blir okant', () => {
        expect(temaUrBildtext(undefined)).toEqual({ tema: 'okant' });
        expect(temaUrBildtext('test 123')).toEqual({ tema: 'okant' });
    });
});

describe('inkorgsFilnamn', () => {
    it('ascii-namn som logg.temaUrFilnamn läser tillbaka', () => {
        const f = inkorgsFilnamn('2026-11-03', 'helg', 'Växjö', 2, 'grok.MOV');
        expect(f).toBe('2026-11-03-helg-vaxjo-2.mov');
        expect(temaUrFilnamn(f)).toEqual({ tema: 'helg', stad: 'vaxjo' });
        const g = inkorgsFilnamn('2026-11-03', 'bjud-med', undefined, 1);
        expect(g).toBe('2026-11-03-bjud-med-1.mp4');
        expect(temaUrFilnamn(g)).toEqual({ tema: 'bjud-med' });
    });

    it('nästa löpnummer hoppar över upptagna', () => {
        const bef = ['2026-11-03-ikvall-1.mp4', '2026-11-03-ikvall-2.mov', '2026-11-03-fredag-1.mp4'];
        expect(nastaLopnummer(bef, '2026-11-03', 'ikvall')).toBe(3);
        expect(nastaLopnummer(bef, '2026-11-03', 'fredag')).toBe(2);
        expect(nastaLopnummer(bef, '2026-11-03', 'helg', 'Växjö')).toBe(1);
    });

    it('arVideo på mime eller filändelse', () => {
        expect(arVideo({ mimeType: 'video/mp4' })).toBe(true);
        expect(arVideo({ mimeType: 'application/octet-stream', fileName: 'x.MOV' })).toBe(true);
        expect(arVideo({ mimeType: 'image/png', fileName: 'x.png' })).toBe(false);
    });
});
