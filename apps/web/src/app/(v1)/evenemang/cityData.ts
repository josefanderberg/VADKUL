import { readFile } from 'fs/promises';
import path from 'path';

// Stadssidornas dataunderlag. Läser samma events-JSON som kartan använder som
// fallback (public/events-*.json) — vid BUILD, så sidorna är helt statiska.
// Datat uppdateras alltså vid deploy; kartan själv hämtar färskare data via
// Firestore-aggregaten i drift. För SEO räcker deploy-takten gott.

export type City = { name: string; slug: string; lat: number; lng: number; population: number };

// Städer som får en egen landningssida. Ordningen spelar ingen roll —
// sidorna sorterar själva efter eventantal. population = kommunens, ca
// (SCB 2024, avrundat) — används bara för topplistans "per invånare"-läge,
// grova siffror räcker gott.
export const CITIES: City[] = [
    { name: 'Stockholm', slug: 'stockholm', lat: 59.33, lng: 18.06, population: 990000 },
    { name: 'Göteborg', slug: 'goteborg', lat: 57.71, lng: 11.97, population: 600000 },
    { name: 'Malmö', slug: 'malmo', lat: 55.60, lng: 13.00, population: 366000 },
    { name: 'Uppsala', slug: 'uppsala', lat: 59.86, lng: 17.64, population: 242000 },
    { name: 'Linköping', slug: 'linkoping', lat: 58.41, lng: 15.62, population: 167000 },
    { name: 'Örebro', slug: 'orebro', lat: 59.27, lng: 15.21, population: 159000 },
    { name: 'Västerås', slug: 'vasteras', lat: 59.61, lng: 16.55, population: 160000 },
    { name: 'Helsingborg', slug: 'helsingborg', lat: 56.05, lng: 12.69, population: 152000 },
    { name: 'Norrköping', slug: 'norrkoping', lat: 58.59, lng: 16.19, population: 146000 },
    { name: 'Jönköping', slug: 'jonkoping', lat: 57.78, lng: 14.16, population: 147000 },
    { name: 'Umeå', slug: 'umea', lat: 63.83, lng: 20.26, population: 133000 },
    { name: 'Lund', slug: 'lund', lat: 55.70, lng: 13.19, population: 131000 },
    { name: 'Borås', slug: 'boras', lat: 57.72, lng: 12.94, population: 115000 },
    { name: 'Sundsvall', slug: 'sundsvall', lat: 62.39, lng: 17.31, population: 100000 },
    { name: 'Gävle', slug: 'gavle', lat: 60.67, lng: 17.14, population: 103000 },
    { name: 'Eskilstuna', slug: 'eskilstuna', lat: 59.37, lng: 16.51, population: 108000 },
    { name: 'Halmstad', slug: 'halmstad', lat: 56.67, lng: 12.86, population: 106000 },
    { name: 'Växjö', slug: 'vaxjo', lat: 56.88, lng: 14.81, population: 98000 },
    { name: 'Karlstad', slug: 'karlstad', lat: 59.40, lng: 13.51, population: 97000 },
    { name: 'Södertälje', slug: 'sodertalje', lat: 59.20, lng: 17.63, population: 103000 },
    { name: 'Kristianstad', slug: 'kristianstad', lat: 56.03, lng: 14.16, population: 87000 },
    { name: 'Luleå', slug: 'lulea', lat: 65.58, lng: 22.15, population: 79000 },
    { name: 'Skellefteå', slug: 'skelleftea', lat: 64.75, lng: 20.95, population: 78000 },
    { name: 'Kalmar', slug: 'kalmar', lat: 56.66, lng: 16.36, population: 72000 },
    { name: 'Östersund', slug: 'ostersund', lat: 63.18, lng: 14.64, population: 65000 },
    { name: 'Falun', slug: 'falun', lat: 60.61, lng: 15.63, population: 60000 },
    { name: 'Karlskrona', slug: 'karlskrona', lat: 56.16, lng: 15.59, population: 67000 },
    { name: 'Visby', slug: 'visby', lat: 57.64, lng: 18.30, population: 61000 },
    { name: 'Trollhättan', slug: 'trollhattan', lat: 58.28, lng: 12.29, population: 60000 },
    { name: 'Nyköping', slug: 'nykoping', lat: 58.75, lng: 17.01, population: 58000 },
    { name: 'Skövde', slug: 'skovde', lat: 58.39, lng: 13.85, population: 58000 },
];

