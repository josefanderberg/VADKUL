import { describe, it, expect } from 'vitest';
import {
    byggKontrolleradText, byggText, formateraTal, golv, hashtaggar, kontrollera, kontrolleraTextrad,
    raknaEmojis, satt, siffrorI, talMedPlus, textraderFor, variera,
} from './text';
import type { Tema } from './typer';

describe('siffror', () => {
    it('golv avrundar nedåt ärligt', () => {
        expect(golv(12_345)).toBe(12_000);
        expect(golv(3_487)).toBe(3_400);
        expect(golv(187)).toBe(180);
        expect(golv(42)).toBe(42);
        expect(golv(0)).toBe(0);
    });

    it('formaterar med mellanslag och plus', () => {
        expect(formateraTal(11432)).toBe('11 432');
        expect(talMedPlus(11432)).toBe('11 000+');
        expect(talMedPlus(12)).toBe('12');
    });

    it('siffrorI plockar grupper men inte keycaps, länkar eller hashtaggar', () => {
        expect(siffrorI('11 000+ event 7/11 1️⃣ vadkul.se/e/abc123 #2026')).toEqual(['11000', '7', '11']);
    });
});

describe('raknaEmojis', () => {
    it('räknar vanliga emojis, keycaps och sammansatta', () => {
        expect(raknaEmojis('Hej 🗓️ 📍 ✨')).toBe(3);
        expect(raknaEmojis('1️⃣ a 2️⃣ b 3️⃣ c ☁️')).toBe(4);
        expect(raknaEmojis('ingen')).toBe(0);
    });
});

describe('kontrollera', () => {
    const ok = 'Tre event i dag 🗓️\n1 200+ i veckan 📍\nGratis ✨\nvadkul.se\nVad ska du på?';
    const data = { vecka: 1234 };

    it('släpper igenom en korrekt text', () => {
        expect(kontrollera(ok, { veckaGolv: '1 200' }, 'fb')).toEqual([]);
    });

    it('hittar tankstreck, spärrade fraser och utropstecken', () => {
        const t = 'Häng med – nu! Missa inte! 🗓️📍✨\nVad?';
        const brott = kontrollera(t, {}, 'fb');
        expect(brott).toContain('tankstreck');
        expect(brott).toContain('spärrad fras: Häng med');
        expect(brott).toContain('spärrad fras: Missa inte');
        expect(brott).toContain('2 utropstecken');
    });

    it('länk på Instagram är ett brott, på Facebook inte', () => {
        expect(kontrollera(ok, { veckaGolv: '1 200' }, 'ig')).toContain('länk på Instagram');
        expect(kontrollera(ok.replace('vadkul.se', 'Länk i bion ☁️'), { veckaGolv: '1 200' }, 'ig')).toEqual([]);
    });

    it('emojiantal och avslutande fråga', () => {
        expect(kontrollera('Hej 🗓️\nVad?', {}, 'fb')).toContain('1 emojis (3-6)');
        expect(kontrollera('A 🗓️📍✨🎸🧠☔🎉\nVad?', {}, 'fb')).toContain('7 emojis (3-6)');
        expect(kontrollera('A 🗓️📍✨\nKlart.', {}, 'fb')).toContain('slutar inte med en fråga');
        // Hashtaggar sist räknas inte som sista raden.
        expect(kontrollera('A 🗓️📍✨\nVad?\n\n#vadkul', {}, 'ig')).toEqual([]);
    });

    it('varje siffra måste finnas i data, även inne i strängar', () => {
        expect(kontrollera('11 000+ event 🗓️📍✨\nVad?', {}, 'fb')).toContain('siffra saknas i data: 11000');
        expect(kontrollera('11 000+ event 🗓️📍✨\nVad?', { veckaGolv: '11 000' }, 'fb')).toEqual([]);
        expect(kontrollera('11 000+ event 🗓️📍✨\nVad?', { vecka: 11000 }, 'fb')).toEqual([]);
        expect(kontrollera('1 000 medlemmar 🎉✨📍\nVad?', { milstolpe: '1 000 medlemmar' }, 'fb')).toEqual([]);
        expect(data).toBeTruthy();
    });
});

describe('kontrolleraTextrad', () => {
    it('max sex ord, inga emojis, inga versaler, siffror ur data', () => {
        expect(kontrolleraTextrad('Vad händer ikväll?')).toEqual([]);
        expect(kontrolleraTextrad('Ett två tre fyra fem sex sju')).toContain('7 ord (max 6)');
        expect(kontrolleraTextrad('Hej 🗓️')).toContain('emoji i textrad');
        expect(kontrolleraTextrad('VAD HÄNDER')).toContain('versaler');
        expect(kontrolleraTextrad('340 event')).toContain('siffra saknas i data: 340');
        expect(kontrolleraTextrad('340+ event', { antalGolv: '340' })).toEqual([]);
    });
});

