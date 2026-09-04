import { describe, it, expect } from 'vitest';
import {
    parseSoleilDate, mapSoleilItem, parseRestAppDate, mapRestAppHit, pickCityFromVenue, cleanCardTitle, mapPageApiItem, mapEventServiceItem, isMunicipalMeeting,
    parseSearchAppDate, mapSearchAppHit, parseSearchAppDetail, mapEventListingResult,
} from './sitevision';

describe('parseSoleilDate', () => {
    it('YYYY-MM-DD + HH:MM → lokal tid med klocka', () => {
        const r = parseSoleilDate('2026-07-10', '18:00');
        expect(r?.date.getFullYear()).toBe(2026);
        expect(r?.date.getMonth()).toBe(6); // juli = 6
        expect(r?.date.getDate()).toBe(10);
        expect(r?.date.getHours()).toBe(18);
        expect(r?.hasClock).toBe(true);
    });

    it('utan tid (null) → midnatt + hasClock=false', () => {
        const r = parseSoleilDate('2026-07-10', null);
        expect(r?.date.getHours()).toBe(0);
        expect(r?.hasClock).toBe(false);
    });

    it('punkt-klocka "18.30" normaliseras', () => {
        const r = parseSoleilDate('2026-07-10', '18.30');
        expect(r?.date.getHours()).toBe(18);
        expect(r?.date.getMinutes()).toBe(30);
    });

    it('skräp → null', () => {
        expect(parseSoleilDate('10/07/2026', null)).toBeNull();
        expect(parseSoleilDate(undefined, '18:00')).toBeNull();
    });
});

describe('mapSoleilItem', () => {
    const BASE_URL = 'https://malmo.se/evenemangskalender';
    const item = {
        id: '5.50574bcf196ed960a55951',
        title: 'Stort Junior 3D',
        url: '/Uppleva-och-gora/Evenemang/Evenemang-i-Malmo/Evenemangssida.html?id=5.50574bcf196ed960a55951',
        desc: 'Vetenskapsfilm på 360-gradersduk.',
        image: 'https://devenemang.malmo.se/images/bild.jpg',
        place: ['Malmö museum'],
        dates: { date: '2026-07-10', time: null, locations: ['Malmö museum'] },
    };

    it('relativ intern URL görs absolut mot malmo.se', () => {
        const ev = mapSoleilItem(item, BASE_URL, 'Malmö')!;
        expect(ev.url).toBe('https://malmo.se/Uppleva-och-gora/Evenemang/Evenemang-i-Malmo/Evenemangssida.html?id=5.50574bcf196ed960a55951');
        expect(ev.title).toBe('Stort Junior 3D');
        expect(ev.venueName).toBe('Malmö museum');
        expect(ev.city).toBe('Malmö');
        expect(ev.hasSpecificTime).toBeUndefined(); // date-only → runnerns heuristik
    });

    it('extern absolut URL lämnas orörd (typeOfEvent=external)', () => {
        const ev = mapSoleilItem(
            { ...item, url: 'https://odet.nu/farmers-market/' },
            BASE_URL, 'Malmö',
        )!;
        expect(ev.url).toBe('https://odet.nu/farmers-market/');
    });

    it('klockslag → hasSpecificTime=true', () => {
        const ev = mapSoleilItem(
            { ...item, dates: { date: '2026-07-10', time: '18:00' } },
            BASE_URL, 'Malmö',
        )!;
        expect(ev.hasSpecificTime).toBe(true);
        expect(ev.startDate.getHours()).toBe(18);
    });

    it('place[] tom → fallback till dates.locations', () => {
        const ev = mapSoleilItem(
            { ...item, place: [], dates: { date: '2026-07-10', time: null, locations: ['Rosengårdsbiblioteket'] } },
            BASE_URL, 'Malmö',
        )!;
        expect(ev.venueName).toBe('Rosengårdsbiblioteket');
    });

    it('titel- eller datum-lösa items → null', () => {
        expect(mapSoleilItem({ ...item, title: '' }, BASE_URL, 'Malmö')).toBeNull();
        expect(mapSoleilItem({ ...item, dates: {} }, BASE_URL, 'Malmö')).toBeNull();
    });
});

