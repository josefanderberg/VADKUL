/**
 * city-gaps.ts — VILKEN STAD SKA MAXAS HÄRNÄST?
 *
 * Lärdomen från Norrköping-maxningen 2026-08-09: antalet event ljuger.
 * Norrköping hade 336 framtida event och såg friskt ut, men ~85 % kom från
 * paraply-källor (församlingar, PRO, Korpen, studieförbund) som finns i varje
 * kommun. Stadens EGNA arrangörer — scener, museer, krogar, festivaler — fanns
 * knappt alls, och därför var kalendern tom på en vanlig söndag.
 *
 * Måttet som avslöjar det är SAMMANSÄTTNINGEN, inte volymen:
 *   PARAPLY   — församling/PRO/Korpen/studieförbund/hembygd/bibliotek m.fl.
 *               Riksomfattande källor som ger samma grundbrus överallt.
 *   AGGREGAT  — Tickster/Ticketmaster/Billetto/Nortic/Facebook m.fl.
 *               Riktiga event, men vi äger inte relationen till arrangören.
 *   LOKALA    — stadens egna arrangörer och kalendrar. ← hälsosignalen.
 *
 * Till skillnad från:
 *   coverage.ts         → geografisk kommun-täckning (har vi en källa alls?)
 *   quality-coverage.ts → fält-kvalitet per scraper (bild/desc/pris/geo)
 * ...svarar det här på "var är utbudet tunt för en användare som öppnar
 * appen i dag?" — och rangordnar städerna efter var insatsen ger mest.
 *
 * Användning:
 *   npm run city-gaps                  # rangordnat på antal LOKALA event
 *   npm run city-gaps -- --sort=today  # på hur tomt det är i dag
 *   npm run city-gaps -- --sort=per10k # på event per 10 000 invånare
 *   npm run city-gaps -- --radius=20   # annan radie (default 30 km)
 *   npm run city-gaps -- --json
 */

import path from 'path';
import Database from 'better-sqlite3';
import { SOURCES } from '../sources/registry';

/**
 * Folkmängd = kommunen (SCB 2024, avrundat), koordinat = centralorten.
 * Storstadsnära städer är markerade `metro` — deras radie svämmar över av
 * grannstadens utbud, så per-capita-talet är missvisande för dem.
 */
interface City { name: string; lat: number; lng: number; pop: number; region?: string; metro?: boolean }