// "I {stad}" = inom den här radien från stadskärnan. 35 km täcker pendlings-
// omland utan att t.ex. Malmö-sidan fylls av Helsingborg.
export const CITY_RADIUS_KM = 35;

export type CityEvent = {
    id: string;
    title: string;
    time: string; // ISO-sträng (UTC)
    hasSpecificTime: boolean;
    /** Eventets koordinat — kart-heron placerar brickor med den. */
    lat: number;
    lng: number;
    locationName: string;
    category: string;
    emoji: string;
    hostName?: string;
    coverImage?: string;
    price?: string;
    attendees?: number;
    /** Kort beskrivning (max ~300 tecken, trimmad vid inläsning) — används i
     *  sidornas schema.org-Event så Google får description-fältet. */
    description?: string;
    /** Hur många gånger samma (normaliserade) titel förekommer i HELA datat.
     *  1 = engångshändelse; 400 = rutinverksamhet typ "sommarcafé". Grunden
     *  för rekommendations-rankingen. */
    repeatCount: number;
};

type RawDest = {
    id: string; title: string; time: string; hasSpecificTime: boolean;
    lat: number; lng: number; locationName: string; category: string; emoji: string;
};
type RawCard = { id: string; hostName?: string; coverImage?: string; price?: string; attendees?: number };

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9åäö]+/g, ' ').trim();

// Modulnivå-cache: JSON-filerna (~21k event) läses en gång per build-process,
// inte en gång per stad.
let dataPromise: Promise<{ dests: RawDest[]; cards: Map<string, RawCard>; descs: Map<string, string>; titleFreq: Map<string, number>; updatedAt: string }> | null = null;

