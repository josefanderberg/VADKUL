/**
 * rotary — Engine för Rotary Sverige via ClubRunner-distriktens event-aggregat.
 *
 * rotary.se (nationella portalen) saknar eget event-flöde. Däremot kör Sveriges
 * sex distrikt på ClubRunner, vars distriktssida har ETT POST-endpoint som
 * aggregerar ALLA medlemsklubbars event i distriktet (per-distrikt-loop, à la
 * Hembygd men bara 6 anrop):
 *
 *   POST https://rotary<NNNN>.se/<siteId>/Event/GetDistrictEvents
 *   headers: content-type: application/json; charset=UTF-8, X-Requested-With: XMLHttpRequest
 *   body:    {"From":"jun 11, 2026","To":"dec 11, 2026",
 *             "DistrictEventTypeIds":[],"ClubEventTypeSystemNames":[…]}
 *
 * VIKTIGT: datumformatet är US "MMM d, yyyy" (gemener funkar) — ISO ger 0 träffar.
 * Ingen auth. `<siteId>` upptäcks i drift genom att skrapa distriktets /events-sida
 * (3 av 6 distrikt exponerar endpointen; övriga kör widget-iframes och hoppas över).
 *
 * StartDate "2026-06-10T18:30:00" = lokal Stockholmstid (ingen TZ). HasStartsAt
 * styr om tiden är specifik. Url = ClubRunner-portalens event-URL (unik dedup-nyckel).
 *
 * Körs via registryt: `npm run sources -- --ids=rotary [--dry-run]`
 * (windowDays: 180 i registryt — klubb-event är glesa, distrikten publicerar långt fram.)
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';

const DEFAULT_DISTRICTS = ['2325', '2335', '2355', '2365', '2395', '2405'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const EVENT_TYPES = ['General', 'Fundraiser', 'ClubEvent', 'ClubMeeting', 'OfficialDgVisit'];
// Rena interna markörer (Deadline/Board/Committee) utelämnas — sällan publika event.

/** US-format "jun 11, 2026" (ClubRunner kräver MMM d, yyyy; ISO ger 0). Exporterad för test. */
export function usDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
}

/** Skrapa distriktets /events-sida för GetDistrictEvents-siteId (null om iframe-distrikt). */
async function discoverSiteId(host: string): Promise<string | null> {
    try {
        const r = await fetch(`https://${host}/events`, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
        if (!r.ok) return null;
        const html = await r.text();
        const m = html.match(/\/(\d{4,6})\/Event\/GetDistrictEvents/i);
        return m ? m[1] : null;
    } catch {
        return null;
    }
}

async function fetchDistrictEvents(host: string, siteId: string, from: Date, to: Date, log: (msg: string) => void): Promise<any[]> {
    try {
        const r = await fetch(`https://${host}/${siteId}/Event/GetDistrictEvents`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json; charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest',
                'user-agent': UA,
                'referer': `https://${host}/events`,
            },
            body: JSON.stringify({
                From: usDate(from),
                To: usDate(to),
                DistrictEventTypeIds: [],
                ClubEventTypeSystemNames: EVENT_TYPES,
            }),
            signal: AbortSignal.timeout(25_000),
        });
        if (!r.ok) return [];
        const j = await r.json();
        return Array.isArray(j?.Events) ? j.Events : [];
    } catch (err) {
        log(`${host} fel: ${(err as Error).message}`);
        return [];
    }
}

/**
 * Mappa ett ClubRunner-event → RawEvent. null = hoppa över (saknar titel/datum/URL).
 * Exporterad för test.
 */
export function mapRotaryEvent(e: any): RawEvent | null {
    const title = (e?.Name || '').toString().trim();
    if (!title || !e?.StartDate) return null;

    const startDate = new Date(e.StartDate);   // lokal Stockholmstid (ISO utan TZ)
    if (isNaN(startDate.getTime())) return null;
    // Källan VET: HasStartsAt=false betyder datum-utan-klocka oavsett parsead tid.
    const hasSpecificTime = e.HasStartsAt !== false && !(startDate.getHours() === 0 && startDate.getMinutes() === 0);

    const url = (e.Url || e.RegistrationUrl || '').toString().trim();
    if (!url) return null;

    const club = (e.ClubShortName || '').toString().trim();
    const location = (e.Location || e.LocationString || '').toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    return {
        title,
        url,
        startDate,
        hasSpecificTime,
        venueName: location
            ? `${location}${club ? `, Rotaryklubb ${club}` : ''}`
            : (club ? `Rotaryklubb ${club}` : 'Rotary'),
        geocodeCandidates: [location, club ? `${club}, Sverige` : ''].filter(Boolean),
        hostName: club ? `Rotary ${club}` : 'Rotary',
        imageUrl: e.ImageFullUrl || e.EventImageUrl || undefined,
        description: cleanDescription(e.Description),
    };
}

export const rotaryEngine: Engine = async (config, ctx) => {
    const districts: string[] = config?.districts ?? DEFAULT_DISTRICTS;
    const events: RawEvent[] = [];
    let scanned = 0, districtsOk = 0;

    for (const d of districts) {
        const host = `rotary${d}.se`;
        const siteId = await discoverSiteId(host);
        if (!siteId) { ctx.log(`${host} — ingen GetDistrictEvents-endpoint (hoppas över)`); continue; }
        const districtEvents = await fetchDistrictEvents(host, siteId, ctx.windowStart, ctx.windowEnd, ctx.log);
        if (!districtEvents.length) continue;
        districtsOk++;
        ctx.log(`${host} (site ${siteId}) — ${districtEvents.length} event`);

        for (const e of districtEvents) {
            scanned++;
            const mapped = mapRotaryEvent(e);
            if (mapped) events.push(mapped);
        }
    }

    ctx.log(`${districtsOk} distrikt med data, ${events.length} kandidater (${scanned} skannade)`);
    return events;
};
