/**
 * visitlulea — Engine för Visit Luleås evenemangskalender (Umbraco).
 *
 * Upptäckt 2026-09-04 i källsvepet: Luleå låg på 9 lokala event i city-gaps
 * trots 79 000 invånare. visitlulea.se/evenemang renderas av JS mot
 *
 *   POST https://visitlulea.se/umbraco/api/eventsapi/filter
 *   body { CurrentPageId: 3925, CurrentLanguage: "sv", Sorting: "date_asc",
 *          Category: "all", Between: { Start: "YYYY-MM-DD", End: "YYYY-MM-DD" },
 *          Page: N, HitsPerPage: 50 }
 *
 * Öppet, ingen auth. GET 405:ar. FÄLLA: utan HitsPerPage svarar API:t med
 * TotalHits > 0 men Hits: [] — sidstorleken måste sättas explicit. Svaret
 * bär CurrentFilter.TotalPages för pagineringen (53 träffar/30 dagar → 2 sidor).
 *
 * Fältkvalitet: Header, Url (relativ /evenemang/<år>/<slug>/), StartDate/
 * EndDate (lokal midnatt — inget klockslag i API:t; detaljsidan har
 * "Vernissage: 27 augusti kl 18.00" i löptext), Location (venue-namn, 100 %),
 * Image.Url (relativ), Category (Utställning/Musik/Sport/Familj …), LeadText.
 * CurrentPageId 3925 är kalendersidans nod-id — står i sidans XHR.
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface VisitLuleaConfig {
    /** Default https://visitlulea.se */
    baseUrl?: string;
    /** Kalendersidans Umbraco-nod (default 3925). */
    pageId?: number;
    defaultCity: string;
    /** Säkerhetsspärr på antal sidor (default 6 = 300 träffar). */
    maxPages?: number;
}

export interface VisitLuleaHit {
    Id?: string;
    ContentId?: number;
    Header?: string;
    Image?: { Url?: string; AltText?: string } | null;
    Category?: string | null;
    Url?: string;
    StartDate?: string | null;
    EndDate?: string | null;
    LeadText?: string | null;
    Location?: string | null;
    NextOpenDate?: string | null;
    IsSingleDateEvent?: boolean;
}

/** Visit Luleås kategorier → våra där mappningen är entydig; övrigt klassar runnern. */
const CATEGORY_MAP: Record<string, string> = {
    'utställning': 'art',
    'musik': 'music',
    'sport': 'sport',
    'familj': 'family',
    'teater': 'stage',
    'dans': 'stage',
    'loppis & auktion': 'market',
};

/** "2026-09-05T00:00:00" (lokal) → Date i processens zon. */
function parseLocal(s: string | null | undefined): Date | null {
    const m = (s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
    return isNaN(d.getTime()) ? null : d;
}

/** Mappa en API-träff → RawEvent. Exporterad för test. */
export function mapVisitLuleaHit(h: VisitLuleaHit, cfg: VisitLuleaConfig): RawEvent | null {
    const title = h.Header?.trim();
    const path = h.Url?.trim();
    if (!title || !path) return null;
    const start = parseLocal(h.StartDate);
    if (!start) return null;
    const base = (cfg.baseUrl || 'https://visitlulea.se').replace(/\/+$/, '');
    const abs = (p: string) => (/^https?:\/\//.test(p) ? p : `${base}${p.startsWith('/') ? '' : '/'}${p}`);
    const end = parseLocal(h.EndDate);
    const hasTime = /T(?!00:00)\d{2}:\d{2}/.test(h.StartDate || '');
    const cat = CATEGORY_MAP[(h.Category || '').trim().toLowerCase()];

    return {
        externalId: h.ContentId ? String(h.ContentId) : undefined,
        title,
        startDate: start,
        endDate: end && end > start ? end : undefined,
        url: abs(path),
        venueName: h.Location?.trim() || undefined,
        city: cfg.defaultCity,
        description: cleanDescription(h.LeadText || '') || undefined,
        imageUrl: h.Image?.Url ? abs(h.Image.Url) : undefined,
        category: cat,
        hasSpecificTime: hasTime ? true : undefined,
    };
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const visitLuleaEngine: Engine = async (config: VisitLuleaConfig, ctx) => {
    const base = (config.baseUrl || 'https://visitlulea.se').replace(/\/+$/, '');
    const maxPages = config.maxPages ?? 6;
    const out: RawEvent[] = [];
    const seen = new Set<string>();
    let totalPages = 1;

    for (let page = 1; page <= Math.min(totalPages, maxPages); page++) {
        const body = {
            CurrentPageId: config.pageId ?? 3925,
            CurrentLanguage: 'sv',
            Sorting: 'date_asc',
            Category: 'all',
            Between: { Start: iso(ctx.windowStart), End: iso(ctx.windowEnd) },
            Page: page,
            HitsPerPage: 50,
        };
        let data: { CurrentFilter?: { TotalPages?: number; TotalHits?: number }; Hits?: VisitLuleaHit[] };
        try {
            const res = await fetch(`${base}/umbraco/api/eventsapi/filter`, {
                method: 'POST',
                headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(body),
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`Visit Luleå HTTP ${res.status} (sida ${page})`); break; }
            data = await res.json();
        } catch (e: any) {
            ctx.log(`Visit Luleå fetch-fel: ${e?.message || e}`);
            break;
        }
        totalPages = data.CurrentFilter?.TotalPages ?? 1;
        const hits = data.Hits ?? [];
        ctx.log(`Visit Luleå: sida ${page}/${totalPages} — ${hits.length} träffar (totalt ${data.CurrentFilter?.TotalHits ?? '?'})`);
        for (const h of hits) {
            const ev = mapVisitLuleaHit(h, config);
            if (!ev || seen.has(ev.url)) continue;
            seen.add(ev.url);
            out.push(ev);
        }
        if (hits.length === 0) break;
    }
    return out;
};