describe('parseRestAppDate', () => {
    it('"YYYY-MM-DD HH:MM" → lokal tid med klocka', () => {
        const r = parseRestAppDate('2026-07-24 18:00');
        expect(r?.date.getFullYear()).toBe(2026);
        expect(r?.date.getMonth()).toBe(6);
        expect(r?.date.getDate()).toBe(24);
        expect(r?.date.getHours()).toBe(18);
        expect(r?.hasClock).toBe(true);
    });

    it('"00:00" behandlas som datum utan tid', () => {
        const r = parseRestAppDate('2026-07-20 00:00');
        expect(r?.date.getHours()).toBe(0);
        expect(r?.hasClock).toBe(false);
    });

    it('bara datum utan klocka funkar', () => {
        const r = parseRestAppDate('2026-07-20');
        expect(r?.hasClock).toBe(false);
    });

    it('skräp → null', () => {
        expect(parseRestAppDate('24/07/2026 18:00')).toBeNull();
        expect(parseRestAppDate(undefined)).toBeNull();
        expect(parseRestAppDate('')).toBeNull();
    });
});

describe('mapRestAppHit', () => {
    const BASE_URL = 'https://visiteskilstuna.se/evenemangsguiden/evenemangsguiden';
    const hit = {
        id: '5.3274af7f19d24e4a02a5b98',
        title: 'Countryfesten med Jill Johnson',
        description: 'Parken Zoo möter Nashville.',
        uri: '/evenemangsguiden/evenemangsguiden/evenemang/2026-03-26-countryfesten',
        url: 'https://visiteskilstuna.se/evenemangsguiden/evenemangsguiden/evenemang/2026-03-26-countryfesten',
        image: { src: 'https://visiteskilstuna.se/images/18.x/jill.webp' },
        info: {
            start: '2026-07-24 18:00',
            end: '2026-07-24 21:00',
            location: { name: 'Parken Zoo', id: '4.abc' },
        },
    };

    it('fullt hit → komplett RawEvent', () => {
        const ev = mapRestAppHit(hit, BASE_URL, 'Eskilstuna')!;
        expect(ev.externalId).toBe('5.3274af7f19d24e4a02a5b98');
        expect(ev.title).toBe('Countryfesten med Jill Johnson');
        expect(ev.startDate.getHours()).toBe(18);
        expect(ev.endDate?.getHours()).toBe(21);
        expect(ev.url).toBe(hit.url);
        expect(ev.venueName).toBe('Parken Zoo');
        expect(ev.city).toBe('Eskilstuna');
        expect(ev.geocodeCandidates).toBeUndefined();
        expect(ev.imageUrl).toBe('https://visiteskilstuna.se/images/18.x/jill.webp');
        expect(ev.hasSpecificTime).toBe(true);
    });

    it('"Digitalt evenemang" → geocode ankras på staden', () => {
        const ev = mapRestAppHit(
            { ...hit, info: { ...hit.info, location: { name: 'Digitalt evenemang' } } },
            BASE_URL, 'Eskilstuna',
        )!;
        expect(ev.venueName).toBe('Digitalt evenemang');
        expect(ev.geocodeCandidates).toEqual(['Eskilstuna']);
    });

    it('end före start ignoreras', () => {
        const ev = mapRestAppHit(
            { ...hit, info: { ...hit.info, end: '2026-07-23 21:00' } },
            BASE_URL, 'Eskilstuna',
        )!;
        expect(ev.endDate).toBeUndefined();
    });

    it('url saknas → uri görs absolut', () => {
        const ev = mapRestAppHit({ ...hit, url: undefined }, BASE_URL, 'Eskilstuna')!;
        expect(ev.url).toBe('https://visiteskilstuna.se/evenemangsguiden/evenemangsguiden/evenemang/2026-03-26-countryfesten');
    });

    it('titel- eller startlösa hits → null', () => {
        expect(mapRestAppHit({ ...hit, title: '' }, BASE_URL, 'Eskilstuna')).toBeNull();
        expect(mapRestAppHit({ ...hit, info: {} }, BASE_URL, 'Eskilstuna')).toBeNull();
    });
});