function loadData() {
    if (!dataPromise) {
        dataPromise = (async () => {
            const pub = (f: string) => readFile(path.join(process.cwd(), 'public', f), 'utf8');
            const [destRaw, cardRaw, descRaw] = await Promise.all([
                pub('events-destinations.json'),
                pub('events-cards.json'),
                // Beskrivningarna är trevliga-att-ha (schema.org) — saknas
                // filen ska stadssidorna INTE krascha.
                pub('events-descriptions.json').catch(() => null),
            ]);
            const destJson = JSON.parse(destRaw) as { updatedAt?: string; events: RawDest[] };
            const cardJson = JSON.parse(cardRaw) as { events: RawCard[] };
            const cards = new Map<string, RawCard>();
            for (const c of cardJson.events) cards.set(c.id, c);
            // Beskrivningslagret är { data: { [id]: text } }. Trimmas hårt här
            // (en gång per build) — schemat behöver en aptitretare, inte hela
            // programtexten i varje sidas JSON-LD.
            const descs = new Map<string, string>();
            if (descRaw) {
                const descJson = JSON.parse(descRaw) as { data?: Record<string, string> };
                for (const [id, text] of Object.entries(descJson.data ?? {})) {
                    const t = (text || '').replace(/\s+/g, ' ').trim();
                    if (t.length < 20) continue; // för kort för att vara en beskrivning
                    descs.set(id, t.length > 300 ? `${t.slice(0, 297).replace(/\s+\S*$/, '')}…` : t);
                }
            }
            // Global titel-frekvens (hela Sverige, inte per stad): en "vägkyrka"
            // är rutin även om den bara finns en gång i just den här staden.
            const titleFreq = new Map<string, number>();
            for (const e of destJson.events) {
                const k = normTitle(e.title);
                titleFreq.set(k, (titleFreq.get(k) ?? 0) + 1);
            }
            return { dests: destJson.events, cards, descs, titleFreq, updatedAt: destJson.updatedAt ?? new Date().toISOString() };
        })();
    }
    return dataPromise;
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// Närmsta-stad-tilldelning: varje event tillhör EN stad — den närmaste inom
// CITY_RADIUS_KM. Utan detta överlappade 35 km-radierna så att t.ex. hela
// Stockholms utbud även räknades in i Södertälje: topplistan dubbelräknade
// och stadssidorna mixades ihop. Byggs en gång per build-process.
let assignPromise: Promise<Map<string, RawDest[]>> | null = null;
function assignEvents() {
    if (!assignPromise) {
        assignPromise = loadData().then(({ dests }) => {
            const bySlug = new Map<string, RawDest[]>(CITIES.map(c => [c.slug, []]));
            for (const e of dests) {
                if (!e.lat || !e.lng) continue;
                let best: City | null = null;
                let bestD = CITY_RADIUS_KM;
                for (const c of CITIES) {
                    const d = distKm(c.lat, c.lng, e.lat, e.lng);
                    if (d <= bestD) { best = c; bestD = d; }
                }
                if (best) bySlug.get(best.slug)!.push(e);
            }
            return bySlug;
        });
    }
    return assignPromise;
}

/** Stadens kommande event (närmsta-stad-tilldelade, tidssorterade).
 *  "Kommande" = IDAG eller senare (svensk tid) — inte `time >= nu`: scrapade
 *  event har ofta midnatt som starttid, så en ren tidsjämförelse slänger hela
 *  dagens utbud så fort dagen börjat. */
export async function getCityEvents(city: City): Promise<{ events: CityEvent[]; updatedAt: string }> {
    const [{ cards, descs, titleFreq, updatedAt }, assigned] = await Promise.all([loadData(), assignEvents()]);
    const todayK = dayKey(new Date().toISOString());
    const events = (assigned.get(city.slug) ?? [])
        .filter(e => dayKey(e.time) >= todayK)
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
        .map(e => {
            const card = cards.get(e.id);
            return {
                id: e.id,
                title: e.title,
                time: e.time,
                hasSpecificTime: !!e.hasSpecificTime,
                lat: e.lat,
                lng: e.lng,
                locationName: e.locationName,
                category: e.category,
                emoji: e.emoji,
                hostName: card?.hostName || undefined,
                coverImage: card?.coverImage || undefined,
                price: card?.price || undefined,
                attendees: card?.attendees || undefined,
                description: descs.get(e.id),
                repeatCount: titleFreq.get(normTitle(e.title)) ?? 1,
            };
        });
    return { events, updatedAt };
}

// ── Rekommenderade event ──────────────────────────────────────────────────────
// Rankar stadens event efter "unikt + viktigt att känna till" i stället för
// tidsordning. Helt heuristiskt vid build, ingen AI. Tyngsta signalen är
// UNIKHET: titlar som återkommer många gånger i datat (sommarcafé 400×,
// vägkyrka 214×, morgonbön 98×…) är rutinverksamhet, inte händelser. Därtill
// belönas bild, biljettpris, värd, händelse-ord (festival/premiär/…), närhet
// i tid och KVÄLLSTID — de bästa eventen börjar oftast kl 19–20, medan
// morgon/dagtid mest är rutinverksamhet. Vikterna är känsel, inte vetenskap —
// justera fritt.

const SPECIAL_WORDS = /festival|premiär|vernissage|invigning|turné|mässa|stand.?up|konsert|final|release|cirkus|opera|musikal|nationaldag|midsommar|utställning|föreställning/;

// Rutinverksamhet som ska bort även när titeln råkar vara unik (varje församling
// namnger sin "öppen kyrka" lite olika → repeatCount biter inte). Medvetet
// smal — "mässa"/"konsert i kyrkan" ska INTE straffas.
const ROUTINE_WORDS = /gudstjänst|morgonbön|middagsbön|aftonbön|vägkyrka|sommarkyrka|öppen kyrka|sommarcafé|drop.?in|öppen förskola|språkcafé|stickcafé|promenadgrupp|bokcirkel/;

function scoreEvent(e: CityEvent, now: number): number {
    let s = 0;
    // Unikhet — engångstitel = riktig händelse, mångfaldig titel = rutin.
    s += e.repeatCount <= 1 ? 30 : -12 * Math.log2(e.repeatCount);
    if (e.coverImage) s += 14;          // arrangören har lagt jobb på eventet
    if (e.price) s += 6;                // biljettbelagt = arrangemang, inte drop-in
    if ((e.attendees ?? 0) > 0) s += 10;
    if (e.hasSpecificTime) s += 4;
    if (e.hostName) s += 3;
    // Kvällsbonus: riktiga arrangemang (konsert, föreställning, festival­kväll)
    // börjar oftast kl 19–20 — dagtid är mer rutin. Topp 19–20, avtrappat runt.
    if (e.hasSpecificTime) {
        const h = hourOf(e.time);
        if (h === 19 || h === 20) s += 12;
        else if (h === 18 || h === 21) s += 7;
        else if (h === 17 || h === 22) s += 3;
    }
    const nt = normTitle(e.title);
    if (SPECIAL_WORDS.test(nt)) s += 10;
    if (ROUTINE_WORDS.test(nt)) s -= 20;
    const days = (Date.parse(e.time) - now) / 86_400_000;
    s += 14 * Math.exp(-days / 12);     // snart slår långt-fram, mjukt avtagande
    return s;
}

/** Poängfloor för att alls rekommenderas — hellre en kort lista än utfylld. */
const MIN_RECOMMEND_SCORE = 18;

// Dedup-nyckel: samma händelse i flera upplagor ("Föreställning 6"/"…7",
// "EFTERFESTEN FREDAG"/"…LÖRDAG") ska bara ta EN rekommendationsplats —
// siffror och veckodagar strippas ur titeln innan jämförelse.
const WEEKDAYS = new Set(['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']);
const dedupKey = (t: string) =>
    normTitle(t).split(' ').filter(w => w && !WEEKDAYS.has(w) && !/^\d+$/.test(w)).join(' ');

/** Stadens topp-N "värda att känna till"-event, med spridning över
 *  kategorier/värdar/platser så listan inte blir åtta konserter från samma
 *  arrangör (eller samma festival under två namn). */
export function pickRecommended(events: CityEvent[], n = 8): CityEvent[] {
    const now = Date.now();
    const scored = events
        .map(e => ({ e, s: scoreEvent(e, now) }))
        .sort((a, b) => b.s - a.s);
    const picks: CityEvent[] = [];
    const perCat = new Map<string, number>();
    const perHost = new Map<string, number>();
    const seenTitle = new Set<string>();
    const seenPlaceDay = new Set<string>();
    for (const { e, s } of scored) {
        if (picks.length >= n || s < MIN_RECOMMEND_SCORE) break;
        const t = dedupKey(e.title);
        if (seenTitle.has(t)) continue;
        // Samma plats + samma dag = med stor sannolikhet samma arrangemang
        // under olika namn ("Fittja festival" + "Fittja Familjefestival").
        const pd = e.locationName ? `${e.locationName}|${dayKey(e.time)}` : '';
        if (pd && seenPlaceDay.has(pd)) continue;
        if ((perCat.get(e.category) ?? 0) >= 2) continue;
        const host = e.hostName ?? '';
        if (host && (perHost.get(host) ?? 0) >= 2) continue;
        picks.push(e);
        seenTitle.add(t);
        if (pd) seenPlaceDay.add(pd);
        perCat.set(e.category, (perCat.get(e.category) ?? 0) + 1);
        if (host) perHost.set(host, (perHost.get(host) ?? 0) + 1);
    }
    return picks;
}

/** Antal kommande event per stad — för indexsidan och sitemapen. */
export async function getCityCounts(): Promise<{ city: City; count: number }[]> {
    const counts = await Promise.all(
        CITIES.map(async city => ({ city, count: (await getCityEvents(city)).events.length })),
    );
    return counts.sort((a, b) => b.count - a.count);
}

// ── Stad-för-stad-topplistan (indexsidan) ─────────────────────────────────────
// Sidan är statisk men ska kunna filtrera på "Idag"/"I helgen" — så vi bakar
// in antal per DAG (svensk tidszon) de närmaste dagarna, och låter klienten
// räkna ut vilka datum "idag"/"helgen" är mot riktiga klockan. Då pekar
// filtren rätt även om deployen är några dagar gammal (datat är förstås
// deploy-färskt, men dag-bucketarna hamnar inte fel).

export const DAY_COUNT_HORIZON_DAYS = 30;

export type CityShowcaseItem = {
    id: string;
    href: string;
    title: string;
    emoji: string;
    coverImage: string;
    locationName: string;
    /** T.ex. "Torsdag 17 juli · kl 19.00" — versaliserad dag, klockslag om känt. */
    when: string;
};

const SHOWCASE_SIZE = 10;
/** Färre bildsatta event än så → ingen bildspels-sektion alls för staden
 *  (samma tröskel-idé som Rekommenderat-karusellen: hellre ingen sektion än
 *  en tunn en). */
const MIN_SHOWCASE = 3;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Bildsatta KOMMANDE event för stadsindexets "bildspel" (/evenemang) — de
 *  närmaste i tid som faktiskt har en omslagsbild (annars blir det inget
 *  bildspel att visa). `events` kommer redan tidssorterat från getCityEvents,
 *  så ordningen bevaras rakt av. */
function buildShowcase(events: CityEvent[]): CityShowcaseItem[] {
    const withImage = events.filter(e => !!e.coverImage);
    if (withImage.length < MIN_SHOWCASE) return [];
    return withImage.slice(0, SHOWCASE_SIZE).map(e => ({
        id: e.id,
        href: `/?event=${encodeURIComponent(e.id)}`,
        title: e.title,
        emoji: e.emoji || '📍',
        coverImage: e.coverImage!,
        locationName: e.locationName,
        when: cap(dayLabel(e.time)) + (e.hasSpecificTime ? ` · kl ${clockLabel(e.time)}` : ''),
    }));
}

export type CityDayCounts = {
    slug: string;
    name: string;
    population: number;
    total: number;
    /** 'YYYY-MM-DD' (svensk tid) → antal event den dagen. Bara dagar inom
     *  DAY_COUNT_HORIZON_DAYS tas med — 31 städer × 30 dagar är pyttelitet. */
    byDay: Record<string, number>;
    /** Bildsatta framtida höjdpunkter — "bildspelet" under staden på
     *  stadsindexet. Tom array döljer sektionen (för få bildsatta event). */
    showcase: CityShowcaseItem[];
};

export async function getCityDayCounts(): Promise<CityDayCounts[]> {
    const horizon = Date.now() + DAY_COUNT_HORIZON_DAYS * 86_400_000;
    return Promise.all(CITIES.map(async city => {
        const { events } = await getCityEvents(city);
        const byDay: Record<string, number> = {};
        for (const e of events) {
            if (Date.parse(e.time) > horizon) continue;
            const k = dayKey(e.time);
            byDay[k] = (byDay[k] ?? 0) + 1;
        }
        return {
            slug: city.slug, name: city.name, population: city.population,
            total: events.length, byDay,
            showcase: buildShowcase(events),
        };
    }));
}

// ── Kategorisidor ─────────────────────────────────────────────────────────────
// Sökvänliga kategorisidor per stad ("Konserter i Malmö", "Saker att göra med
// barn i Stockholm"). Bara kategorier med tydlig sökintention — `social` och
// `other` är för vaga för att fånga riktiga sökfraser. En sida genereras BARA
// när staden har ≥ MIN_CATEGORY_EVENTS kommande event i kategorin, så vi aldrig
// publicerar tunna/tomma sidor (Google straffar dem).
export const MIN_CATEGORY_EVENTS = 5;

export type CategoryPage = {
    slug: string;      // URL-segment: /evenemang/[stad]/[slug]
    dataKey: string;   // kategorinyckeln i eventdatat
    label: string;     // kort namn för länk-chips
    emoji: string;
    h1: (city: string) => string;
    intro: (city: string) => string; // vad sidan täcker, används i beskrivningen
    /** Substantiv i plural för löptext/FAQ ("Vilka {noun} är det i X idag?").
     *  `label` funkar inte där ("För barn" böjs inte). */
    noun: string;
};

export const CATEGORY_PAGES: CategoryPage[] = [
    { slug: 'konserter', dataKey: 'music', label: 'Konserter', emoji: '🎵',
        h1: c => `Konserter & livemusik i ${c}`,
        intro: () => 'konserter, spelningar, festivaler och klubbkvällar',
        noun: 'konserter' },
    { slug: 'barn', dataKey: 'family', label: 'För barn', emoji: '🧸',
        h1: c => `Saker att göra med barn i ${c}`,
        intro: () => 'sagostunder, familjedagar, lek och barnföreställningar',
        noun: 'barnaktiviteter' },
    { slug: 'sport', dataKey: 'sport', label: 'Sport & träning', emoji: '⚽',
        h1: c => `Sport & träning i ${c}`,
        intro: () => 'matcher, lopp, pass och prova-på-aktiviteter',
        noun: 'sportevenemang' },
    { slug: 'marknader', dataKey: 'market', label: 'Marknader', emoji: '🛍️',
        h1: c => `Marknader & loppisar i ${c}`,
        intro: () => 'marknader, loppisar, mässor och försäljningar',
        noun: 'marknader och loppisar' },
    { slug: 'konst', dataKey: 'art', label: 'Konst', emoji: '🎨',
        h1: c => `Konst & utställningar i ${c}`,
        intro: () => 'utställningar, vernissager och gallerier',
        noun: 'utställningar' },
    { slug: 'teater', dataKey: 'stage', label: 'Teater & scen', emoji: '🎭',
        h1: c => `Teater, standup & scenkonst i ${c}`,
        intro: () => 'teater, standup, dans, opera och film',
        noun: 'föreställningar' },
    { slug: 'kurser', dataKey: 'course', label: 'Kurser', emoji: '📚',
        h1: c => `Kurser & föreläsningar i ${c}`,
        intro: () => 'kurser, föreläsningar, workshops och studiecirklar',
        noun: 'kurser och föreläsningar' },
    { slug: 'fest', dataKey: 'party', label: 'Fest & nattliv', emoji: '🎉',
        h1: c => `Fest & nattliv i ${c}`,
        intro: () => 'fester, klubbar och nattliv',
        noun: 'fester och klubbkvällar' },
    { slug: 'mat', dataKey: 'food', label: 'Mat & dryck', emoji: '🍽️',
        h1: c => `Mat & dryck i ${c}`,
        intro: () => 'matmarknader, provningar och matfestivaler',
        noun: 'matevenemang' },
];

export const categoryBySlug = (slug: string) => CATEGORY_PAGES.find(c => c.slug === slug);

/** Stadens kommande event i en kategori (tidssorterade). */
export async function getCityCategoryEvents(city: City, dataKey: string) {
    const { events, updatedAt } = await getCityEvents(city);
    return { events: events.filter(e => e.category === dataKey), updatedAt };
}

/** Alla (stad, kategori)-kombinationer värda en egen sida (≥ MIN_CATEGORY_EVENTS). */
export async function getCategoryCombos(): Promise<{ city: City; cat: CategoryPage; count: number }[]> {
    const combos: { city: City; cat: CategoryPage; count: number }[] = [];
    for (const city of CITIES) {
        const { events } = await getCityEvents(city);
        const perKey = new Map<string, number>();
        for (const e of events) perKey.set(e.category, (perKey.get(e.category) ?? 0) + 1);
        for (const cat of CATEGORY_PAGES) {
            const count = perKey.get(cat.dataKey) ?? 0;
            if (count >= MIN_CATEGORY_EVENTS) combos.push({ city, cat, count });
        }
    }
    return combos;
}

// Datum/tid i svensk tidszon — byggmaskinens zon ska inte spela roll.
const TZ = 'Europe/Stockholm';
const keyFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const labelFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const clockFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** 'YYYY-MM-DD' i svensk tid — grupperingsnyckel per dag. */
export function dayKey(iso: string) { return keyFmt.format(new Date(iso)); }
/** T.ex. "onsdag 2 juli" (versaliseras i UI:t). */
export function dayLabel(iso: string) { return labelFmt.format(new Date(iso)); }
/** T.ex. "18.30". */
export function clockLabel(iso: string) { return clockFmt.format(new Date(iso)); }
/** T.ex. "Lör 11/7" — dagchipsen på stads-/kategorisidorna. */
export function shortDayLabel(iso: string) {
    const s = chipFmt.format(new Date(iso));
    return s.charAt(0).toUpperCase() + s.slice(1);
}
const chipFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric' });
/** Starttimme 0–23 i svensk tid. */
export function hourOf(iso: string) { return parseInt(hourFmt.format(new Date(iso)), 10); }
const hourFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });

