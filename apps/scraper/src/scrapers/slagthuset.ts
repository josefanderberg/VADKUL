/**
 * Slagthuset — scen/konsert-/klubbhus i Malmö (Saluhallen, Stora scenen m.fl.).
 *
 * Next.js-frontend men exponerar ett rent JSON-API som redan filtrerar till
 * KOMMANDE event (recon 2026-06-22, verifierat ~73 framtida):
 *   GET https://slagthuset.se/api/events
 *   → [ { id, slug, title:{rendered}, featured_media, acf:{...}, event_medium:{url}, ... } ]
 *
 * SAMMA ACF-SCHEMA driver även Kulturmejeriet i Lund (upptäckt 2026-07-10 —
 * samma byrå bakom sajterna?): headless WP på cms.mejeriet.net, CPT "program",
 *   GET https://cms.mejeriet.net/wp-json/wp/v2/program?per_page=100&acf_format=standard
 * Skillnader som motorn tolererar: acf.plats är STRÄNG (inte term-array),
 * kategorin heter typ_av_arrangemang (inte typ_av_evenemang), bilden ligger i
 * toppnivåns fimg_url/large (inte event_medium.url), och acf.kort_info finns
 * som extra ingress. wp/v2-varianten är publiceringssorterad och innehåller
 * även passerade event — fönsterfiltret i motorn/runnern klipper dem.
 *
 * Fallgropar (verifierade):
 *  - acf.startdatum är "YYYYMMDD" (ingen separator) — egen parsning krävs,
 *    standard wp-rest/wp-v2-motorn klarar den inte.
 *  - Tid ligger i acf.borjar ("20:00") / acf.oppnar ("19:00", insläpp). Saknas
 *    tid → hasSpecificTime=false (runnern sätter neutral eftermiddag).
 *  - featured_media är bara ett ID; bilden finns i event_medium.url (beskuren,
 *    -WxH-suffix strippas för full upplösning).
 *  - Publik eventsida: slagthuset.se/<slug> (ingen /event/-prefix).
 *  - acf.gom_i_kalender = göm från kalender → hoppa över.
 *  - title.rendered har HTML-entiteter (&#038; etc) → avkodas.
 */

import { RawEvent, Engine } from '../sources/types';
import { decodeHtmlEntities } from '../utils/categoryNormalize';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SlagthusetConfig {
    apiUrl?: string;
    eventBaseUrl?: string;
    defaultCity?: string;
}

interface SlagthusetTerm { name?: string }
interface SlagthusetEvent {
    id?: number;
    slug?: string;
    title?: { rendered?: string };
    event_medium?: { url?: string };
    /** Mejeriet-varianten (wp/v2): utvald bild på toppnivå. */
    fimg_url?: string | false;
    large?: string | false;
    acf?: {
        startdatum?: string;       // "YYYYMMDD"
        slutdatum?: string;        // "YYYYMMDD" | ""
        oppnar?: string;           // "19:00" (insläpp)
        borjar?: string;           // "20:00" (start)
        /** Slagthuset: term-array. Mejeriet: ren sträng ("Mejeriet"). */
        plats?: SlagthusetTerm[] | string;
        ingang?: string;           // gatuadress
        underrubrik?: string;
        kort_info?: string;        // Mejeriet: ingress
        lang_info?: string;        // HTML-beskrivning
        pris?: string;
        aldersgrans?: string;
        typ_av_evenemang?: SlagthusetTerm;      // Slagthuset
        typ_av_arrangemang?: SlagthusetTerm;    // Mejeriet
        gom_i_kalender?: boolean | string;
    };
}

/** "YYYYMMDD" + valfri "HH:MM" → lokal Date. Returnerar null vid skräp. */
export function parseSlagthusetDate(
    ymd: string | undefined,
    time: string | undefined,
): { date: Date; hasClock: boolean } | null {
    if (!ymd || !/^\d{8}$/.test(ymd)) return null;
    const y = parseInt(ymd.slice(0, 4), 10);
    const mo = parseInt(ymd.slice(4, 6), 10);
    const da = parseInt(ymd.slice(6, 8), 10);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;

    const clock = time && /^\d{1,2}:\d{2}$/.test(time.trim()) ? time.trim() : null;
    const [hh, mi] = clock ? clock.split(':').map((n) => parseInt(n, 10)) : [0, 0];
    const date = new Date(y, mo - 1, da, hh, mi);
    if (isNaN(date.getTime())) return null;
    return { date, hasClock: !!clock };
}

