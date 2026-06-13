/**
 * Bibliotek (Axiell Arena Nova) — nätverks-engine för svenska folkbiblioteks
 * evenemangskalendrar. Sagostunder, pyssel, författarkvällar, släktforskning —
 * typiska småorts-event som sällan finns någon annanstans strukturerat.
 *
 * ETT delat, auth-fritt API för alla tenants (recon 2026-06-12, verifierat):
 *   GET https://api.axiell.com/event/api/customers/{customerId}/search
 *     ?queryString=*
 *     &rangeFilters=[{"field":"event.endDate","gte":"<ISO-UTC-nu>"}]
 *     &termFilters=[{"field":"event.status","values":["PUBLISHED"]},
 *                   {"type":"NOT_IN","field":"event.deleted","values":[true]}]
 *     &sorts=[{"field":"event.startDate","order":"ASC"}]
 *     &start=0&size=500
 *
 * En tenant = en kommun ELLER ett helt läns-konsortium (Familjen Helsingborg =
 * 27 bibliotek i 11 kommuner; Bibliotek Värmland = 18 filialer). Filial-namnet
 * ligger i event.location.value. ~250/290 kommuner kör Axiell — seed-listan
 * nedan växer via get-calendar-config-discovery (se registry-notes).
 *
 * Fallgropar: description är HTML (strippas); location.value kan vara null
 * (online-event); API-roten är 401 (ingen tenant-listning) men per-tenant-sök
 * är helt öppet; events saknar publik detalj-URL i API:t → länka till
 * tenantens /evenemang-sida + #uuid.
 */

import { RawEvent, Engine } from '../sources/types';
import { mapPool } from '../utils/mapPool';

const API_BASE = 'https://api.axiell.com/event/api';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_SIZE = 500;
const CONCURRENCY = 4;

export interface AxiellTenant {
    /** Stabil nyckel + del av event-URL:ens fragment */
    id: string;
    customerId: string;
    /** Publika kalendersidan — blir klickbar event-URL (+ #uuid) */
    eventsUrl: string;
    /** Portalnamn för logg + host-fallback */
    name: string;
    /**
     * Stad för geokodning av filialnamn ("Stadsbiblioteket" finns överallt).
     * Utelämnas för läns-konsortier — där är filialnamnen oftast unika nog
     * ("Åstorps bibliotek") och fel stad vore värre än ingen.
     */
    cityHint?: string;
}

/** Verifierade tenants 2026-06-12 (≈1 300 framtida event). Växer via discovery. */
export const AXIELL_TENANTS: AxiellTenant[] = [
    { id: 'uppsala',      customerId: '5de8fb519cf47722f2bb9871', eventsUrl: 'https://bibliotekuppsala.se/evenemang',       name: 'Bibliotek Uppsala',            cityHint: 'Uppsala' },
    { id: 'orebro',       customerId: '671758c4296c3201a2484671', eventsUrl: 'https://bibliotek.orebro.se/evenemang',       name: 'Bibliotek Örebro',             cityHint: 'Örebro' },
    { id: 'gota',         customerId: '62834578bbee2204026d7529', eventsUrl: 'https://www.gotabiblioteken.se/evenemang',    name: 'Götabiblioteken' },
    { id: 'snoka',        customerId: '61516cdee9a84303da337ecb', eventsUrl: 'https://www.snokabibliotek.se/evenemang',     name: 'Snokabiblioteken' },
    { id: 'helsingborg',  customerId: '635903c8703695290b575cd8', eventsUrl: 'https://www.bibliotekfh.se/evenemang',        name: 'Bibliotek Familjen Helsingborg' },
    { id: 'kalmar',       customerId: '5f801bab9cf477217a2912cd', eventsUrl: 'https://bibliotek.kalmar.se/evenemang',       name: 'Biblioteken i Kalmar',         cityHint: 'Kalmar' },
    { id: 'huddinge',     customerId: '5fbfa17e9cf4776ba2b1a711', eventsUrl: 'https://bibliotek.huddinge.se/evenemang',     name: 'Huddinge bibliotek',           cityHint: 'Huddinge' },
    { id: 'varmland',     customerId: '5fda02f69cf4776ba2b1a819', eventsUrl: 'https://www.bibliotekvarmland.se/evenemang',  name: 'Bibliotek Värmland' },
];