describe('satt och byggText', () => {
    it('länkrader blir rätt per plattform', () => {
        const rader = ['Hej 👇', '@länk https://vadkul.se/e/x', '{länk}', 'Vad?'];
        expect(satt(rader, 'fb')).toBe('Hej 👇\nhttps://vadkul.se/e/x\nvadkul.se\nVad?');
        expect(satt(rader, 'ig', { hashtaggar: ['#vadkul'] })).toBe('Hej 👇\nLänk i bion ☁️\nVad?\n\n#vadkul');
    });

    it('variera är deterministisk', () => {
        expect(variera(['a', 'b', 'c'], '2026-11-03')).toBe(variera(['a', 'b', 'c'], '2026-11-03'));
        const olika = new Set(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map(d => variera(['a', 'b'], d)));
        expect(olika.size).toBe(2);
    });

    it('hashtaggar: bas + tema + stad', () => {
        expect(hashtaggar('helg', 'Växjö')).toEqual(['#vadkul', '#evenemang', '#sverige', '#ihelgen', '#växjö']);
        expect(hashtaggar('quiz')).toContain('#quiz');
    });
});

describe('alla mallar klarar kontrollen', () => {
    const fall: { tema: Tema; variant?: string; data: Record<string, string | number>; stad?: string }[] = [
        { tema: 'siffra', variant: 'vecka', data: { idagGolv: '3 400', veckaGolv: '11 000', nyaGolv: '2 100', toppKategori: 'musik', toppEmoji: '🎸' } },
        { tema: 'siffra', variant: 'helg', data: { helgGolv: '5 200', toppStad: 'Göteborg' } },
        { tema: 'gissa', data: { k1Titel: 'Laleh', k1Stad: 'Göteborg', k1Url: 'https://vadkul.se/e/a', k2Titel: 'Julmarknad', k2Stad: 'Umeå', k2Url: 'https://vadkul.se/e/b', k3Titel: 'Växjö Lakers', k3Stad: 'Växjö', k3Url: 'https://vadkul.se/e/c' } },
        { tema: 'helg', stad: 'Växjö', data: { antalGolv: '340', stad: 'Växjö', topp1: 'Lakers', topp2: 'Julmarknad', topp3: 'Stand up' } },
        { tema: 'quiz', stad: 'Växjö', data: { fraga: 'Vilken veckodag händer det minst i Växjö?', alt1: 'måndag', alt2: 'onsdag', alt3: 'lördag' } },
        { tema: 'budskap', variant: 'skapa-eget', data: {} },
        { tema: 'budskap', variant: 'appen', data: {} },
        { tema: 'budskap', variant: 'bjud-med', data: {} },
        { tema: 'budskap', variant: 'milstolpe', data: { milstolpe: '1 000 medlemmar' } },
        { tema: 'video', variant: 'ikvall', data: {} },
        { tema: 'video', variant: 'allt', data: {} },
        { tema: 'video', variant: 'hitta-pa', data: {} },
        { tema: 'video', variant: 'fredag', data: {} },
        { tema: 'video', variant: 'bjud-med', data: {} },
        { tema: 'video', variant: 'regnig', data: {} },
        { tema: 'video', variant: 'skapa-eget', data: {} },
        { tema: 'video', variant: 'helg', stad: 'Umeå', data: { antalGolv: '210', stad: 'Umeå' } },
        { tema: 'video', variant: 'okant', data: {} },
    ];

    for (const f of fall) {
        for (const fro of ['2026-11-02', '2026-11-03', '2026-11-05']) {
            it(`${f.tema}/${f.variant ?? '-'} (${fro})`, () => {
                const t = byggKontrolleradText({ ...f, fro });
                expect(kontrollera(t.fb, f.data, 'fb')).toEqual([]);
                expect(kontrollera(t.ig, f.data, 'ig')).toEqual([]);
                expect(t.ig).toContain('#vadkul');
                expect(t.fb).not.toContain('Länk i bion');
            });
        }
    }

    it('byggText med egen länk', () => {
        const t = byggText({ tema: 'helg', stad: 'Växjö', fro: 'x', lank: 'vadkul.se/evenemang/vaxjo',
            data: { antalGolv: '340', stad: 'Växjö', topp1: 'a', topp2: 'b', topp3: 'c' } });
        expect(t.fb).toContain('vadkul.se/evenemang/vaxjo');
        expect(t.ig).toContain('#växjö');
    });

    it('textraderFor klarar textradskontrollen', () => {
        for (const k of ['ikvall', 'allt', 'hitta-pa', 'fredag', 'bjud-med', 'regnig', 'skapa-eget', 'okant'] as const) {
            for (const rad of textraderFor(k)) expect(kontrolleraTextrad(rad)).toEqual([]);
        }
        const helg = textraderFor('helg', { stad: 'Umeå', antalGolv: '210' });
        expect(helg).toEqual(['I helgen i Umeå', '210 event']);
        for (const rad of helg) expect(kontrolleraTextrad(rad, { antalGolv: '210' })).toEqual([]);
    });
});