// ── searchApp-varianten (visit.norrkoping.se) ────────────────────────────────

describe('parseSearchAppDate', () => {
    // Alla fall ankras på en fast "nu" så årsgissningen är deterministisk.
    const NOW = new Date(2026, 7, 9); // 9 aug 2026

    it('"9 aug" → innevarande år, midnatt', () => {
        const r = parseSearchAppDate('9 aug', NOW)!;
        expect(r.start.getFullYear()).toBe(2026);
        expect(r.start.getMonth()).toBe(7);
        expect(r.start.getDate()).toBe(9);
        expect(r.start.getHours()).toBe(0);
        expect(r.end).toBeUndefined();
    });

    it('"13 mar 2027" → explicit år vinner', () => {
        const r = parseSearchAppDate('13 mar 2027', NOW)!;
        expect(r.start.getFullYear()).toBe(2027);
        expect(r.start.getMonth()).toBe(2);
        expect(r.start.getDate()).toBe(13);
    });

    it('årslöst datum långt bakåt tolkas som nästa år', () => {
        // "5 feb" sett i augusti → feb 2027, inte feb 2026.
        const r = parseSearchAppDate('5 feb', NOW)!;
        expect(r.start.getFullYear()).toBe(2027);
        expect(r.start.getMonth()).toBe(1);
    });

    it('nyss passerat årslöst datum behåller innevarande år', () => {
        const r = parseSearchAppDate('1 aug', NOW)!;
        expect(r.start.getFullYear()).toBe(2026);
    });

    it('"5 aug - 6 sep" → intervall med start och slut', () => {
        const r = parseSearchAppDate('5 aug - 6 sep', NOW)!;
        expect(r.start.getMonth()).toBe(7);
        expect(r.start.getDate()).toBe(5);
        expect(r.end!.getMonth()).toBe(8);
        expect(r.end!.getDate()).toBe(6);
    });

    it('"13 - 15 aug" → månaden ärvs från slutdatumet', () => {
        const r = parseSearchAppDate('13 - 15 aug', NOW)!;
        expect(r.start.getMonth()).toBe(7);
        expect(r.start.getDate()).toBe(13);
        expect(r.end!.getDate()).toBe(15);
    });

    it('"25 sep 2026 - 27 jan 2027" → intervall över årsskiftet', () => {
        const r = parseSearchAppDate('25 sep 2026 - 27 jan 2027', NOW)!;
        expect(r.start.getFullYear()).toBe(2026);
        expect(r.start.getMonth()).toBe(8);
        expect(r.end!.getFullYear()).toBe(2027);
        expect(r.end!.getMonth()).toBe(0);
    });

    it('tankstreck (–) fungerar som avgränsare', () => {
        const r = parseSearchAppDate('4 – 6 sep', NOW)!;
        expect(r.start.getDate()).toBe(4);
        expect(r.end!.getDate()).toBe(6);
    });

    it('skräp → null', () => {
        expect(parseSearchAppDate('', NOW)).toBeNull();
        expect(parseSearchAppDate(undefined, NOW)).toBeNull();
        expect(parseSearchAppDate('Löpande', NOW)).toBeNull();
        expect(parseSearchAppDate('9 smurf', NOW)).toBeNull();
    });
});

