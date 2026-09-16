import { describe, it, expect } from 'vitest';
import { normalizeTitle, localDay, locationKey, dedupKey, scoreOf, buildDedupGroups, ticketTwinKey, mergeTicketTwins, isTitleVariant, titleVariantLinks, mergeLinkedRows, stableIdKey, renameGhosts } from './dedupe-cross-source';

const base = {
    url: 'https://example.se/e/1',
    title: 'Nationaldagsfirande i Gamla stan',
    time: '2026-06-06T12:00:00.000Z',
    locationName: 'Gamla stan, Falkenberg',
    coverImage: null as string | null,
    description: null as string | null,
    lat: 56.9055, lng: 12.4912,
    isLocationVerified: 0,
    hostName: 'Falkenberg Kommun',
    firestoreId: 'abc',
};

describe('normalizeTitle', () => {
    it('normaliserar åäö, skiljetecken och whitespace', () => {
        expect(normalizeTitle('KvartersLoppis - norra delen!')).toBe('kvartersloppis norra delen');
        expect(normalizeTitle('Västspels Onsdagsspel')).toBe(normalizeTitle('Västspels onsdagsspel'));
    });
});

describe('dedupKey', () => {
    it('samma event från två källor får samma nyckel trots koordinat-jitter', () => {
        const a = { ...base };
        const b = { ...base, title: 'Nationaldagsfirande i Gamla Stan', lat: 56.9162, lng: 12.4843 };  // ~1km bort
        expect(dedupKey(a)).toBe(dedupKey(b));
    });

    it('samma titel+dag på olika orter får OLIKA nycklar', () => {
        const horby = { ...base, title: 'Sommarfest', lat: 55.85, lng: 13.66 };
        const tranemo = { ...base, title: 'Sommarfest', lat: 57.48, lng: 13.35 };
        expect(dedupKey(horby)).not.toBe(dedupKey(tranemo));
    });

    it('olika dagar får olika nycklar', () => {
        expect(dedupKey(base)).not.toBe(dedupKey({ ...base, time: '2026-06-07T12:00:00.000Z' }));
    });

    it('UTC-tid mappas till svensk lokal-dag (kvällsevent över midnatt UTC)', () => {
        // 23:30 UTC 5/6 = 01:30 lokal 6/6 — ska räknas som 6 juni
        expect(localDay('2026-06-05T23:30:00.000Z')).toBe('2026-06-06');
    });
});

describe('locationKey', () => {
    it('koordinater vinner över locationName', () => {
        expect(locationKey(base)).toMatch(/^56\.\d{2},12\.\d{2}$/);
    });

    it('utan koordinater används normaliserat platsnamn', () => {
        expect(locationKey({ lat: 0, lng: 0, locationName: 'Gamla stan, Falkenberg' })).toBe('gamla stan falkenber');
    });

    it('varken koordinater eller namn → tom nyckel (eventet ska inte dedupas)', () => {
        expect(locationKey({ lat: 0, lng: 0, locationName: '' })).toBe('');
    });
});

describe('scoreOf — bästa kandidaten vinner', () => {
    it('event med bild i egen Storage + beskrivning slår FB-event utan', () => {
        const rik = scoreOf({
            ...base,
            coverImage: 'https://storage.googleapis.com/vadkul/img.jpg',
            description: 'En lång och utförlig beskrivning av firandet i Gamla stan i Falkenberg.',
            isLocationVerified: 1,
        });
        const fattig = scoreOf({ ...base, hostName: 'Facebook', coverImage: null });
        expect(rik).toBeGreaterThan(fattig);
    });

    it('geokodning ger poäng', () => {
        expect(scoreOf(base)).toBeGreaterThan(scoreOf({ ...base, lat: 0, lng: 0 }));
    });
});

