import { readFile } from 'fs/promises';
import path from 'path';

// Stadssidornas dataunderlag. Läser samma events-JSON som kartan använder som
// fallback (public/events-*.json) — vid BUILD, så sidorna är helt statiska.
// Datat uppdateras alltså vid deploy; kartan själv hämtar färskare data via
// Firestore-aggregaten i drift. För SEO räcker deploy-takten gott.

export type City = { name: string; slug: string; lat: number; lng: number };

// Städer som får en egen landningssida. Ordningen spelar ingen roll —
// sidorna sorterar själva efter eventantal.
export const CITIES: City[] = [
    { name: 'Stockholm', slug: 'stockholm', lat: 59.33, lng: 18.06 },
    { name: 'Göteborg', slug: 'goteborg', lat: 57.71, lng: 11.97 },
    { name: 'Malmö', slug: 'malmo', lat: 55.60, lng: 13.00 },
    { name: 'Uppsala', slug: 'uppsala', lat: 59.86, lng: 17.64 },
    { name: 'Linköping', slug: 'linkoping', lat: 58.41, lng: 15.62 },
    { name: 'Örebro', slug: 'orebro', lat: 59.27, lng: 15.21 },
    { name: 'Västerås', slug: 'vasteras', lat: 59.61, lng: 16.55 },
    { name: 'Helsingborg', slug: 'helsingborg', lat: 56.05, lng: 12.69 },
    { name: 'Norrköping', slug: 'norrkoping', lat: 58.59, lng: 16.19 },
    { name: 'Jönköping', slug: 'jonkoping', lat: 57.78, lng: 14.16 },
    { name: 'Umeå', slug: 'umea', lat: 63.83, lng: 20.26 },
    { name: 'Lund', slug: 'lund', lat: 55.70, lng: 13.19 },
    { name: 'Borås', slug: 'boras', lat: 57.72, lng: 12.94 },
    { name: 'Sundsvall', slug: 'sundsvall', lat: 62.39, lng: 17.31 },
    { name: 'Gävle', slug: 'gavle', lat: 60.67, lng: 17.14 },
    { name: 'Eskilstuna', slug: 'eskilstuna', lat: 59.37, lng: 16.51 },
    { name: 'Halmstad', slug: 'halmstad', lat: 56.67, lng: 12.86 },
    { name: 'Växjö', slug: 'vaxjo', lat: 56.88, lng: 14.81 },
    { name: 'Karlstad', slug: 'karlstad', lat: 59.40, lng: 13.51 },
    { name: 'Södertälje', slug: 'sodertalje', lat: 59.20, lng: 17.63 },
    { name: 'Kristianstad', slug: 'kristianstad', lat: 56.03, lng: 14.16 },
    { name: 'Luleå', slug: 'lulea', lat: 65.58, lng: 22.15 },
    { name: 'Skellefteå', slug: 'skelleftea', lat: 64.75, lng: 20.95 },
    { name: 'Kalmar', slug: 'kalmar', lat: 56.66, lng: 16.36 },
    { name: 'Östersund', slug: 'ostersund', lat: 63.18, lng: 14.64 },
    { name: 'Falun', slug: 'falun', lat: 60.61, lng: 15.63 },
    { name: 'Karlskrona', slug: 'karlskrona', lat: 56.16, lng: 15.59 },
    { name: 'Visby', slug: 'visby', lat: 57.64, lng: 18.30 },
    { name: 'Trollhättan', slug: 'trollhattan', lat: 58.28, lng: 12.29 },
    { name: 'Nyköping', slug: 'nykoping', lat: 58.75, lng: 17.01 },
    { name: 'Skövde', slug: 'skovde', lat: 58.39, lng: 13.85 },
];

// "I {stad}" = inom den här radien från stadskärnan. 35 km täcker pendlings-
// omland utan att t.ex. Malmö-sidan fylls av Helsingborg.
export const CITY_RADIUS_KM = 35;

export type CityEvent = {
    id: string;
    title: string;
    time: string; // ISO-sträng (UTC)
    hasSpecificTime: boolean;
    locationName: string;
    category: string;
    emoji: string;
    hostName?: string;
    coverImage?: string;
};

type RawDest = {
    id: string; title: string; time: string; hasSpecificTime: boolean;
    lat: number; lng: number; locationName: string; category: string; emoji: string;
};
type RawCard = { id: string; hostName?: string; coverImage?: string };

