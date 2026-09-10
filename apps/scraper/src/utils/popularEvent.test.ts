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
    it('mångfaldig titel straffas logaritmiskt — för OBILJETTERAT', () => {
        expect(popularScore(base(), 400)).toBeLessThan(popularScore(base(), 1) - 60);
    });
    it('biljettsatt flerdatums-produktion straffas INTE (Mamma Mia-fyndet 10/9)', () => {
        const mammaMia = (rc: number) => popularScore({
            url: 'https://www.ticketmaster.se/event/mamma-mia-the-party-ticket',
            title: 'MAMMA MIA! THE PARTY',
            time: '2026-09-11T19:00:00', category: 'stage', hasSpecificTime: true,
            coverImage: 'https://tm.se/bild.jpg', price: '', attendees: 0,
            locationName: 'Tyrol, Stockholm',
        }, rc);
        expect(mammaMia(30)).toBeGreaterThanOrEqual(POPULAR_THRESHOLD);
        // Unik titel får fortfarande mer än flerdatums (12 vs 6).
        expect(mammaMia(1)).toBe(mammaMia(30) + 6);
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
    it('körrep vetas (isChoirRehearsal), konserterande kör går fri', () => {
        expect(isPopularEvent(base({ title: 'Diskantkören' }), 1)).toBe(false);
        expect(isPopularEvent(base({ title: 'Julkonsert med Diskantkören' }), 1)).toBe(true);
    });
    it('seriematch utan biljett/arena faller på POÄNGEN (inget veto längre)', () => {
        // Div-matchen: ingen biljettkälla, ingen arena, ingen dragtitel —
        // bild+pris från base räcker inte till ribban.
        expect(isPopularEvent(base({ title: 'IFK Berga - Ariana FC', category: 'sport' }), 1)).toBe(false);
    });
    it('bibliotek vetas via domänen', () => {
        expect(isPopularEvent(base({ url: 'https://bibliotek.trelleborg.se/e/1' }), 1)).toBe(false);
    });
    it('trasig URL kastar inte — poängen avgör', () => {
        expect(() => isPopularEvent(base({ url: '' }), 1)).not.toThrow();
    });
});

describe('isPopularEvent — Växjö-arketyperna 10/9', () => {
    it('biljettsatt arenamatch (Växjö Lakers via Tickster på Vida Arena) → populär', () => {
        expect(isPopularEvent({
            url: 'https://www.tickster.com/se/sv/events/h6w0lfl05dh8ufp/2026-09-11/vaxjo',
            title: 'Växjö Lakers - Tappara Tempere',
            time: '2026-09-11T17:00:00', category: 'other', hasSpecificTime: true,
            coverImage: 'https://tickster.com/bild.jpg', price: null, attendees: 0,
            locationName: 'Vida Arena',
        }, 1)).toBe(true);
    });
    it('kampsportsgala på arena utan biljettkälla (FCR30, kommunkalendern) → populär', () => {
        expect(isPopularEvent({
            url: 'https://upplev.vaxjo.se/evenemang/evenemang/2026-07-01-fcr30---fight-c',
            title: 'FCR30 - Fight Club Rush',
            time: '2026-09-12T13:30:00', category: 'sport', hasSpecificTime: true,
            coverImage: 'https://vaxjo.se/bild.jpg', price: '', attendees: 0,
            locationName: 'Fortnox Arena',
        }, 1)).toBe(true);
    });
    it('betald målgruppsklass ("Dans för Parkinson", 850 kr, scen-kategori) → INTE populär', () => {
        expect(isPopularEvent({
            url: 'https://www.facebook.com/events/1721209066222367/',
            title: 'Dans för Parkinson, Växjö',
            time: '2026-09-11T12:00:00', category: 'stage', hasSpecificTime: true,
            coverImage: 'https://fb.com/bild.jpg', price: '850 kr', attendees: 0,
            locationName: 'Regionteatern',
        }, 1)).toBe(false);
    });
    it('arena i platsnamnet ger bonus, "hallen" gör det inte', () => {
        const atArena = popularScore(base({ locationName: 'Vida Arena' }), 1);
        const atHall = popularScore(base({ locationName: 'Folkets hus-hallen' }), 1);
        expect(atArena).toBe(atHall + 8);
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
