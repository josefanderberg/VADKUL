/**
 * Arrangörsregistret för studions Marknad-flik (2026-09-28).
 *
 * Grupperar spegelns event per arrangör (hostName + källans domän) så att
 * studion kan visa "era event har visats X gånger och gett Y klick till er
 * sajt" per arrangör. Ren logik: skriptet export-organizer-stats.ts läser
 * SQLite och räknar statistiken i Firestore, allt urval och all gruppering
 * bor här så att det går att testa.
 *
 * Nyckeln är hostName + domän: "Stadsbiblioteket" finns i flera städer och
 * får inte klumpas ihop, medan samma arrangör på samma sajt ska bli en rad.
 */

export interface OrganizerEventRow {
    url: string;
    title: string | null;
    time: string | null;       // ISO-8601
    hostName: string | null;
    category: string | null;
    lat: number | null;
    lng: number | null;
}

export interface OrganizerExample {
    titel: string;
    tid: string;
    ort: string | null;
    url: string;
}

export interface Organizer {
    nyckel: string;
    namn: string;
    doman: string;
    /** Var kontakten tas: mejl via egna sajten, eller Facebook-sidan. */
    kanal: 'mejl' | 'facebook';
    eventTotalt: number;       // i spegelns fönster (30 dagar bak + kommande)
    kommande: number;
    orter: string[];           // vanligaste orterna först, max 3
    kategorier: string[];      // vanligaste först, max 3
    exempel: OrganizerExample[]; // närmaste kommande event, max 5
    urls: string[];            // alla eventets id:n = eventStats.eventId
}

/** Biljettplattformar och aggregatorer = återförsäljare, inte arrangörer. */
export const PLATFORM_DOMAINS = /tickster|nortic|billetto|eventbrite|ticketmaster|kulturbiljetter|biljett|tickets\.|showtic|nolltvå|axs\.|dice\.fm|livenation|meetup\.com/i;

/** hostName-värden som är källans namn snarare än en arrangör. */
const GENERIC_HOSTS = new Set(['facebook', 'tickster', 'billetto', 'eventbrite', 'ticketmaster', 'meetup']);

export function siteDomain(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
}

export function organizerKey(hostName: string, domain: string): string {
    return `${hostName.trim().toLowerCase()}|${domain}`;
}

function distKm(la1: number, lo1: number, la2: number, lo2: number): number {
    const r = (d: number) => (d * Math.PI) / 180;
    const a = Math.sin(r(la2 - la1) / 2) ** 2
        + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Närmaste ort inom maxKm, annars null. */
export function nearestPlace(
    places: { name: string; lat: number; lng: number }[],
    lat: number | null,
    lng: number | null,
    maxKm = 40,
): string | null {
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let best: string | null = null;
    let bestD = maxKm;
    for (const p of places) {
        // Billig förkoll: en grad latitud ≈ 111 km.
        if (Math.abs(p.lat - lat) > maxKm / 111) continue;
        const d = distKm(lat, lng, p.lat, p.lng);
        if (d < bestD) { best = p.name; bestD = d; }
    }
    return best;
}

function topKeys(m: Map<string, number>, n: number): string[] {
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k);
}

export function groupOrganizers(
    rows: OrganizerEventRow[],
    opts: { nowIso: string; placeOf: (lat: number | null, lng: number | null) => string | null; minUpcoming?: number },
): Organizer[] {
    const minUpcoming = opts.minUpcoming ?? 3;
    interface Acc {
        namn: Map<string, number>;
        doman: string;
        urls: string[];
        kommande: OrganizerEventRow[];
        orter: Map<string, number>;
        kategorier: Map<string, number>;
    }
    const groups = new Map<string, Acc>();
    for (const r of rows) {
        const host = r.hostName?.replace(/\s+/g, ' ').trim();
        if (!host || host.length < 3 || GENERIC_HOSTS.has(host.toLowerCase())) continue;
        const domain = siteDomain(r.url);
        if (!domain || PLATFORM_DOMAINS.test(domain)) continue;
        const key = organizerKey(host, domain);
        let g = groups.get(key);
        if (!g) {
            g = { namn: new Map(), doman: domain, urls: [], kommande: [], orter: new Map(), kategorier: new Map() };
            groups.set(key, g);
        }
        // Stavningen varierar ibland i versaler - visa den vanligaste.
        g.namn.set(host, (g.namn.get(host) ?? 0) + 1);
        g.urls.push(r.url);
        if (r.time && r.time >= opts.nowIso) g.kommande.push(r);
        const ort = opts.placeOf(r.lat, r.lng);
        if (ort) g.orter.set(ort, (g.orter.get(ort) ?? 0) + 1);
        if (r.category) g.kategorier.set(r.category, (g.kategorier.get(r.category) ?? 0) + 1);
    }

    const out: Organizer[] = [];
    for (const [nyckel, g] of groups) {
        if (g.kommande.length < minUpcoming) continue;
        const exempel = [...g.kommande]
            .sort((a, b) => String(a.time).localeCompare(String(b.time)))
            .filter((e, i, arr) => arr.findIndex(x => x.title === e.title) === i) // en per titel
            .slice(0, 5)
            .map(e => ({
                titel: (e.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
                tid: String(e.time),
                ort: opts.placeOf(e.lat, e.lng),
                url: e.url,
            }));
        out.push({
            nyckel,
            namn: topKeys(g.namn, 1)[0],
            doman: g.doman,
            kanal: /(^|\.)facebook\.com$/.test(g.doman) ? 'facebook' : 'mejl',
            eventTotalt: g.urls.length,
            kommande: g.kommande.length,
            orter: topKeys(g.orter, 3),
            kategorier: topKeys(g.kategorier, 3),
            exempel,
            urls: g.urls,
        });
    }
    return out.sort((a, b) => b.kommande - a.kommande || a.nyckel.localeCompare(b.nyckel));
}

/** Firestores `in`-filter tar max 30 värden per fråga. */
export function chunk<T>(items: T[], size = 30): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}