/** Strippa WordPress -WxH-beskärningssuffix → originalbild. */
function fullResImage(url: string | undefined): string | undefined {
    if (!url) return undefined;
    return url.replace(/-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp))$/i, '$1');
}

const truthy = (v: unknown): boolean =>
    v === true || v === 1 || v === '1' || v === 'true';

/** Mappa ett Slagthuset-event → RawEvent. Exporterad för test. */
export function mapSlagthusetEvent(
    e: SlagthusetEvent,
    eventBaseUrl: string,
    defaultCity: string,
): RawEvent | null {
    const acf = e.acf;
    if (!acf || truthy(acf.gom_i_kalender)) return null;

    const title = decodeHtmlEntities(String(e.title?.rendered || '').trim());
    if (!title) return null;

    const parsed = parseSlagthusetDate(acf.startdatum, acf.borjar || acf.oppnar);
    if (!parsed) return null;

    const end = parseSlagthusetDate(acf.slutdatum, undefined);
    const endDate = end && end.date.getTime() > parsed.date.getTime() ? end.date : undefined;

    const venueName = typeof acf.plats === 'string'
        ? acf.plats.trim() || undefined
        : acf.plats?.find((p) => p?.name)?.name?.trim() || undefined;
    const categoryTerm = acf.typ_av_evenemang?.name || acf.typ_av_arrangemang?.name;
    const category = categoryTerm ? categoryTerm.toLowerCase().trim() : undefined;

    const lead = acf.underrubrik ? decodeHtmlEntities(acf.underrubrik.trim()) : '';
    const intro = acf.kort_info ? decodeHtmlEntities(acf.kort_info.trim()) : '';
    const body = acf.lang_info
        ? decodeHtmlEntities(acf.lang_info.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
        : '';
    const description = [lead, intro, body].filter(Boolean).join(' ').slice(0, 800) || undefined;

    return {
        externalId: e.id != null ? String(e.id) : undefined,
        title,
        startDate: parsed.date,
        endDate,
        url: e.slug ? `${eventBaseUrl.replace(/\/$/, '')}/${e.slug}` : eventBaseUrl,
        venueName,
        city: defaultCity,
        address: acf.ingang?.trim() || undefined,
        description,
        imageUrl: fullResImage(
            e.event_medium?.url
            || (typeof e.fimg_url === 'string' ? e.fimg_url : undefined)
            || (typeof e.large === 'string' ? e.large : undefined),
        ),
        category,
        price: acf.pris?.trim() || undefined,
        hasSpecificTime: parsed.hasClock,
    };
}

export const slagthusetEngine: Engine = async (config: SlagthusetConfig, ctx) => {
    const apiUrl = config.apiUrl || 'https://slagthuset.se/api/events';
    const eventBaseUrl = config.eventBaseUrl || 'https://slagthuset.se';
    const defaultCity = config.defaultCity || 'Malmö';

    let raw: SlagthusetEvent[];
    try {
        const res = await fetch(apiUrl, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: ctx.signal ?? AbortSignal.timeout(30_000),
        });
        if (!res.ok) { ctx.log(`HTTP ${res.status} från ${apiUrl}`); return []; }
        const data: any = await res.json();
        raw = Array.isArray(data) ? data : [];
    } catch (err) {
        ctx.log(`fetch misslyckades: ${(err as Error).message}`);
        return [];
    }

    const all: RawEvent[] = [];
    for (const e of raw) {
        const ev = mapSlagthusetEvent(e, eventBaseUrl, defaultCity);
        // Fönsterfiltret sköts av runnern; hoppa passerade direkt.
        if (ev && ev.startDate >= ctx.windowStart) all.push(ev);
    }
    ctx.log(`${raw.length} event i API → ${all.length} kommande`);
    return all;
};
