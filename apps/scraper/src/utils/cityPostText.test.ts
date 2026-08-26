import { describe, it, expect } from 'vitest';
import {
    buildCityPostText, buildIgCaption, endOfPublishWeek, formatCityRow, hashtagFor,
    IG_CAPTION_MAX, isNoiseEvent, pickCityRows, shortVenue, type CityEventRow,
} from './cityPostText';

const ev = (over: Partial<CityEventRow>): CityEventRow => ({
    url: 'https://ex.se/' + Math.random(),
    title: 'Event',
    time: '2026-08-22T19:00:00+02:00',
    locationName: 'Lokalen',
    category: 'music',
    lat: 0, lng: 0,
    ...over,
});

// Fredag 21 aug 2026 kl 08:00 lokal tid — samma dag som första skarpa körningen.
const FRI = new Date(2026, 7, 21, 8, 0, 0).getTime();

describe('isNoiseEvent', () => {
    it('filtrerar korpenmatcher men inte riktiga sporthändelser', () => {
        expect(isNoiseEvent({ title: 'FC Pumas - Ta En Kaka Stefan', category: 'sport' })).toBe(true);
        expect(isNoiseEvent({ title: 'Huddinge parkrun #298', category: 'sport' })).toBe(false);
        expect(isNoiseEvent({ title: 'DRIFT SM 2026 - FINALEN', category: 'sport' })).toBe(false);
    });

    it('filtrerar kyrko-/förskolerutiner men inte konserter i kyrkan', () => {
        expect(isNoiseEvent({ title: 'Öppen förskola', category: 'family' })).toBe(true);
        expect(isNoiseEvent({ title: 'Kyrkan är öppen', category: 'other' })).toBe(true);
        expect(isNoiseEvent({ title: 'Orgelmatiné "Bach 14"', category: 'music' })).toBe(false);
        expect(isNoiseEvent({ title: 'Lunchmässa', category: 'market' })).toBe(true);
        expect(isNoiseEvent({ title: 'Nicodemuskören övar kl 18.30!', category: 'music' })).toBe(true);
        expect(isNoiseEvent({ title: 'Måltid med mening', category: 'food' })).toBe(true);
    });
});

describe('endOfPublishWeek', () => {
    it('fredag → söndag samma vecka', () => {
        const end = new Date(endOfPublishWeek(FRI));
        expect(end.getDay()).toBe(0);
        expect(end.getDate()).toBe(23);
    });
    it('söndag → samma dygn', () => {
        const sun = new Date(2026, 7, 23, 9, 0).getTime();
        expect(new Date(endOfPublishWeek(sun)).getDate()).toBe(23);
    });
});

describe('pickCityRows', () => {
    it('delar helg/nästa vecka vid söndagsgränsen och rensar dubbletter', () => {
        const rows = pickCityRows([
            ev({ title: 'Wilmer X', time: '2026-08-22T19:30:00+02:00', locationName: 'Kackelstugan' }),
            ev({ title: 'Wilmer X - Kackelstugan Ute', time: '2026-08-22T19:30:00+02:00', locationName: 'Kackelstugan Ute' }),
            ev({ title: 'Operaafton', time: '2026-08-26T19:00:00+02:00', category: 'stage' }),
        ], FRI);
        expect(rows.thisWeek.map(e => e.title)).toEqual(['Wilmer X']);
        expect(rows.nextWeek.map(e => e.title)).toEqual(['Operaafton']);
    });

    it('rankar dragplåster över rutiner när taket nås, men listar kronologiskt', () => {
        const rows = pickCityRows([
            ev({ title: 'Stickcafé', time: '2026-08-22T10:00:00+02:00', category: 'social', locationName: 'A' }),
            ev({ title: 'Konsert', time: '2026-08-22T20:00:00+02:00', category: 'music', locationName: 'B' }),
            ev({ title: 'Loppis', time: '2026-08-22T11:00:00+02:00', category: 'market', locationName: 'C' }),
        ], FRI, { maxThisWeek: 2 });
        expect(rows.thisWeek.map(e => e.title)).toEqual(['Loppis', 'Konsert']);
    });
});