interface AxiellHit {
    id: string;
    event?: {
        title?: string;
        description?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
        location?: { value?: string | null };
        images?: Array<{ imageUrl?: string; primaryImage?: boolean }>;
        targetAudiences?: Array<{ value?: string }>;
        deleted?: boolean;
    };
}

/** Strippa HTML till ren text (description är HTML i API:t). */
export function stripHtml(html: string | undefined): string {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Mappa ett Axiell-event → RawEvent. Exporterad för test. */
export function mapAxiellEvent(hit: AxiellHit, tenant: AxiellTenant): RawEvent | null {
    const e = hit.event;
    if (!e || e.deleted || e.status !== 'PUBLISHED') return null;
    const title = (e.title || '').trim();
    if (!title || !e.startDate) return null;
    const startDate = new Date(e.startDate);
    if (isNaN(startDate.getTime())) return null;

    const branch = e.location?.value?.trim() || '';
    const image = (e.images || []).find((i) => i.primaryImage)?.imageUrl || e.images?.[0]?.imageUrl;
    const audiences = (e.targetAudiences || []).map((a) => a.value).filter(Boolean).join(', ');

    return {
        externalId: hit.id,
        title,
        startDate,
        endDate: e.endDate ? new Date(e.endDate) : undefined,
        // API:t saknar publik detalj-URL — kalendersidan + uuid-fragment är
        // klickbar och unik (URL = PRIMARY KEY).
        url: `${tenant.eventsUrl}#${hit.id}`,
        venueName: branch || undefined,
        city: tenant.cityHint,
        imageUrl: image ? image.replace(/^http:\/\//, 'https://') : undefined,
        description: [stripHtml(e.description).slice(0, 600), audiences ? `Målgrupp: ${audiences}.` : '']
            .filter(Boolean).join(' '),
        hostName: branch || tenant.name,
        hasSpecificTime: true,   // API:t levererar riktiga klockslag (UTC)
        geocodeCandidates: [
            branch && tenant.cityHint ? `${branch}, ${tenant.cityHint}` : '',
            branch,
            tenant.cityHint ?? '',
        ].filter(Boolean) as string[],
    };
}

async function fetchTenantEvents(tenant: AxiellTenant, nowIso: string, log: (m: string) => void, signal?: AbortSignal): Promise<RawEvent[]> {
    const events: RawEvent[] = [];
    let start = 0;
    let total = Infinity;
    while (start < total && start < 5000) {
        const params = new URLSearchParams({
            queryString: '*',
            rangeFilters: JSON.stringify([{ field: 'event.endDate', gte: nowIso }]),
            termFilters: JSON.stringify([
                { field: 'event.status', values: ['PUBLISHED'] },
                { type: 'NOT_IN', field: 'event.deleted', values: [true] },
            ]),
            sorts: JSON.stringify([{ field: 'event.startDate', order: 'ASC' }]),
            start: String(start),
            size: String(PAGE_SIZE),
        });
        try {
            const res = await fetch(`${API_BASE}/customers/${tenant.customerId}/search?${params}`, {
                headers: { 'User-Agent': UA, 'Accept': 'application/json' },
                signal: signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { log(`${tenant.id}: HTTP ${res.status}`); break; }
            const data: any = await res.json();
            total = data.totalHits ?? 0;
            const hits: AxiellHit[] = data.hits ?? [];
            if (hits.length === 0) break;
            for (const h of hits) {
                const ev = mapAxiellEvent(h, tenant);
                if (ev) events.push(ev);
            }
            start += hits.length;
        } catch (err) {
            log(`${tenant.id}: ${(err as Error).message}`);
            break;
        }
    }
    return events;
}

export const bibliotekEngine: Engine = async (config, ctx) => {
    let tenants = AXIELL_TENANTS;
    if (config?.tenantIds?.length) {
        tenants = tenants.filter((t) => config.tenantIds.includes(t.id));
    }
    const nowIso = ctx.windowStart.toISOString();

    const perTenant = await mapPool(tenants, CONCURRENCY, async (t) => {
        const evs = await fetchTenantEvents(t, nowIso, ctx.log, ctx.signal);
        ctx.log(`${t.id}: ${evs.length} event`);
        return evs;
    });

    const all = perTenant.flat();
    ctx.log(`${tenants.length} tenants → ${all.length} event totalt`);
    return all;
};