// Modulnivå-cache: JSON-filerna (~21k event) läses en gång per build-process,
// inte en gång per stad.
let dataPromise: Promise<{ dests: RawDest[]; cards: Map<string, RawCard>; updatedAt: string }> | null = null;

function loadData() {
    if (!dataPromise) {
        dataPromise = (async () => {
            const pub = (f: string) => readFile(path.join(process.cwd(), 'public', f), 'utf8');
            const [destRaw, cardRaw] = await Promise.all([
                pub('events-destinations.json'),
                pub('events-cards.json'),
            ]);
            const destJson = JSON.parse(destRaw) as { updatedAt?: string; events: RawDest[] };
            const cardJson = JSON.parse(cardRaw) as { events: RawCard[] };
            const cards = new Map<string, RawCard>();
            for (const c of cardJson.events) cards.set(c.id, c);
            return { dests: destJson.events, cards, updatedAt: destJson.updatedAt ?? new Date().toISOString() };
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

/** Kommande event inom CITY_RADIUS_KM från staden, tidssorterade. */
export async function getCityEvents(city: City): Promise<{ events: CityEvent[]; updatedAt: string }> {
    const { dests, cards, updatedAt } = await loadData();
    const now = Date.now();
    const events = dests
        .filter(e =>
            e.lat && e.lng &&
            Date.parse(e.time) >= now &&
            distKm(city.lat, city.lng, e.lat, e.lng) <= CITY_RADIUS_KM,
        )
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
        .map(e => {
            const card = cards.get(e.id);
            return {
                id: e.id,
                title: e.title,
                time: e.time,
                hasSpecificTime: !!e.hasSpecificTime,
                locationName: e.locationName,
                category: e.category,
                emoji: e.emoji,
                hostName: card?.hostName || undefined,
                coverImage: card?.coverImage || undefined,
            };
        });
    return { events, updatedAt };
}

/** Antal kommande event per stad — för indexsidan och sitemapen. */
export async function getCityCounts(): Promise<{ city: City; count: number }[]> {
    const counts = await Promise.all(
        CITIES.map(async city => ({ city, count: (await getCityEvents(city)).events.length })),
    );
    return counts.sort((a, b) => b.count - a.count);
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
};

export const CATEGORY_PAGES: CategoryPage[] = [
    { slug: 'konserter', dataKey: 'music', label: 'Konserter', emoji: '🎵',
        h1: c => `Konserter & livemusik i ${c}`,
        intro: () => 'konserter, spelningar, festivaler och klubbkvällar' },
    { slug: 'barn', dataKey: 'family', label: 'För barn', emoji: '🧸',
        h1: c => `Saker att göra med barn i ${c}`,
        intro: () => 'sagostunder, familjedagar, lek och barnföreställningar' },
    { slug: 'sport', dataKey: 'sport', label: 'Sport & träning', emoji: '⚽',
        h1: c => `Sport & träning i ${c}`,
        intro: () => 'matcher, lopp, pass och prova-på-aktiviteter' },
    { slug: 'marknader', dataKey: 'market', label: 'Marknader', emoji: '🛍️',
        h1: c => `Marknader & loppisar i ${c}`,
        intro: () => 'marknader, loppisar, mässor och försäljningar' },
    { slug: 'konst', dataKey: 'art', label: 'Konst', emoji: '🎨',
        h1: c => `Konst & utställningar i ${c}`,
        intro: () => 'utställningar, vernissager och gallerier' },
    { slug: 'teater', dataKey: 'stage', label: 'Teater & scen', emoji: '🎭',
        h1: c => `Teater, standup & scenkonst i ${c}`,
        intro: () => 'teater, standup, dans, opera och film' },
    { slug: 'kurser', dataKey: 'course', label: 'Kurser', emoji: '📚',
        h1: c => `Kurser & föreläsningar i ${c}`,
        intro: () => 'kurser, föreläsningar, workshops och studiecirklar' },
    { slug: 'fest', dataKey: 'party', label: 'Fest & nattliv', emoji: '🎉',
        h1: c => `Fest & nattliv i ${c}`,
        intro: () => 'fester, klubbar och nattliv' },
    { slug: 'mat', dataKey: 'food', label: 'Mat & dryck', emoji: '🍽️',
        h1: c => `Mat & dryck i ${c}`,
        intro: () => 'matmarknader, provningar och matfestivaler' },
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