describe('buildDedupGroups — tvilling-fästning', () => {
    const geocoded = { ...base, url: 'https://kommun.se/e/1' };
    const naked = { ...base, url: 'https://fb.com/e/2', lat: 0, lng: 0, locationName: '' };

    it('naken tvilling (ingen plats alls) fästs vid det enda geokodade klustret', () => {
        const { groups, attached } = buildDedupGroups([geocoded, naked] as any);
        expect(attached).toBe(1);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(2);
    });

    it('namn-tvilling fästs när platsnamnet delar ord ("Babel" ↔ "Babel, Malmö")', () => {
        const a = { ...base, url: 'u1', locationName: 'Babel, Malmö', lat: 55.6, lng: 13.0 };
        const b = { ...base, url: 'u2', locationName: 'Babel', lat: 0, lng: 0 };
        const { groups, attached } = buildDedupGroups([a, b] as any);
        expect(attached).toBe(1);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(2);
    });

    it('namn-tvilling utan ordöverlapp förblir egen grupp', () => {
        const a = { ...base, url: 'u1', locationName: 'Folkets Hus', lat: 55.6, lng: 13.0 };
        const b = { ...base, url: 'u2', locationName: 'Bygdegården Tranemo', lat: 0, lng: 0 };
        const { groups, attached } = buildDedupGroups([a, b] as any);
        expect(attached).toBe(0);
        expect(groups).toHaveLength(2);
    });

    it('flera geokodade kluster (generisk titel på många orter) → ingen fästning', () => {
        const horby = { ...base, url: 'u1', title: 'Midsommarfirande', lat: 55.85, lng: 13.66 };
        const tranemo = { ...base, url: 'u2', title: 'Midsommarfirande', lat: 57.48, lng: 13.35 };
        const lost = { ...base, url: 'u3', title: 'Midsommarfirande', lat: 0, lng: 0, locationName: '' };
        const { groups, attached, skippedNoLocation } = buildDedupGroups([horby, tranemo, lost] as any);
        expect(attached).toBe(0);
        expect(skippedNoLocation).toBe(1);
        expect(groups).toHaveLength(2);
    });

    it('olika dagar fästs aldrig ihop', () => {
        const other = { ...naked, time: '2026-06-07T12:00:00.000Z' };
        const { attached } = buildDedupGroups([geocoded, other] as any);
        expect(attached).toBe(0);
    });
});

describe('scoreOf — affiliatelänken vinner (1/9)', () => {
    const rad = (over: Partial<Parameters<typeof scoreOf>[0]>) => ({
        url: 'https://exempel.se/a', title: 'Event', time: '2026-09-03T18:30:00Z',
        locationName: 'Tyrol, Stockholm', coverImage: null, description: null,
        lat: 59.32, lng: 18.1, isLocationVerified: 1, hostName: 'Arrangör',
        firestoreId: 'x', ...over,
    } as Parameters<typeof scoreOf>[0]);

    it('slår en turistsajt med bild och lång beskrivning', () => {
        // Exakt Mamma Mia-fallet: visitstockholm.com hade bild + text och vann,
        // så klicket gick dit i stället för till vår intäktslänk.
        const turistsajt = rad({
            url: 'https://www.visitstockholm.com/events/mamma-mia-the-party',
            coverImage: 'https://storage.googleapis.com/bild.jpg',
            description: 'x'.repeat(200),
        });
        const affiliate = rad({ url: 'https://ticketmaster.evyy.net/c/8469859/2038747/23885?u=x' });
        expect(scoreOf(affiliate)).toBeGreaterThan(scoreOf(turistsajt));
    });

    it('ger inget påslag åt den nakna biljettlänken', () => {
        const naken = rad({ url: 'https://www.ticketmaster.se/event/mamma-mia' });
        const vanlig = rad({ url: 'https://arrangoren.se/mamma-mia' });
        expect(scoreOf(naken)).toBe(scoreOf(vanlig));
    });
});

// Samma Nortic-biljett under två adresser, olika titel och bildfil (Malmö
// 12/9: Common Ground Jazz Club, Oscar Stembridge på Plan B).
describe('biljett-tvillingar (Nortic)', () => {
    const plan = { ...base, time: '2026-09-12T17:00:00.000Z', locationName: 'Plan B', lat: 55.58401, lng: 13.0264 };
    const www = { ...plan, url: 'https://www.nortic.se/ticket/event/82316#a0', title: 'Oscar Stembridge // Live at Plan B — Malmö', firestoreId: 'w' };
    const tix = { ...plan, url: 'https://tickets.nortic.se/ticket/event/82316#a0', title: 'Oscar Stembridge + Rushour // Live at Plan B — Malmö', firestoreId: 't' };

    it('samma id + starttid ger samma nyckel oavsett värd', () => {
        expect(ticketTwinKey(www)).toBe(ticketTwinKey(tix));
        expect(ticketTwinKey(www)).toBe('nortic:82316|2026-09-12T17:00:00.000Z');
    });

    it('icke-Nortic och ogiltig tid ger ingen nyckel', () => {
        expect(ticketTwinKey(base)).toBeNull();
        expect(ticketTwinKey({ ...www, time: 'inte ett datum' })).toBeNull();
    });

    it('titelgrupperingen missar dem — biljett-sammanslagningen tar dem', () => {
        const rows = [www, tix];
        const { groups } = buildDedupGroups(rows);
        expect(groups.some((g) => g.length > 1)).toBe(false);
        const merged = mergeTicketTwins(groups, rows);
        expect(merged).toHaveLength(1);
        expect(merged[0].map((r) => r.firestoreId).sort()).toEqual(['t', 'w']);
    });

    it('annat id eller annan starttid slås INTE ihop', () => {
        const otherId = { ...tix, url: 'https://tickets.nortic.se/ticket/event/85666#a0', firestoreId: 'o' };
        const otherTime = { ...tix, time: '2026-09-13T17:00:00.000Z', firestoreId: 'n' };
        const rows = [www, otherId, otherTime];
        expect(mergeTicketTwins(buildDedupGroups(rows).groups, rows)).toHaveLength(3);
    });

    it('en tvilling redan i en titelgrupp drar med hela gruppen', () => {
        const sameTitleOtherSource = { ...www, url: 'https://kollektivet.example/oscar', firestoreId: 'k' };
        const rows = [www, sameTitleOtherSource, tix];
        const merged = mergeTicketTwins(buildDedupGroups(rows).groups, rows);
        expect(merged).toHaveLength(1);
        expect(merged[0]).toHaveLength(3);
    });
});

