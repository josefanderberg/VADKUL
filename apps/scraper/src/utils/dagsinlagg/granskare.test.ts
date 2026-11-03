import { describe, it, expect } from 'vitest';
import { beskrivOmdome, godkant, granskningsprompt, harHartBrott, tolkaOmdome, valjBasta } from './granskare';
import type { Granskad } from './granskare';

const g = (fil: string, betyg: number, tema: Granskad['omdome']['tema'], brott: string[] = []): Granskad =>
    ({ fil, omdome: { betyg, tema, brott, textrader: [], motivering: '' } });

describe('granskningsprompt', () => {
    it('nämner stilen, temana och dagens önskemål', () => {
        const p = granskningsprompt(['fredag', 'ikvall']);
        expect(p).toContain('#FDE047');
        expect(p).toContain('- bjud-med:');
        expect(p).toContain('Önskade teman i dag, i prioritetsordning: fredag, ikvall.');
        expect(p).toContain('ENBART ett JSON-objekt');
        expect(p).not.toMatch(/[–—]/);
    });
});

describe('tolkaOmdome', () => {
    it('läser ett rent svar', () => {
        const o = tolkaOmdome('{"tema":"ikväll","betyg":82,"brott":[],"textrader":["Vad händer ikväll?","Allt på en karta"],"motivering":"Fin."}');
        expect(o).toEqual({ betyg: 82, tema: 'ikvall', brott: [], textrader: ['Vad händer ikväll?', 'Allt på en karta'], motivering: 'Fin.' });
    });

    it('räddar ett kapat svar och klampar betyget', () => {
        const o = tolkaOmdome('Här är svaret: {"tema":"fredag","betyg":120,"brott":["text i bild"],"textrader":["Fredag', {});
        expect(o?.betyg).toBe(100);
        expect(o?.tema).toBe('fredag');
        expect(o?.brott).toEqual(['text i bild']);
        expect(o?.textrader).toEqual([]);
        const kapatTvaRader = tolkaOmdome('{"tema":"ikvall","betyg":80,"brott":[],"textrader":["Vad händer ikväll?","Allt på en karta"],"motivering":"Lugn och fi');
        expect(kapatTvaRader?.textrader).toEqual(['Vad händer ikväll?', 'Allt på en karta']);
        expect(kapatTvaRader?.brott).toEqual([]);
    });

    it('okänt tema blir okant, textrader som bryter reglerna stryks', () => {
        const o = tolkaOmdome('{"tema":"sommar","betyg":"75","textrader":["Hej 🎉","Ett två tre fyra fem sex sju","340 event i Växjö","Vad händer?"]}');
        expect(o?.tema).toBe('okant');
        expect(o?.betyg).toBe(75);
        expect(o?.textrader).toEqual(['Vad händer?']);
        expect(tolkaOmdome('{"tema":"helg","betyg":80,"textrader":["340 event"]}', { antalGolv: '340' })?.textrader).toEqual(['340 event']);
    });

    it('inget JSON eller inget betyg ger null', () => {
        expect(tolkaOmdome('Jag kan inte bedöma det här.')).toBeNull();
        expect(tolkaOmdome('{"tema":"ikvall"}')).toBeNull();
    });
});

describe('godkant, harHartBrott, valjBasta', () => {
    it('hårda brott fäller även höga betyg', () => {
        expect(harHartBrott(['Text i övre kanten'])).toBe(true);
        expect(harHartBrott(['lite rörigt'])).toBe(false);
        expect(godkant({ betyg: 95, tema: 'ikvall', brott: ['logga i hörnet'], textrader: [], motivering: '' })).toBe(false);
        expect(godkant({ betyg: 69, tema: 'ikvall', brott: [], textrader: [], motivering: '' })).toBe(false);
        expect(godkant({ betyg: 70, tema: 'ikvall', brott: [], textrader: [], motivering: '' })).toBe(true);
    });

    it('önskat tema går före betyg, sedan betyg, sedan filnamn', () => {
        const lista = [g('a.mp4', 95, 'regnig'), g('b.mp4', 75, 'fredag'), g('c.mp4', 80, 'fredag'), g('d.mp4', 99, 'ikvall', ['text i bild'])];
        expect(valjBasta(lista, ['fredag', 'ikvall'])?.fil).toBe('c.mp4');
        expect(valjBasta(lista, ['regnig'])?.fil).toBe('a.mp4');
        expect(valjBasta(lista, ['helg'])?.fil).toBe('a.mp4');
        expect(valjBasta([g('x.mp4', 50, 'fredag')], ['fredag'])).toBeNull();
    });

    it('beskrivOmdome ger en rad', () => {
        expect(beskrivOmdome(g('a.mp4', 95, 'regnig'))).toBe('a.mp4: godkänt, 95/100, tema regnig');
        expect(beskrivOmdome(g('b.mp4', 30, 'okant', ['text i bild']))).toBe('b.mp4: avvisat, 30/100, tema okant (text i bild)');
    });
});