describe('mapSearchAppHit', () => {
    const BASE_URL = 'https://visit.norrkoping.se/kalender';
    const NOW = new Date(2026, 7, 9);
    const WINDOW_START = new Date(2026, 7, 9);
    const hit = {
        id: '4.523ac55219e631884d623c9',
        title: 'Kyrkogårdsvandring – Matteus kyrkogård',
        summary: 'Följ med på en kulturhistorisk vandring.',
        date: '9 aug',
        image: '/images/200.5048c0b619e632d671f25b7/1780653034701/Kyrko.png',
        url: '/se-och-gora/evenemangskalender/evenemang-augusti-2026/kyrkogardsvandring---matteus-kyrkogard',
        categories: 'Citynära, Guidning, Museum',
        type: 'event',
    };

    it('fullt hit → komplett RawEvent med absoluta URL:er', () => {
        const ev = mapSearchAppHit(hit, BASE_URL, 'Norrköping', WINDOW_START, NOW)!;
        expect(ev.externalId).toBe('4.523ac55219e631884d623c9');
        expect(ev.title).toBe('Kyrkogårdsvandring – Matteus kyrkogård');
        expect(ev.url).toBe('https://visit.norrkoping.se/se-och-gora/evenemangskalender/evenemang-augusti-2026/kyrkogardsvandring---matteus-kyrkogard');
        expect(ev.imageUrl).toBe('https://visit.norrkoping.se/images/200.5048c0b619e632d671f25b7/1780653034701/Kyrko.png');
        expect(ev.city).toBe('Norrköping');
        expect(ev.description).toBe('Följ med på en kulturhistorisk vandring.');
        // Listan saknar klockslag — runnerns heuristik får avgöra tills
        // detaljsidan berikat eventet.
        expect(ev.hasSpecificTime).toBeUndefined();
    });

    it('pågående fleradagars-event ankras på windowStart', () => {
        const ev = mapSearchAppHit(
            { ...hit, date: '6 jun - 31 aug' }, BASE_URL, 'Norrköping', WINDOW_START, NOW,
        )!;
        expect(ev.startDate.getTime()).toBe(WINDOW_START.getTime());
        expect(ev.endDate!.getMonth()).toBe(7);
        expect(ev.endDate!.getDate()).toBe(31);
    });

    it('framtida intervall behåller sitt riktiga startdatum', () => {
        const ev = mapSearchAppHit(
            { ...hit, date: '29 aug - 13 sep' }, BASE_URL, 'Norrköping', WINDOW_START, NOW,
        )!;
        expect(ev.startDate.getMonth()).toBe(7);
        expect(ev.startDate.getDate()).toBe(29);
    });

    it('icke-event-typer filtreras bort', () => {
        expect(mapSearchAppHit({ ...hit, type: 'place' }, BASE_URL, 'Norrköping', WINDOW_START, NOW)).toBeNull();
    });

    it('titel-, url- eller datumlösa hits → null', () => {
        expect(mapSearchAppHit({ ...hit, title: '' }, BASE_URL, 'Norrköping', WINDOW_START, NOW)).toBeNull();
        expect(mapSearchAppHit({ ...hit, url: undefined }, BASE_URL, 'Norrköping', WINDOW_START, NOW)).toBeNull();
        expect(mapSearchAppHit({ ...hit, date: 'Löpande' }, BASE_URL, 'Norrköping', WINDOW_START, NOW)).toBeNull();
    });
});

