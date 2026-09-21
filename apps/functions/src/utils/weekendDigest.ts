/**
 * weekendDigest — REN urvalslogik för torsdagens helgtips-push ("Vad händer
 * i helgen i din stad"). Ingen Firestore, ingen fetch här: funktionen i
 * index.ts matar in eventlistan (det publika events-destinations-aggregatet)
 * och stadens centrum, det här räknar ut helgfönstret, väljer topp-eventen
 * och formulerar notisen. Testas med vitest (npm test i apps/functions).
 *
 * Tidszonen är Europe/Stockholm rakt igenom: "helgen" är fredag 00:00 till
 * måndag 00:00 i svensk väggtid, oavsett sommartid — därav offset-hjälparna
 * (Intl-baserade, inga beroenden).
 */

export interface DigestEvent {
    id: string;
    title: string;
    /** ISO-sträng ur aggregatet (UTC). */
    time: string;
    /** false = heldagsevent utan klockslag (tid = svensk midnatt). */
    hasSpecificTime?: boolean;
    lat?: number;
    lng?: number;
    category?: string;
    /** Populär-flaggan pipelinen bakar (tröskel 40). */
    pop?: boolean;
    /** Popularitetspoängen bakom flaggan (scraperns popularRank) - bara på
     *  pop-event. Saknas i aggregat byggda före 21/9. */
    ps?: number;
}

export interface DigestCityPoint {
    slug: string;
    name: string;
    lat: number;
    lng: number;
}

/** Stadssidornas mått: utbudet I ORTEN är ≤10 km, inte 35. Samma här. */
export const DIGEST_RADIUS_KM = 10;
/** Färre helgevent än så → ingen push. En notis med "2 event" säljer inte
 *  återbesöket, den lär folk att stänga av notiser. */
export const DIGEST_MIN_EVENTS = 3;
/** Familj lyfts inte i notistexten — kartans standard för vuxna utan barn
 *  (familjefiltret) gäller även här; eventen räknas ändå i totalen. */
const PICK_EXCLUDED_CATEGORIES = new Set(['family']);
/** Max händelser som namnges i notiskroppen. */
const MAX_PICKS = 3;
/** Pipelinens POPULAR_THRESHOLD: ett pop-event utan poäng (aggregat från
 *  före ps-fältet) räknas som precis på ribban, så ett event MED poäng
 *  aldrig förlorar mot det. */
const POP_SCORE_FLOOR = 40;

const popScore = (e: DigestEvent): number => e.ps ?? (e.pop ? POP_SCORE_FLOOR : 0);

/** Europe/Stockholm-offset (ms) vid en given tidpunkt — CET/CEST-säker. */
export function stockholmOffsetMs(at: Date): number {
    const dtf = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Stockholm', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p: Record<string, string> = {};
    dtf.formatToParts(at).forEach(part => { p[part.type] = part.value; });
    const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return wallAsUtc - at.getTime();
}

/** Väggdatumet i Stockholm för en tidpunkt. */
function stockholmDate(at: Date): { y: number; m: number; d: number } {
    const dtf = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Stockholm',
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const p: Record<string, string> = {};
    dtf.formatToParts(at).forEach(part => { p[part.type] = part.value; });
    return { y: +p.year, m: +p.month, d: +p.day };
}

/** UTC-tidpunkten för svensk midnatt på ett givet väggdatum. Två varv för
 *  att offset ska läsas vid rätt instant (DST-byten sker 02/03 svensk tid,
 *  så andra varvet är alltid stabilt). */
function stockholmMidnightUtc(y: number, m: number, d: number): Date {
    let guess = Date.UTC(y, m - 1, d);
    for (let i = 0; i < 2; i++) {
        guess = Date.UTC(y, m - 1, d) - stockholmOffsetMs(new Date(guess));
    }
    return new Date(guess);
}

/**
 * Helgfönstret [fredag 00:00, måndag 00:00) i svensk tid, sett från `from`.
 * Torsdag (utskicksdagen) → kommande helg; fre/lör/sön (manuell körning)
 * → innevarande helg.
 */
export function weekendRange(from: Date): { start: Date; end: Date } {
    const { y, m, d } = stockholmDate(from);
    // Middag som referens: dygnsgränser/DST kan aldrig knuffa den till fel dag.
    const wallNoon = Date.UTC(y, m - 1, d, 12);
    const weekday = new Date(wallNoon).getUTCDay(); // 0=sön … 5=fre, 6=lör
    const toFriday = weekday === 0 ? -2 : 5 - weekday;
    const fri = new Date(wallNoon + toFriday * 86_400_000);
    const mon = new Date(fri.getTime() + 3 * 86_400_000);
    return {
        start: stockholmMidnightUtc(fri.getUTCFullYear(), fri.getUTCMonth() + 1, fri.getUTCDate()),
        end: stockholmMidnightUtc(mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate()),
    };
}