// Växjö 11/9: "Dans för parkinson" (regionteatern.se) och "Dans för
// Parkinson, Växjö" (Facebook) — samma tid, ~500 m isär, samma bild i olika
// filformat. Titelnyckeln missade dem för ", Växjö".
describe('titelvarianter', () => {
    const at = { ...base, time: '2026-09-11T12:00:00.000Z', lat: 56.8787, lng: 14.8094 };
    const teatern = { ...at, url: 'https://www.regionteatern.se/events/dans-for-parkinson-2', title: 'Dans för parkinson', firestoreId: 'r' };
    const fb = { ...at, url: 'https://www.facebook.com/events/1721209066222367/', title: 'Dans för Parkinson, Växjö', lat: 56.8827, lng: 14.8045, firestoreId: 'f' };

    it('kortare titel = början på den längre vid ordgräns', () => {
        expect(isTitleVariant('dans for parkinson', 'dans for parkinson vaxjo')).toBe(true);
        expect(isTitleVariant('dans for parkinson vaxjo', 'dans for parkinson')).toBe(true);
    });

    it('ett ord, för kort, mitt i ett ord eller identiskt räcker inte', () => {
        expect(isTitleVariant('konsert', 'konsert med bandet')).toBe(false);
        expect(isTitleVariant('bob hans', 'bob hansson live')).toBe(false);
        expect(isTitleVariant('dans for parkinson', 'dans for parkinson')).toBe(false);
    });

    it('Parkinson-paret länkas och slås ihop', () => {
        const rows = [teatern, fb];
        const links = titleVariantLinks(rows);
        expect(links).toHaveLength(1);
        const merged = mergeLinkedRows(buildDedupGroups(rows).groups, links);
        expect(merged).toHaveLength(1);
        expect(merged[0]).toHaveLength(2);
    });

    it('annan starttid eller annan ort länkas inte', () => {
        expect(titleVariantLinks([teatern, { ...fb, time: '2026-09-11T14:00:00.000Z' }])).toHaveLength(0);
        expect(titleVariantLinks([teatern, { ...fb, lat: 57.78, lng: 14.16 }])).toHaveLength(0); // Jönköping
    });

    it('serierubrik som är början på flera OLIKA program länkas inte (ingen kedja)', () => {
        const serie = { ...at, url: 'u0', title: 'Barnens konstfredag' };
        const a = { ...at, url: 'u1', title: 'Barnens konstfredag: Mini-cirkus på sportlovet' };
        const b = { ...at, url: 'u2', title: 'Barnens Konstfredag: Fart, rytm och rörelse' };
        expect(titleVariantLinks([serie, a, b])).toHaveLength(0);
    });

    it('inställt slås aldrig ihop med den vanliga titeln', () => {
        const live = { ...at, url: 'u1', title: 'Lucinda Williams' };
        const off = { ...at, url: 'u2', title: 'Lucinda Williams - inställd' };
        expect(titleVariantLinks([live, off])).toHaveLength(0);
    });
});