const CITIES: City[] = [
    { name: 'Stockholm', lat: 59.3293, lng: 18.0686, pop: 984748, region: 'stockholm' },
    { name: 'Göteborg', lat: 57.7089, lng: 11.9746, pop: 604616, region: 'goteborg' },
    { name: 'Malmö', lat: 55.6050, lng: 13.0038, pop: 362133, region: 'malmo' },
    { name: 'Uppsala', lat: 59.8586, lng: 17.6389, pop: 243585, region: 'uppsala' },
    { name: 'Linköping', lat: 58.4109, lng: 15.6216, pop: 167005, region: 'linkoping' },
    { name: 'Västerås', lat: 59.6099, lng: 16.5448, pop: 158265, region: 'vasteras' },
    { name: 'Örebro', lat: 59.2741, lng: 15.2066, pop: 158057, region: 'orebro' },
    { name: 'Helsingborg', lat: 56.0465, lng: 12.6945, pop: 152873, region: 'helsingborg' },
    { name: 'Norrköping', lat: 58.5877, lng: 16.1924, pop: 145398, region: 'norrkoping' },
    { name: 'Jönköping', lat: 57.7826, lng: 14.1618, pop: 145263, region: 'jonkoping' },
    { name: 'Umeå', lat: 63.8258, lng: 20.2630, pop: 132511, region: 'umea' },
    { name: 'Lund', lat: 55.7047, lng: 13.1910, pop: 129598, region: 'lund', metro: true },
    { name: 'Huddinge', lat: 59.2371, lng: 17.9819, pop: 118003, metro: true },
    { name: 'Borås', lat: 57.7210, lng: 12.9401, pop: 115688, region: 'boras' },
    { name: 'Eskilstuna', lat: 59.3710, lng: 16.5098, pop: 108265, region: 'eskilstuna' },
    { name: 'Halmstad', lat: 56.6745, lng: 12.8568, pop: 105489, region: 'halland' },
    { name: 'Gävle', lat: 60.6749, lng: 17.1413, pop: 104868, region: 'gavle' },
    { name: 'Södertälje', lat: 59.1955, lng: 17.6252, pop: 104154, metro: true },
    { name: 'Sundsvall', lat: 62.3908, lng: 17.3069, pop: 99889, region: 'sundsvall' },
    { name: 'Växjö', lat: 56.8790, lng: 14.8059, pop: 97633, region: 'vaxjo' },
    { name: 'Karlstad', lat: 59.3793, lng: 13.5036, pop: 96525, region: 'karlstad' },
    { name: 'Kristianstad', lat: 56.0294, lng: 14.1567, pop: 87000, region: 'kristianstad' },
    { name: 'Luleå', lat: 65.5848, lng: 22.1567, pop: 79000, region: 'lulea' },
    { name: 'Skellefteå', lat: 64.7507, lng: 20.9528, pop: 73000, region: 'skelleftea' },
    { name: 'Kalmar', lat: 56.6634, lng: 16.3566, pop: 71000, region: 'kalmar' },
    { name: 'Mölndal', lat: 57.6554, lng: 12.0138, pop: 70000, metro: true },
    { name: 'Karlskrona', lat: 56.1612, lng: 15.5869, pop: 67000, region: 'karlskrona' },
    { name: 'Varberg', lat: 57.1057, lng: 12.2508, pop: 66000, region: 'halland' },
    { name: 'Östersund', lat: 63.1792, lng: 14.6357, pop: 65000, region: 'ostersund' },
    { name: 'Norrtälje', lat: 59.7580, lng: 18.7050, pop: 63000, metro: true },
    { name: 'Visby', lat: 57.6348, lng: 18.2948, pop: 61000, region: 'gotland' },
    { name: 'Trollhättan', lat: 58.2837, lng: 12.2886, pop: 60000 },
    { name: 'Falun', lat: 60.6065, lng: 15.6355, pop: 59000, region: 'dalarna' },
    { name: 'Nyköping', lat: 58.7531, lng: 17.0086, pop: 58000 },
    { name: 'Uddevalla', lat: 58.3498, lng: 11.9424, pop: 57000, region: 'uddevalla' },
    { name: 'Skövde', lat: 58.3903, lng: 13.8451, pop: 57000 },
    { name: 'Örnsköldsvik', lat: 63.2909, lng: 18.7152, pop: 56000 },
    { name: 'Borlänge', lat: 60.4858, lng: 15.4371, pop: 53000, region: 'borlange' },
    { name: 'Trelleborg', lat: 55.3753, lng: 13.1569, pop: 46000, metro: true },
    { name: 'Landskrona', lat: 55.8708, lng: 12.8300, pop: 46000, metro: true },
    { name: 'Falkenberg', lat: 56.9055, lng: 12.4912, pop: 45000, region: 'halland' },
    { name: 'Motala', lat: 58.5371, lng: 15.0364, pop: 44000 },
    { name: 'Piteå', lat: 65.3172, lng: 21.4794, pop: 42000 },
    { name: 'Alingsås', lat: 57.9301, lng: 12.5335, pop: 41000, metro: true },
    { name: 'Vänersborg', lat: 58.3806, lng: 12.3236, pop: 40000 },
    { name: 'Sandviken', lat: 60.6167, lng: 16.7758, pop: 39000 },
    { name: 'Katrineholm', lat: 58.9959, lng: 16.2064, pop: 34000, region: 'katrineholm' },
    { name: 'Ystad', lat: 55.4295, lng: 13.8204, pop: 30000, region: 'ystad' },
    { name: 'Härnösand', lat: 62.6323, lng: 17.9379, pop: 25000 },
];

/** Riksomfattande paraply-källor — samma grundbrus i varje kommun. */
const RX_PARAPLY = /församling|pastorat|svenska kyrkan|domkyrko|\bkyrkan\b|\bPRO\b|Korpen|\bABF\b|Studieförbundet Vuxenskolan|Medborgarskolan|Bilda|\bNBV\b|Folkuniversitetet|Studiefrämjandet|Naturskyddsförening|Friluftsfrämjandet|Röda Korset|Rotary|Hembygdsförening|bibliotek|Riksteatern|Sensus|equmenia/i;
/** Biljett-/plattformsaggregatorer — riktiga event, men ingen arrangörsrelation. */
const RX_AGG = /^(Tickster|TicketMaster|Ticketmaster|Billetto|Eventbrite|Nortic|Kulturbiljetter|RaceID|Facebook|Meetup|Eventim)$/i;