/** ISO-veckonyckel ("2026-W38") för dedupe-markören — beräknad på svenskt
 *  väggdatum så en körning strax före/efter midnatt aldrig byter vecka. */
export function isoWeekId(at: Date): string {
    const { y, m, d } = stockholmDate(at);
    const date = new Date(Date.UTC(y, m - 1, d));
    const day = (date.getUTCDay() + 6) % 7; // mån=0 … sön=6
    date.setUTCDate(date.getUTCDate() - day + 3); // torsdagen i samma vecka
    const isoYear = date.getUTCFullYear();
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const week = 1 + Math.round(
        ((date.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7,
    );
    return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Stadens helgurval: totalantalet inom radien + topp-eventen till notistexten.
 * null = för tunn helg (under DIGEST_MIN_EVENTS) → ingen push till den staden.
 *
 * Rankning: HÖGST popularitetspoäng först (ps; icke-populära = 0), sedan
 * event med riktigt klockslag, sedan tidigast. Med bara pop-flaggan vann det
 * tidigaste av de populära - Stockholms lördag 26/9 blev en bussresa till
 * Lidingöloppet kl 05 (Josef 21/9: "välj det mest populära"). En pick per
 * dag (fre/lör/sön) så texten speglar HELA helgen; blir det färre dagar med
 * event fylls resten ur totalrankningen.
 */
export function pickWeekendDigest(
    events: DigestEvent[],
    city: DigestCityPoint,
    range: { start: Date; end: Date },
): { count: number; picks: DigestEvent[] } | null {
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();

    const inCity = events.filter(e => {
        const t = Date.parse(e.time);
        if (!Number.isFinite(t) || t < startMs || t >= endMs) return false;
        // (0,0) är pipelinens "plats saknas" — aldrig en riktig svensk position.
        if (typeof e.lat !== 'number' || typeof e.lng !== 'number' || (e.lat === 0 && e.lng === 0)) return false;
        return haversineKm(e.lat, e.lng, city.lat, city.lng) <= DIGEST_RADIUS_KM;
    });
    if (inCity.length < DIGEST_MIN_EVENTS) return null;

    const candidates = inCity.filter(e => !PICK_EXCLUDED_CATEGORIES.has(e.category ?? ''));
    const rank = (a: DigestEvent, b: DigestEvent) =>
        (popScore(b) - popScore(a))
        || (Number(b.hasSpecificTime !== false) - Number(a.hasSpecificTime !== false))
        || (Date.parse(a.time) - Date.parse(b.time));

    const byDay = new Map<string, DigestEvent[]>();
    for (const e of candidates) {
        const { y, m, d } = stockholmDate(new Date(e.time));
        const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const arr = byDay.get(key);
        if (arr) arr.push(e); else byDay.set(key, [e]);
    }

    const picks: DigestEvent[] = [];
    for (const day of [...byDay.keys()].sort()) {
        if (picks.length >= MAX_PICKS) break;
        picks.push([...byDay.get(day)!].sort(rank)[0]);
    }
    if (picks.length < MAX_PICKS) {
        const chosen = new Set(picks.map(p => p.id));
        for (const e of [...candidates].sort(rank)) {
            if (picks.length >= MAX_PICKS) break;
            if (!chosen.has(e.id)) { picks.push(e); chosen.add(e.id); }
        }
    }
    if (picks.length === 0) return null; // helgen bestod bara av bortfiltrerat

    return { count: inCity.length, picks };
}

/** Svensk kort veckodag ("Fre") för notiskroppen. */
function dayShort(iso: string): string {
    const label = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'short' })
        .format(new Date(iso))
        .replace('.', '');
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function truncate(s: string, max: number): string {
    return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Notisens titel + kropp. Kroppen namnger topp-eventen dag för dag. */
export function digestPushText(
    city: DigestCityPoint,
    count: number,
    picks: DigestEvent[],
): { title: string; body: string } {
    const title = `🎉 I helgen i ${city.name}: ${count} event`;
    const parts = picks.map(p => `${dayShort(p.time)}: ${truncate(p.title, 30)}`);
    const rest = count - picks.length;
    const body = rest > 0 ? `${parts.join(' · ')} — och ${rest} till.` : parts.join(' · ');
    return { title, body };
}