// Titelbyte på källan = ny slug under samma id (16/9: Blenda nätverksträff på
// Billetto stod två gånger på kartan, gamla adressen omdirigeras till nya).
describe('omdöpta event (stableIdKey + renameGhosts)', () => {
    const at = { ...base, time: '2026-09-16T15:30:00.000Z', locationName: 'Mather Studio', lat: 59.3167, lng: 18.0726, hostName: 'Billetto' };
    const old = { ...at, url: 'https://billetto.se/e/blenda-natverkstraff-krypto-utan-krangel-biljetter-1981447', title: 'Blenda nätverksträff - Krypto utan krångel', firestoreId: 'old', createdAt: '2026-08-20T09:11:14.818Z' };
    const cur = { ...at, url: 'https://billetto.se/e/blenda-natverkstraff-mojligheter-risker-biljetter-1981447', title: 'Blenda nätverksträff - Möjligheter & risker', firestoreId: 'cur', createdAt: '2026-09-01T07:26:16.529Z' };

    it('samma käll-id + starttid ger samma nyckel trots olika slug', () => {
        expect(stableIdKey(old)).toBe(stableIdKey(cur));
        expect(stableIdKey(old)).toBe('billetto:1981447|2026-09-16T15:30:00.000Z');
        expect(stableIdKey({ ...old, url: 'https://billetto.se/en/e/blenda-biljetter-1981447' })).toBe(stableIdKey(old));
    });

    it('verifierade mönster för Tickster, sv.se, ABF och SiteVision', () => {
        const pairs = [
            ['https://www.tickster.com/se/sv/events/yezkrhpx24977pf/2026-09-23/storseans-med-martin-ohlson-tierp',
             'https://www.tickster.com/se/sv/events/yezkrhpx24977pf/2026-09-23/storseans-tierp-med-martin-ohlson-medium'],
            ['https://www.sv.se/kurser-och-evenemang/ovrigt/oringens-aterkomst-109408',
             'https://www.sv.se/kurser-och-evenemang/distans/oringens-aterkomst-onlineforelasning-109408'],
            ['https://www.abf.se/vast/kurs/utstallning-vi-som-arbetar-med-vara-kroppar-3945996/',
             'https://www.abf.se/vast/kurs/utstallning-vi-som-arbetar-med-vara-kroppar-vernissage-3945996/'],
            ['https://www.varmdo.se/upplevaochgora/evenemang/evenemangsarkiv/hostkonsertluxacappella.5.15eced8c1a0423602c2d25.html',
             'https://www.varmdo.se/upplevaochgora/evenemang/evenemangsarkiv/lux.5.15eced8c1a0423602c2d25.html'],
        ];
        for (const [a, b] of pairs) {
            expect(stableIdKey({ url: a, time: at.time })).not.toBeNull();
            expect(stableIdKey({ url: a, time: at.time })).toBe(stableIdKey({ url: b, time: at.time }));
        }
    });

    it('olika id, olika SiteVision-nod, olika Tickster-datum eller okänd värd ger inte samma nyckel', () => {
        const k = (url: string) => stableIdKey({ url, time: at.time });
        expect(k('https://billetto.se/e/a-biljetter-1981447')).not.toBe(k('https://billetto.se/e/a-biljetter-1981448'));
        expect(k('https://www.jonkoping.se/e/lisbeth.5.70939fa91a005ceb77a9333.html'))
            .not.toBe(k('https://www.jonkoping.se/e/lisbeth.5.70939fa91a005ceb77a9344.html'));
        expect(k('https://www.boras.se/a/x.5.4591983b19eaaa7de5e1caf7.html'))
            .not.toBe(k('https://www.goteborg.se/a/x.5.4591983b19eaaa7de5e1caf7.html'));
        expect(k('https://www.tickster.com/se/sv/events/abc123/2026-09-23/x'))
            .not.toBe(k('https://www.tickster.com/se/sv/events/abc123/2026-09-24/x'));
        // swehockey: samma schema-id, olika matcher i queryn — ska aldrig matcha
        expect(k('https://stats.swehockey.se/ScheduleAndResults/Schedule/20962?game=90131002')).toBeNull();
        expect(k('https://www.nortic.se/ticket/event/82316#a0')).toBeNull();
        expect(stableIdKey({ ...old, time: 'inte ett datum' })).toBeNull();
    });

    it('annan starttid under samma id slås INTE ihop', () => {
        const later = { ...cur, time: '2026-09-17T15:30:00.000Z' };
        expect(renameGhosts([old, later])).toEqual([]);
    });

    it('den senast skapade raden behålls oavsett ordning och poäng', () => {
        const richOld = { ...old, coverImage: 'https://storage.googleapis.com/x.jpg', description: 'x'.repeat(80) };
        expect(renameGhosts([richOld, cur])).toEqual([richOld]);
        expect(renameGhosts([cur, richOld])).toEqual([richOld]);
    });

    it('tre slugar → de två äldre göms; rad utan createdAt räknas som äldst', () => {
        const oldest = { ...old, url: 'https://billetto.se/e/blenda-biljetter-1981447', firestoreId: 'x', createdAt: null };
        const ghosts = renameGhosts([cur, oldest, old]);
        expect(ghosts.map((r) => r.firestoreId).sort()).toEqual(['old', 'x']);
    });

    it('ensam rad eller vanliga titeldubbletter berörs inte', () => {
        expect(renameGhosts([cur])).toEqual([]);
        expect(renameGhosts([base, { ...base, firestoreId: 'b', url: 'https://example.se/e/2' }])).toEqual([]);
    });
});