describe('parseSearchAppDetail', () => {
    const HTML = `
      <div class="vn-object-page__occasions">
        <div class="vn-object-page__occasion-item-metadata-row">
          <span class="vn-object-page__occasion-item-metadata-time-icon" aria-hidden="true"></span>
          <span class="show-for-sr">Tid:</span>19:00&#150;20:40
        </div>
        <div class="vn-object-page__occasion-item-metadata-row">
          <span class="vn-object-page__occasion-item-metadata-location-icon" aria-hidden="true"></span>
          <span class="show-for-sr">Plats:</span>Flygeln
        </div>
      </div>
      <div class="vn-object-page__information-box-metadata-item">
        <div class="vn-object-page__information-box-metadata-item-title">
          <span class="vn-object-page__information-box-metadata-email" aria-hidden="true"></span>E-postadress</div>
        <div class="vn-object-page__information-box-metadata-item-value">
          <a href="mailto:x@y.se">x@y.se</a></div>
      </div>
      <div class="vn-object-page__information-box-metadata-item">
        <div class="vn-object-page__information-box-metadata-item-title">
          <span class="vn-object-page__information-box-metadata-address" aria-hidden="true"></span>Adress</div>
        <div class="vn-object-page__information-box-metadata-item-value">Holmengatan 4, 602 32 Norrköping</div>
      </div>
      <div class="vn-object-page__information-map">
        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1d519.86!2d16.18078509919739!3d58.5879991!2m3!1f0"></iframe>
      </div>`;

    it('plockar tid, plats, adress och koordinater', () => {
        const d = parseSearchAppDetail(HTML);
        expect(d.time).toBe('19:00–20:40');
        expect(d.venueName).toBe('Flygeln');
        expect(d.address).toBe('Holmengatan 4, 602 32 Norrköping');
        expect(d.coords).toEqual([58.5879991, 16.18078509919739]);
    });

    it('E-postadress förväxlas inte med Adress', () => {
        expect(parseSearchAppDetail(HTML).address).not.toContain('@');
    });

    it('koordinater utanför Sverige förkastas', () => {
        const foreign = HTML.replace('!2d16.18078509919739!3d58.5879991', '!2d-73.9857!3d40.7484');
        expect(parseSearchAppDetail(foreign).coords).toBeUndefined();
    });

    it('sida utan fälten → tomt objekt, inget kast', () => {
        expect(parseSearchAppDetail('<html><body><p>404</p></body></html>')).toEqual({});
    });
});

describe('pickCityFromVenue', () => {
    const CITIES = ['Köping', 'Arboga', 'Kungsör'];

    it('plockar orten ur venue-namnets suffix', () => {
        expect(pickCityFromVenue('Mötesplats Tallåsgården, Kungsör', CITIES, 'Köping')).toBe('Kungsör');
    });

    it('matchar orten var som helst i namnet', () => {
        expect(pickCityFromVenue('Arboga bibliotek', CITIES, 'Köping')).toBe('Arboga');
        expect(pickCityFromVenue('Medborgarhuset Arboga', CITIES, 'Köping')).toBe('Arboga');
    });

    it('faller tillbaka på defaultCity utan träff', () => {
        expect(pickCityFromVenue('Malmberga Loge', CITIES, 'Köping')).toBe('Köping');
        expect(pickCityFromVenue(undefined, CITIES, 'Köping')).toBe('Köping');
    });

    it('rör inte källor utan cities-lista', () => {
        expect(pickCityFromVenue('Arboga bibliotek', undefined, 'Eskilstuna')).toBe('Eskilstuna');
        expect(pickCityFromVenue('Arboga bibliotek', [], 'Eskilstuna')).toBe('Eskilstuna');
    });

    it('längsta träffen vinner när ett ortnamn är prefix till ett annat', () => {
        expect(pickCityFromVenue('Bygdegården i Västra Ämtervik', ['Ämtervik', 'Västra Ämtervik'], 'Sunne'))
            .toBe('Västra Ämtervik');
    });

    it('är skiftlägesokänslig', () => {
        expect(pickCityFromVenue('KÖPINGS STADSHOTELL', CITIES, 'Arboga')).toBe('Köping');
    });
});

