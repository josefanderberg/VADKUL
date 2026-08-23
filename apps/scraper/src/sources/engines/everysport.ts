/**
 * Everysport-engine — åskådarsport (matcher) via officiella API:t.
 *
 *   GET https://api.everysport.com/v1/events?apikey=…&country=se
 *       &status=UPCOMING&fromDate=…&toDate=…&sport=…&limit=100&offset=N
 *
 * Dokumentation: https://app.swaggerhub.com/apis-docs/esmg/Everysport/1.0
 * Nyckel: mejla support@everysport.com (gratis). Läses ur EVERYSPORT_API_KEY.
 *
 * Kartplacering: Event.facts.arena bär namn, stad och koordinater (position
 * och/eller RT90) — ingen geokodning behövs när arenan är satt; annars faller
 * vi till hemmalagets arena, sedan facts.city (geokodas av runnern).
 *
 * Byggd 2026-08-23 MOT SWAGGER-SPECEN (nyckel fanns inte än) — fältmappningen
 * är enhetstestad mot spec-exempel; verifiera mot riktiga svar när nyckeln
 * kommer och justera EVENT_URL-mallen (webbsidans URL-mönster är klientroutat
 * och ogissbart utan data).
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { fetchWithRetry } from '../../utils/fetchWithRetry';

const API_BASE = 'https://api.everysport.com/v1';

export interface EverysportConfig {
    /** Sport-id:n eller slugs enligt /v1/sports (t.ex. fotboll=10). Tomt = alla. */
    sports?: (string | number)[];
    /** Specifika liga-id:n (annars country-filtret). */
    leagues?: number[];
    /** default 'se' */
    country?: string;
    /** Max antal event per körning (limit*pages). Default 1000. */
    maxEvents?: number;
    /** Env-variabel med nyckeln. Default EVERYSPORT_API_KEY. */
    apikeyEnv?: string;
}

/** Rått Event ur API:t (bara fälten vi läser — se swagger). */
export interface EsEvent {
    id: number;
    startDate?: string;                 // ISO med tid
    round?: number | string;
    status?: string;                    // UPCOMING | ONGOING | FINISHED
    homeTeam?: { name?: string; arena?: EsArena | null };
    visitingTeam?: { name?: string };
    league?: { name?: string; sport?: { name?: string } };
    facts?: { arena?: EsArena | null; city?: string | null } | null;
}
export interface EsArena {
    name?: string;
    city?: string | null;
    position?: { lat?: number; lng?: number } | null;
    rt90coordinates?: { e?: number; n?: number } | null;
}

/** RT90 → WGS84 (Gauss-Krüger, GRS80-approximation — fullt tillräcklig för kartnålar). */
export function rt90ToWgs84(n: number, e: number): [number, number] {
    const axis = 6378137.0, flattening = 1 / 298.257222101;
    const centralMeridian = (15 + 48 / 60 + 22.624306 / 3600) * Math.PI / 180;
    const scale = 1.00000561024, falseN = -667.711, falseE = 1500064.274;
    const e2 = flattening * (2 - flattening);
    const n2 = flattening / (2 - flattening);
    const aRoof = axis / (1 + n2) * (1 + n2 * n2 / 4 + n2 * n2 * n2 * n2 / 64);
    const xi = (n - falseN) / (scale * aRoof);
    const eta = (e - falseE) / (scale * aRoof);
    const d1 = n2 / 2 - 2 * n2 * n2 / 3 + 37 * n2 ** 3 / 96 - n2 ** 4 / 360;
    const d2 = n2 * n2 / 48 + n2 ** 3 / 15 - 437 * n2 ** 4 / 1440;
    const d3 = 17 * n2 ** 3 / 480 - 37 * n2 ** 4 / 840;
    const d4 = 4397 * n2 ** 4 / 161280;
    const xiP = xi - d1 * Math.sin(2 * xi) * Math.cosh(2 * eta) - d2 * Math.sin(4 * xi) * Math.cosh(4 * eta)
        - d3 * Math.sin(6 * xi) * Math.cosh(6 * eta) - d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
    const etaP = eta - d1 * Math.cos(2 * xi) * Math.sinh(2 * eta) - d2 * Math.cos(4 * xi) * Math.sinh(4 * eta)
        - d3 * Math.cos(6 * xi) * Math.sinh(6 * eta) - d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);
    const phiStar = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
    const deltaLambda = Math.atan(Math.sinh(etaP) / Math.cos(xiP));
    const lonRad = centralMeridian + deltaLambda;
    const aStar = e2 + e2 * e2 + e2 ** 3 + e2 ** 4;
    const bStar = -(7 * e2 * e2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6;
    const cStar = (224 * e2 ** 3 + 889 * e2 ** 4) / 120;
    const dStar = -(4279 * e2 ** 4) / 1260;
    const latRad = phiStar + Math.sin(phiStar) * Math.cos(phiStar)
        * (aStar + bStar * Math.sin(phiStar) ** 2 + cStar * Math.sin(phiStar) ** 4 + dStar * Math.sin(phiStar) ** 6);
    return [latRad * 180 / Math.PI, lonRad * 180 / Math.PI];
}