// ── Sidtext ur datat (SEO) ────────────────────────────────────────────────────
// Folk googlar "vad händer i {stad} IDAG" och "konserter {stad} I HELGEN" —
// helpers nedan bakar de svaren ur eventdatat vid build (unik text per sida,
// dagsfärsk via den dagliga auto-deployen).

/** Dagens 'YYYY-MM-DD' (svensk tid) — vid build, dvs. deploydagens. */
export function todayKey() { return dayKey(new Date().toISOString()); }

/** Innevarande/nästa helgs dagnycklar: första lör/sön framåt + resten av den
 *  helgen. Pågår helgen redan (idag är lör/sön) = det som är kvar av den. */
export function weekendKeys(): string[] {
    const wdFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
    const keys: string[] = [];
    for (let i = 0; i < 8; i++) {
        const d = new Date(Date.now() + i * 86_400_000);
        const wd = wdFmt.format(d);
        if (wd === 'Sat' || wd === 'Sun') keys.push(keyFmt.format(d));
        else if (keys.length) break; // helgen är slut
    }
    return keys;
}

/** Antal event som infaller på någon av dagarna. */
export function countByDayKeys(events: CityEvent[], keys: string[]): number {
    const set = new Set(keys);
    let n = 0;
    for (const e of events) if (set.has(dayKey(e.time))) n++;
    return n;
}