describe('cleanCardTitle', () => {
    const OPTS = { titleStripRe: /^Evenemang\s+/i, stripVenue: true };

    it('tar bort både kategorietikett och venue-svans (vaggeryd.se)', () => {
        expect(cleanCardTitle('Evenemang Mareld - Piratlajv Berghems Lajvby, Skillingaryd', 'Berghems Lajvby, Skillingaryd', OPTS))
            .toBe('Mareld - Piratlajv');
        expect(cleanCardTitle('Evenemang Bokcirklar för ungdomar Vaggeryds bibliotek', 'Vaggeryds bibliotek', OPTS))
            .toBe('Bokcirklar för ungdomar');
    });

    it('rör inte titeln utan opt-in', () => {
        const raw = 'Evenemang Bio: Marsuplami Folkets hus i Vaggeryd';
        expect(cleanCardTitle(raw, 'Folkets hus i Vaggeryd')).toBe(raw);
    });

    it('behåller venue-namnet när det hör till titeln', () => {
        expect(cleanCardTitle('Konsert i Berghems Lajvby', 'Berghems Lajvby', OPTS))
            .toBe('Konsert i Berghems Lajvby');
    });

    it('kapar inte när för lite blir kvar', () => {
        expect(cleanCardTitle('Bio Folkets hus', 'Folkets hus', OPTS)).toBe('Bio Folkets hus');
    });

    it('matchar venue skiftlägesokänsligt och normaliserar blanksteg', () => {
        expect(cleanCardTitle('Evenemang  Shared   reading   VAGGERYDS BIBLIOTEK', 'Vaggeryds bibliotek', OPTS))
            .toBe('Shared reading');
    });

    it('klarar saknad venue', () => {
        expect(cleanCardTitle('Evenemang WIK-dagen 2026', undefined, OPTS)).toBe('WIK-dagen 2026');
    });
});

describe('mapPageApiItem', () => {
    const BASE = 'https://www.varmdo.se/upplevaochgora/evenemang.html';
    const ITEM = {
        id: '5.3a37c4d819e632d26612cf',
        displayName: 'Pratb&auml;nk p&aring; Gustavsg&aring;rden',
        URI: '/upplevaochgora/evenemang/pratbank.5.467d267619ed4689c71472.html',
        startDate: 1787832000000,
        endDate: 1787835600000,
        img: '/images/200.360bac7a19ed441e94fd67/fotoparken.jpg',
        text: 'Kom och prata bort en stund.',
    };

    it('läser epoch-ms som riktig tid', () => {
        const e = mapPageApiItem(ITEM, BASE, 'Gustavsberg')!;
        expect(e.startDate.getTime()).toBe(1787832000000);
        expect(e.endDate?.getTime()).toBe(1787835600000);
    });

    it('avkodar entiteter i titeln', () => {
        expect(mapPageApiItem(ITEM, BASE, 'Gustavsberg')!.title).toBe('Pratbänk på Gustavsgården');
    });

    it('gör URI och bild absoluta', () => {
        const e = mapPageApiItem(ITEM, BASE, 'Gustavsberg')!;
        expect(e.url).toBe('https://www.varmdo.se/upplevaochgora/evenemang/pratbank.5.467d267619ed4689c71472.html');
        expect(e.imageUrl).toBe('https://www.varmdo.se/images/200.360bac7a19ed441e94fd67/fotoparken.jpg');
    });

    it('struntar i sluttid som inte ligger efter starttid', () => {
        expect(mapPageApiItem({ ...ITEM, endDate: ITEM.startDate }, BASE, 'X')!.endDate).toBeUndefined();
        expect(mapPageApiItem({ ...ITEM, endDate: undefined }, BASE, 'X')!.endDate).toBeUndefined();
    });

    it('avvisar poster utan titel, URI eller giltig epoch', () => {
        expect(mapPageApiItem({ ...ITEM, displayName: '' }, BASE, 'X')).toBeNull();
        expect(mapPageApiItem({ ...ITEM, URI: undefined }, BASE, 'X')).toBeNull();
        expect(mapPageApiItem({ ...ITEM, startDate: 0 }, BASE, 'X')).toBeNull();
        expect(mapPageApiItem({ ...ITEM, startDate: undefined }, BASE, 'X')).toBeNull();
    });
});