const EARTH_KM = 6371;
const rad = (x: number) => (x * Math.PI) / 180;
function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const dLat = rad(bLat - aLat);
    const dLng = rad(bLng - aLng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

interface Row {
    name: string; pop: number; metro: boolean;
    future: number; today: number; week: number;
    per10k: number;
    paraply: number; agg: number; local: number;
    paraplyPct: number; aggPct: number; localPct: number;
    sources: number;
}

function parseArgs() {
    const out: { sort: string; radius: number; json: boolean } = { sort: 'local', radius: 30, json: false };
    for (const a of process.argv.slice(2)) {
        if (a === '--json') out.json = true;
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (!m) continue;
        if (m[1] === 'sort') out.sort = m[2];
        if (m[1] === 'radius') out.radius = parseInt(m[2], 10);
    }
    return out;
}

function main() {
    const args = parseArgs();
    const sqlite = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });

    const now = new Date();
    const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now.getTime() + 7 * 86_400_000);

    const events = sqlite.prepare(`
        SELECT lat, lng, time, hostName FROM link_events
        WHERE hidden = 0 AND lat IS NOT NULL AND lng IS NOT NULL AND time >= ?
    `).all(now.toISOString()) as { lat: number; lng: number; time: string; hostName: string | null }[];

    // Dedikerade källor per region i registryt.
    const sourcesByRegion = new Map<string, number>();
    for (const s of SOURCES) {
        if (!s.region) continue;
        sourcesByRegion.set(s.region, (sourcesByRegion.get(s.region) ?? 0) + 1);
    }

    const rows: Row[] = CITIES.map((c) => {
        let future = 0, today = 0, week = 0, paraply = 0, agg = 0, local = 0;
        for (const e of events) {
            if (distKm(c.lat, c.lng, e.lat, e.lng) > args.radius) continue;
            future++;
            const t = new Date(e.time);
            if (t <= dayEnd) today++;
            if (t <= weekEnd) week++;
            const host = (e.hostName ?? '').trim();
            if (RX_AGG.test(host)) agg++;
            else if (RX_PARAPLY.test(host)) paraply++;
            else local++;
        }
        const pct = (n: number) => (future ? Math.round((n / future) * 100) : 0);
        return {
            name: c.name, pop: c.pop, metro: !!c.metro,
            future, today, week,
            per10k: +(future / (c.pop / 10000)).toFixed(1),
            paraply, agg, local,
            paraplyPct: pct(paraply), aggPct: pct(agg), localPct: pct(local),
            sources: c.region ? (sourcesByRegion.get(c.region) ?? 0) : 0,
        };
    });

    const sorters: Record<string, (a: Row, b: Row) => number> = {
        local: (a, b) => a.local - b.local,
        today: (a, b) => a.today - b.today,
        per10k: (a, b) => a.per10k - b.per10k,
        pop: (a, b) => b.pop - a.pop,
    };
    rows.sort(sorters[args.sort] ?? sorters.local);

    if (args.json) {
        console.log(JSON.stringify({ generatedAt: now.toISOString(), radiusKm: args.radius, cities: rows }, null, 2));
        return;
    }

    console.log(`\n📍 Stadsluckor — ${args.radius} km radie, sorterat på ${args.sort}. ${events.length} framtida event i DB.`);
    console.log('   LOKALA = stadens egna arrangörer (varken paraply-källa eller biljettaggregator) ← nyckeltalet.');
    console.log('   ⚑ = storstadsnära, radien svämmar över av grannen → per-capita missvisande.\n');
    console.log('Stad            Folkm.  Framtid  Idag    7d   /10k  Paraply  Aggr   LOKALA      Källor');
    console.log('─'.repeat(88));
    for (const r of rows) {
        console.log(
            (r.name + (r.metro ? ' ⚑' : '')).padEnd(15),
            (Math.round(r.pop / 1000) + 'k').padStart(6),
            String(r.future).padStart(8),
            String(r.today).padStart(5),
            String(r.week).padStart(5),
            String(r.per10k).padStart(6),
            (r.paraplyPct + '%').padStart(8),
            (r.aggPct + '%').padStart(5),
            (r.local + ' (' + r.localPct + '%)').padStart(11),
            String(r.sources).padStart(6),
        );
    }
    console.log('\nSvagast lokalt utbud:', rows.slice(0, 8).map((r) => r.name).join(', '));
}

main();
