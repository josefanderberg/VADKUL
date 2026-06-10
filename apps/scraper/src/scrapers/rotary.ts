/**
 * rotary.ts — Rotary Sverige via ClubRunner-distriktens event-aggregat.
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
 */

import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

const DISTRICTS = ['2325', '2335', '2355', '2365', '2395', '2405'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DAYS = process.env.ROTARY_DAYS ? parseInt(process.env.ROTARY_DAYS, 10) : 180;
const MAX_EVENTS = process.env.ROTARY_MAX_EVENTS ? parseInt(process.env.ROTARY_MAX_EVENTS, 10) : Infinity;
const EVENT_TYPES = ['General', 'Fundraiser', 'ClubEvent', 'ClubMeeting', 'OfficialDgVisit'];
// Rena interna markörer (Deadline/Board/Committee) utelämnas — sällan publika event.

/** US-format "jun 11, 2026" (ClubRunner kräver MMM d, yyyy; ISO ger 0). */
function usDate(d: Date): string {
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

async function fetchDistrictEvents(host: string, siteId: string, from: Date, to: Date): Promise<any[]> {
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
        console.error(`  [Rotary] ${host} fel:`, (err as Error).message);
        return [];
    }
}

export async function scrapeRotary(): Promise<number> {
    console.log('[Rotary] Hämtar distriktsevent via ClubRunner…');
    const now = new Date();
    const to = new Date(now.getTime() + DAYS * 24 * 60 * 60 * 1000);
    const todayIso = now.toISOString().slice(0, 10);
    const geoCache = new Map<string, [number, number] | null>();
    let saved = 0, scanned = 0, districtsOk = 0;

    for (const d of DISTRICTS) {
        const host = `rotary${d}.se`;
        const siteId = await discoverSiteId(host);
        if (!siteId) { console.log(`  [Rotary] ${host} — ingen GetDistrictEvents-endpoint (hoppas över)`); continue; }
        const events = await fetchDistrictEvents(host, siteId, now, to);
        if (!events.length) continue;
        districtsOk++;
        console.log(`  [Rotary] ${host} (site ${siteId}) — ${events.length} event`);

        for (const e of events) {
            if (saved >= MAX_EVENTS) break;
            scanned++;
            try {
                const title = (e.Name || '').toString().trim();
                if (!title || !e.StartDate) continue;
                if ((e.StartDate || '').slice(0, 10) < todayIso) continue;

                const when = new Date(e.StartDate); // lokal Stockholmstid (ISO utan TZ)
                if (isNaN(when.getTime())) continue;
                const hasSpecificTime = e.HasStartsAt !== false && !(when.getHours() === 0 && when.getMinutes() === 0);

                const url = (e.Url || e.RegistrationUrl || '').toString().trim();
                if (!url) continue;
                if (await eventExistsInDb(url)) continue;

                const club = (e.ClubShortName || '').toString().trim();
                const location = (e.Location || e.LocationString || '').toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

                let lat = 0, lng = 0;
                const geoKey = location || (club ? `${club}, Sverige` : '');
                if (geoKey) {
                    if (!geoCache.has(geoKey)) geoCache.set(geoKey, await geocodeVenueSweden(geoKey));
                    const c = geoCache.get(geoKey);
                    if (c) { lat = c[0]; lng = c[1]; }
                }

                const description = (e.Description || '')
                    .toString().replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

                await addEventToDb({
                    title,
                    url,
                    time: when,
                    hasSpecificTime,
                    locationName: location ? `${location}${club ? `, Rotaryklubb ${club}` : ''}` : (club ? `Rotaryklubb ${club}` : 'Rotary'),
                    lat: lat || 0,
                    lng: lng || 0,
                    hostName: club ? `Rotary ${club}` : 'Rotary',
                    category: classifyEvent(title, description),
                    createdAt: new Date(),
                    coverImage: e.ImageFullUrl || e.EventImageUrl || null,
                    price: '',
                    description,
                    isLocationVerified: !!(lat && lng),
                });
                saved++;
            } catch (err) {
                console.error('  [Rotary] event-fel:', (err as Error).message);
            }
        }
    }

    console.log(`[Rotary] Klar — ${saved} nya event (${scanned} skannade, ${districtsOk} distrikt med data).`);
    return saved;
}

if (require.main === module) {
    scrapeRotary()
        .then((n) => { console.log(`Totalt sparat: ${n}`); process.exit(0); })
        .catch((e) => { console.error(e); process.exit(1); });
}