/** Platserna med flest kommande event — entitetsrik löptext ("Mest händer på
 *  Kalmar Slott, Larmtorget…"). Korta/tomma namn hoppas över, liksom kladdiga
 *  kompositsträngar ("Kackelstugan och Jonas Mat och Event, Rotaryklubb…") —
 *  komma eller överlängd = ingen ren platsentitet, förstör uppräkningen.
 *  `cityName` filtreras också bort: "Mest händer på … Växjö" på Växjö-sidan
 *  säger inget (skrapade event har ofta bara stadsnamnet som plats). */
export function topVenues(events: CityEvent[], cityName: string, n = 4): string[] {
    const freq = new Map<string, number>();
    const cityLc = cityName.toLowerCase();
    for (const e of events) {
        const name = e.locationName?.replace(/\s+/g, ' ').trim();
        if (!name || name.length < 3 || name.length > 40 || name.includes(',')) continue;
        if (name.toLowerCase() === cityLc) continue;
        freq.set(name, (freq.get(name) ?? 0) + 1);
    }
    return [...freq.entries()]
        .filter(([, c]) => c >= 2) // en enstaka träff är ingen "vanlig plats"
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name]) => name);
}

/** Exempeltitlar för FAQ-svaren — bildsatta event först (arrangören har lagt
 *  jobb = oftast riktiga händelser), dubbletter bort, trimmade för löptext. */
export function exampleTitles(events: CityEvent[], keys: string[], n = 3): string[] {
    const set = new Set(keys);
    const picked = events.filter(e => set.has(dayKey(e.time)));
    const sorted = [...picked.filter(e => e.coverImage), ...picked.filter(e => !e.coverImage)];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of sorted) {
        const t = e.title.replace(/\s+/g, ' ').trim();
        const k = normTitle(t);
        if (!t || seen.has(k)) continue;
        seen.add(k);
        out.push(t.length > 60 ? `${t.slice(0, 57).replace(/\s+\S*$/, '')}…` : t);
        if (out.length >= n) break;
    }
    return out;
}

/** Svensk uppräkning: "A, B och C". */
export function svList(xs: string[]): string {
    if (xs.length <= 1) return xs.join('');
    return `${xs.slice(0, -1).join(', ')} och ${xs[xs.length - 1]}`;
}