describe('formatCityRow + shortVenue', () => {
    it('kortar platsen till venue-delen och skippar den när titeln redan säger den', () => {
        expect(shortVenue('Konsert', 'Kapellet Norrtälje, Norrtälje-Malsta församling')).toBe('Kapellet Norrtälje');
        expect(shortVenue('Wilmer X på Kackelstugan', 'Kackelstugan')).toBe('');
        expect(shortVenue('Viktor Norén & Björn Dixgård', 'Kalmar', 'Kalmar')).toBe('');
    });

    it('skriver veckodag, valfritt datum och bara klockslag när det finns', () => {
        const e = ev({ title: 'Konsert', time: '2026-08-28T19:30:00+02:00', locationName: 'Kapellet' });
        expect(formatCityRow(e)).toBe('🎵 Konsert — Kapellet (fredag kl 19.30)');
        expect(formatCityRow(e, { withDate: true })).toContain('fredag 28/8 kl 19.30');
        const noTime = ev({ title: 'Marknad', time: '2026-08-22T00:00:00+02:00', category: 'market', locationName: 'Torget' });
        expect(formatCityRow(noTime)).toBe('🛍️ Marknad — Torget (lördag)');
    });

    it('flerdagarsevent skrivs som spann (Live at Heart-regeln 26/8)', () => {
        const fest = ev({
            title: 'Live at Heart', time: '2026-09-02T10:00:00+02:00',
            endDate: '2026-09-05T23:00:00+02:00', category: 'music', locationName: 'Örebro',
        });
        expect(formatCityRow(fest)).toBe('🎵 Live at Heart — Örebro (onsdag–lördag kl 10)');
        expect(formatCityRow(fest, { withDate: true })).toContain('onsdag 2/9–lördag 5/9 kl 10');
        // Sluttid SAMMA dag är brus i det täta formatet — inget spann.
        const konsert = ev({
            title: 'Konsert', time: '2026-08-28T19:30:00+02:00',
            endDate: '2026-08-28T23:00:00+02:00', locationName: 'Kapellet',
        });
        expect(formatCityRow(konsert)).toBe('🎵 Konsert — Kapellet (fredag kl 19.30)');
    });
});

describe('buildCityPostText', () => {
    const rows = pickCityRows([
        ev({ title: 'Konsert', time: '2026-08-22T20:00:00+02:00', locationName: 'Parken' }),
        ev({ title: 'Operaafton', time: '2026-08-26T19:00:00+02:00', category: 'stage', locationName: 'Kyrkan' }),
    ], FRI);

    it('bygger två sektioner, länk och vi-röst', () => {
        const text = buildCityPostText('Kalmar', 'https://vadkul.se/evenemang/kalmar', rows, FRI);
        expect(text).toContain('Och nästa vecka:');
        expect(text).toContain('https://vadkul.se/evenemang/kalmar');
        expect(text).toContain('onsdag 26/8');   // nästa vecka-rader får datum
        expect(text).not.toMatch(/\bjag\b/i);    // Sidans röst är "vi"
    });

    it('är deterministisk för samma ort+dag och varierar mellan orter', () => {
        const a1 = buildCityPostText('Kalmar', 'x', rows, FRI);
        const a2 = buildCityPostText('Kalmar', 'x', rows, FRI);
        expect(a1).toBe(a2);
        const towns = ['Kalmar', 'Borås', 'Norrtälje', 'Sollefteå', 'Umeå', 'Lund'];
        const openers = new Set(towns.map(t => buildCityPostText(t, 'x', rows, FRI).split('\n')[0].replace(t, 'X')));
        expect(openers.size).toBeGreaterThan(1);
    });
});


describe('buildIgCaption', () => {
    const text = 'Veckan i Malmö 👇\n\n🎵 Kishi Bashi — Babel (tisdag kl 19)\n\nvadkul.se/evenemang/malmo';

    it('lämnar den kurerade texten orörd och lägger taggarna sist', () => {
        const caption = buildIgCaption(text, 'Malmö');
        expect(caption.startsWith(text)).toBe(true);
        expect(caption.endsWith('#vadkul #malmö #evenemang #dethänder')).toBe(true);
    });

    it('gör ortnamnet till en hashtag utan mellanslag', () => {
        expect(hashtagFor('Malmö')).toBe('malmö');
        expect(hashtagFor('Upplands Väsby')).toBe('upplandsväsby');
        expect(hashtagFor('Säffle-Åmål')).toBe('säffleåmål');
    });

    it('kapar brödtexten men aldrig taggarna när IG:s tak nås', () => {
        const caption = buildIgCaption('x'.repeat(IG_CAPTION_MAX + 500), 'Lund');
        expect(caption.length).toBeLessThanOrEqual(IG_CAPTION_MAX);
        expect(caption.endsWith('#vadkul #lund #evenemang #dethänder')).toBe(true);
    });
});