describe('mapEventServiceItem', () => {
    const BASE = 'https://www.vansbro.se/arkiv/evenemang.html';
    const IT = {
        identifier: '5.4755fb0619b828d3dbd7cb0b',
        name: 'Vansbro Bio &ndash; Five Nights at Freddy&apos;s 2',
        uri: 'https://www.vansbro.se/arkiv/evenemang/evenemang/2026-01-08-vansbro-bio.html',
        startDate: '2026-01-09T21:00:00+01:00',
        endDate: '2026-01-09T22:44:00+01:00',
        startTime: '21:00',
        location: 'Medborgarhuset, Norra Allégatan 30, 78631 Vansbro',
        description: 'Skräckfenomenet är tillbaka.',
        image: { uri: 'https://www.vansbro.se/images/18.x/fnaf.jpg' },
    };

    it('läser ISO-datum med offset och full adress', () => {
        const e = mapEventServiceItem(IT, BASE, 'Vansbro')!;
        expect(e.startDate.toISOString()).toBe('2026-01-09T20:00:00.000Z');
        expect(e.endDate?.toISOString()).toBe('2026-01-09T21:44:00.000Z');
        expect(e.address).toBe('Medborgarhuset, Norra Allégatan 30, 78631 Vansbro');
        expect(e.city).toBe('Vansbro');
        expect(e.hasSpecificTime).toBe(true);
    });

    it('avkodar entiteter i titeln', () => {
        expect(mapEventServiceItem(IT, BASE, 'Vansbro')!.title).toBe("Vansbro Bio – Five Nights at Freddy's 2");
    });

    it('litar inte på klockslag utan startTime', () => {
        expect(mapEventServiceItem({ ...IT, startTime: '' }, BASE, 'X')!.hasSpecificTime).toBeUndefined();
    });

    it('avvisar poster utan namn, uri eller startDate', () => {
        expect(mapEventServiceItem({ ...IT, name: '' }, BASE, 'X')).toBeNull();
        expect(mapEventServiceItem({ ...IT, uri: undefined }, BASE, 'X')).toBeNull();
        expect(mapEventServiceItem({ ...IT, startDate: undefined }, BASE, 'X')).toBeNull();
        expect(mapEventServiceItem({ ...IT, startDate: 'aldrig' }, BASE, 'X')).toBeNull();
    });
});

describe('isMunicipalMeeting', () => {
    it('fångar nämnder och sammanträden i titeln', () => {
        expect(isMunicipalMeeting('Arbetsmarknads- och vuxenutbildningsnämnden sammanträder')).toBe(true);
        expect(isMunicipalMeeting('Kommunstyrelsen sammaträder')).toBe(true);
        expect(isMunicipalMeeting('Kommunfullmäktige')).toBe(true);
        expect(isMunicipalMeeting('Socialnämnden')).toBe(true);
        expect(isMunicipalMeeting('Årsmöte i föreningen')).toBe(true);
    });

    it('fångar dem via URL:en när titeln är intetsägande', () => {
        expect(isMunicipalMeeting('Möte', 'https://x.se/2026-08-10-kommunstyrelsen')).toBe(true);
        expect(isMunicipalMeeting('Möte', 'https://x.se/2026-08-10-sammantrade')).toBe(true);
    });

    it('släpper igenom publika event', () => {
        expect(isMunicipalMeeting('Schackklubb')).toBe(false);
        expect(isMunicipalMeeting('Open Mic Night med Mariama Jobe')).toBe(false);
        expect(isMunicipalMeeting('Promenad med korvgrillning')).toBe(false);
        expect(isMunicipalMeeting('Politiska ideologier – snabbkurs för förstagångsväljare')).toBe(false);
    });

    it('klarar både a och ä i stavningarna', () => {
        expect(isMunicipalMeeting('Barn- och utbildningsnamnden')).toBe(true);
        expect(isMunicipalMeeting('Barn- och utbildningsnämnden')).toBe(true);
    });
});