/** Mappa API-event → RawEvent. Exporterad för test. Null = hoppa (ofullständigt). */
export function mapEsEvent(e: EsEvent): RawEvent | null {
    const home = e.homeTeam?.name?.trim();
    const away = e.visitingTeam?.name?.trim();
    if (!e.id || !home || !away || !e.startDate) return null;
    const start = new Date(e.startDate);
    if (isNaN(start.getTime())) return null;

    const arena = e.facts?.arena ?? e.homeTeam?.arena ?? null;
    let coords: [number, number] | undefined;
    if (arena?.position?.lat != null && arena?.position?.lng != null) coords = [arena.position.lat, arena.position.lng];
    else if (arena?.rt90coordinates?.n != null && arena?.rt90coordinates?.e != null) coords = rt90ToWgs84(arena.rt90coordinates.n, arena.rt90coordinates.e);

    const league = e.league?.name?.trim();
    const sport = e.league?.sport?.name?.trim();
    return {
        externalId: String(e.id),
        title: `${home} – ${away}`,
        startDate: start,
        // Webbens eventmönster är klientroutat; id-URL:en är stabil och unik
        // (PK-krav). Verifiera/uppdatera mallen mot riktiga svar när nyckeln kommer.
        url: `https://www.everysport.com/game/${e.id}`,
        venueName: arena?.name?.trim() || undefined,
        city: arena?.city?.trim() || e.facts?.city?.trim() || undefined,
        coords,
        description: [sport, league, e.round != null ? `omgång ${e.round}` : ''].filter(Boolean).join(' · ') || undefined,
        category: 'sport',
        hasSpecificTime: /T\d{2}:\d{2}/.test(e.startDate) && !/T00:00/.test(e.startDate) ? true : undefined,
    };
}

export const everysportEngine = async (config: EverysportConfig, ctx: EngineContext): Promise<RawEvent[]> => {
    const key = process.env[config.apikeyEnv ?? 'EVERYSPORT_API_KEY'] || '';
    if (!key) { ctx.log('  EVERYSPORT_API_KEY saknas — hoppar (mejla support@everysport.com för nyckel)'); return []; }

    const maxEvents = config.maxEvents ?? 1000;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const events: RawEvent[] = [];
    const limit = 100;

    for (let offset = 0; offset < maxEvents; offset += limit) {
        const params = new URLSearchParams({
            apikey: key,
            limit: String(limit),
            offset: String(offset),
            status: 'UPCOMING',
            fromDate: fmt(ctx.windowStart),
            toDate: fmt(ctx.windowEnd),
            country: config.country ?? 'se',
        });
        if (config.sports?.length) params.set('sport', config.sports.join(','));
        if (config.leagues?.length) params.set('league', config.leagues.join(','));

        const url = `${API_BASE}/events?${params}`;
        await domainLimiter.wait(url);
        const res = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } }, { signal: ctx.signal, label: 'everysport' });
        if (!res.ok) { ctx.log(`  everysport HTTP ${res.status} vid offset ${offset}`); break; }
        const j: any = await res.json();
        const batch: EsEvent[] = j.events ?? [];
        for (const raw of batch) {
            const ev = mapEsEvent(raw);
            if (ev) events.push(ev);
        }
        ctx.log(`  offset ${offset}: ${batch.length} matcher (${events.length} mappade)`);
        if (batch.length < limit) break;
    }
    return events;
};
