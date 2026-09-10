import { describe, it, expect } from 'vitest';
import {
    normTitlePop, buildTitleFreq, popularScore, isPopularEvent,
    isSmallVenueHost, POPULAR_THRESHOLD, PopularInput,
} from './popularEvent';

/** Fredag kväll — bästa tänkbara slot. */
const FRIDAY_EVENING = '2026-09-18T19:00:00';
/** Tisdag förmiddag. */
const TUESDAY_MORNING = '2026-09-15T09:00:00';

const base = (over: Partial<PopularInput> = {}): PopularInput => ({
    url: 'https://exempelscenen.se/event/1',
    title: 'Höstkonsert med storbandet',
    time: FRIDAY_EVENING,
    category: 'music',
    hasSpecificTime: true,
    coverImage: 'https://exempelscenen.se/bild.jpg',
    price: '250 kr',
    attendees: 0,
    ...over,
});

describe('normTitlePop', () => {
    it('normaliserar som webbens normTitle (spegeltestet)', () => {
        expect(normTitlePop('Höst-Konsert!  (Premiär)')).toBe('höst konsert premiär');
    });
});

describe('buildTitleFreq', () => {
    it('räknar normaliserade titlar och hoppar tomma', () => {
        const freq = buildTitleFreq([
            { title: 'Sommarcafé' }, { title: 'sommarcafé!' }, { title: 'Unik grej' },
            { title: null }, { title: '···' },
        ]);
        // é ingår inte i webbens [a-zåäö]-klass — nyckeln blir "sommarcaf",
        // exakt som cityData:s normTitle. Speglingen är poängen.
        expect(freq.get('sommarcaf')).toBe(2);
        expect(freq.get('unik grej')).toBe(1);
        expect(freq.size).toBe(2);
    });
});

describe('isSmallVenueHost', () => {
    it('vetar bibliotek, hembygd och studieförbund', () => {
        expect(isSmallVenueHost('https://bibliotek.stockholm.se/x')).toBe(true);
        expect(isSmallVenueHost('https://www.hembygd.se/forening/x')).toBe(true);
        expect(isSmallVenueHost('https://kalender.abf.se/x')).toBe(true);
        expect(isSmallVenueHost('https://www.sv.se/avdelning/x')).toBe(true);
    });
    it('sv.se-vetot är exakt suffix — träffar ALDRIG svenskakyrkan m.fl.', () => {
        expect(isSmallVenueHost('https://www.svenskakyrkan.se/x')).toBe(false);
        expect(isSmallVenueHost('https://allsvenskan.se/x')).toBe(false);
        expect(isSmallVenueHost('https://sv.wikipedia.org/x')).toBe(false);
    });
    it('trasig URL kastar inte', () => {
        expect(isSmallVenueHost('inte en url')).toBe(false);
    });
});

describe('popularScore', () => {
    it('TM-konsert med bild+pris en fredagkväll får hög poäng', () => {
        const s = popularScore(base({ url: 'https://www.ticketmaster.se/event/123' }), 1);
        expect(s).toBeGreaterThanOrEqual(POPULAR_THRESHOLD + 20);
    });
    it('affiliate-länken (evyy.net) väger som Ticketmaster', () => {
        const tm = popularScore(base({ url: 'https://www.ticketmaster.se/e/1' }), 1);
        const aff = popularScore(base({ url: 'https://ticketmaster.evyy.net/c/7528311/x' }), 1);
        expect(aff).toBe(tm);
    });
    it('övriga biljettsystem ger mindre än TM men mer än inget', () => {
        const none = popularScore(base(), 1);
        const tickster = popularScore(base({ url: 'https://www.tickster.com/sv/e/1' }), 1);
        const tm = popularScore(base({ url: 'https://www.ticketmaster.se/e/1' }), 1);
        expect(tickster).toBeGreaterThan(none);
        expect(tm).toBeGreaterThan(tickster);
    });
    it('mångfaldig titel straffas logaritmiskt', () => {
        expect(popularScore(base(), 400)).toBeLessThan(popularScore(base(), 1) - 60);
    });
    it('vardagsförmiddag utan bild/pris hamnar långt under ribban', () => {
        const s = popularScore(base({
            time: TUESDAY_MORNING, category: 'social',
            coverImage: null, price: null, title: 'Fikaträff',
        }), 1);
        expect(s).toBeLessThan(POPULAR_THRESHOLD);
    });
});

describe('isPopularEvent — veton', () => {
    it('kyrkan/PRO/Korpen vetas oavsett poäng', () => {
        for (const url of [
            'https://www.svenskakyrkan.se/kalender/1',
            'https://pro.se/aktivitet/2',
            'https://korpenstockholm.zoezi.se/x',
        ]) {
            expect(isPopularEvent(base({ url }), 1)).toBe(false);
        }
    });
    it('gudstjänst vetas trots kvällstid, bild och pris', () => {
        expect(isPopularEvent(base({ title: 'Gudstjänst med kyrkokören' }), 1)).toBe(false);
    });
    it('körrep vetas (isNoiseEvent), konserterande kör går fri', () => {
        expect(isPopularEvent(base({ title: 'Diskantkören' }), 1)).toBe(false);
        expect(isPopularEvent(base({ title: 'Julkonsert med Diskantkören' }), 1)).toBe(true);
    });
    it('seriematch "Lag - Lag" vetas', () => {
        expect(isPopularEvent(base({ title: 'IFK Berga - Ariana FC', category: 'sport' }), 1)).toBe(false);
    });
    it('bibliotek vetas via domänen', () => {
        expect(isPopularEvent(base({ url: 'https://bibliotek.trelleborg.se/e/1' }), 1)).toBe(false);
    });
    it('trasig URL kastar inte — poängen avgör', () => {
        expect(() => isPopularEvent(base({ url: '' }), 1)).not.toThrow();
    });
});

describe('isPopularEvent — ribban', () => {
    it('rutintitel ×400 hamnar under även med bild', () => {
        expect(isPopularEvent(base({ title: 'Torsdagsdans', category: 'social', price: null }), 400)).toBe(false);
    });
    it('flaggar exakt på tröskeln, inte under', () => {
        const e = base();
        const s = popularScore(e, 1);
        expect(s).toBeGreaterThanOrEqual(POPULAR_THRESHOLD);
        // Trappa ned med repeatCount tills vi passerar ribban — inga hopp.
        let rc = 1;
        while (popularScore(e, rc) >= POPULAR_THRESHOLD && rc < 10_000) rc *= 2;
        expect(isPopularEvent(e, rc)).toBe(false);
    });
});