describe('mapEventListingResult', () => {
    const BASE = 'https://www.linkoping.se/uppleva-och-gora/evenemang-i-linkoping/evenemangskalender';
    const WINDOW_START = new Date('2026-09-04T00:00:00+02:00');
    // Riktigt result från linkoping.se 2026-09-04 (nedkortat)
    const result = {
        id: '5.203b50119ed4297ae8b5484',
        displayName: 'Visning av Slottsträdgården',
        description: 'Visning av Slottsträdgården vid Linköpings slott',
        uri: '/upplevaochgora/evenemangilinkoping/evenemangskalender/evenemangskalender/visningavslottstradgarden.5.203b50119ed4297ae8b5484.html',
        organizer: 'Linköpings slotts- och domkyrkomuseum',
        location: 'Linköpings slotts- och domkyrkomuseum',
        admissionFee: 'Gratis',
        ticketLink: 'https://lsdm.se/event/visning-av-slottstradgarden/',
        image: { uri: '/images/200.203b50119ed4297ae8cb74b/1785752374696/Tradgardsvisning.jpg' },
        type: [
            { name: 'guidning/visning', title: 'Guidning och visning' },
            { name: 'kulturarv', title: 'Kulturarv' },
        ],
        date: {
            start: { fullDate: '2026-09-05T13:00:00+02:00' },
            end: { fullDate: '2026-09-05T14:00:00+02:00' },
            showTime: true,
        },
    };

    it('mappar ett komplett result med exakt tid', () => {
        const ev = mapEventListingResult(result, BASE, 'Linköping', WINDOW_START);
        expect(ev).not.toBeNull();
        expect(ev!.title).toBe('Visning av Slottsträdgården');
        expect(ev!.startDate.toISOString()).toBe('2026-09-05T11:00:00.000Z');
        expect(ev!.endDate?.toISOString()).toBe('2026-09-05T12:00:00.000Z');
        expect(ev!.url).toBe('https://www.linkoping.se/upplevaochgora/evenemangilinkoping/evenemangskalender/evenemangskalender/visningavslottstradgarden.5.203b50119ed4297ae8b5484.html');
        expect(ev!.venueName).toBe('Linköpings slotts- och domkyrkomuseum');
        expect(ev!.city).toBe('Linköping');
        expect(ev!.organizer).toBe('Linköpings slotts- och domkyrkomuseum');
        expect(ev!.price).toBe('Gratis');
        expect(ev!.classifyHints).toBe('Guidning och visning, Kulturarv');
        expect(ev!.imageUrl).toBe('https://www.linkoping.se/images/200.203b50119ed4297ae8cb74b/1785752374696/Tradgardsvisning.jpg');
        expect(ev!.hasSpecificTime).toBe(true);
    });

    it('showTime=false → hasSpecificTime=false (heldagsmarkering)', () => {
        const ev = mapEventListingResult(
            { ...result, date: { ...result.date, showTime: false } },
            BASE, 'Linköping', WINDOW_START,
        );
        expect(ev!.hasSpecificTime).toBe(false);
    });

    it('pågående fleradagars-event ankras på windowStart', () => {
        const ev = mapEventListingResult(
            {
                ...result,
                date: {
                    start: { fullDate: '2026-08-01T10:00:00+02:00' },
                    end: { fullDate: '2026-10-01T18:00:00+02:00' },
                    showTime: false,
                },
            },
            BASE, 'Linköping', WINDOW_START,
        );
        expect(ev!.startDate.getTime()).toBe(WINDOW_START.getTime());
        expect(ev!.endDate?.toISOString()).toBe('2026-10-01T16:00:00.000Z');
    });

    it('saknad titel/uri/datum → null', () => {
        expect(mapEventListingResult({ ...result, displayName: ' ' }, BASE, undefined, WINDOW_START)).toBeNull();
        expect(mapEventListingResult({ ...result, uri: undefined }, BASE, undefined, WINDOW_START)).toBeNull();
        expect(mapEventListingResult({ ...result, date: {} }, BASE, undefined, WINDOW_START)).toBeNull();
    });

    it('tomma strängfält blir undefined, inte ""', () => {
        const ev = mapEventListingResult(
            { ...result, description: '', organizer: '  ', location: '', admissionFee: '' },
            BASE, 'Linköping', WINDOW_START,
        );
        expect(ev!.description).toBeUndefined();
        expect(ev!.organizer).toBeUndefined();
        expect(ev!.venueName).toBeUndefined();
        expect(ev!.price).toBeUndefined();
    });
});
