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

/** Verifierade tenants: 8 st 2026-06-12 + 30 st 2026-07-02 (≈4 000 framtida event). Växer via discovery. */
export const AXIELL_TENANTS: AxiellTenant[] = [
    { id: 'uppsala',      customerId: '5de8fb519cf47722f2bb9871', eventsUrl: 'https://bibliotekuppsala.se/evenemang',       name: 'Bibliotek Uppsala',            cityHint: 'Uppsala' },
    { id: 'orebro',       customerId: '671758c4296c3201a2484671', eventsUrl: 'https://bibliotek.orebro.se/evenemang',       name: 'Bibliotek Örebro',             cityHint: 'Örebro' },
    { id: 'gota',         customerId: '62834578bbee2204026d7529', eventsUrl: 'https://www.gotabiblioteken.se/evenemang',    name: 'Götabiblioteken' },
    { id: 'snoka',        customerId: '61516cdee9a84303da337ecb', eventsUrl: 'https://www.snokabibliotek.se/evenemang',     name: 'Snokabiblioteken' },
    { id: 'helsingborg',  customerId: '635903c8703695290b575cd8', eventsUrl: 'https://www.bibliotekfh.se/evenemang',        name: 'Bibliotek Familjen Helsingborg' },
    { id: 'kalmar',       customerId: '5f801bab9cf477217a2912cd', eventsUrl: 'https://bibliotek.kalmar.se/evenemang',       name: 'Biblioteken i Kalmar',         cityHint: 'Kalmar' },
    { id: 'huddinge',     customerId: '5fbfa17e9cf4776ba2b1a711', eventsUrl: 'https://bibliotek.huddinge.se/evenemang',     name: 'Huddinge bibliotek',           cityHint: 'Huddinge' },
    { id: 'varmland',     customerId: '5fda02f69cf4776ba2b1a819', eventsUrl: 'https://www.bibliotekvarmland.se/evenemang',  name: 'Bibliotek Värmland' },

    // ── Discovery-runda 2026-07-02 (≈1 900 framtida event till) ──────────────
    // customerId fångad ur browserns api.axiell.com-anrop (config-endpointen är
    // numera 403; se scratchpad/axiell-puppeteer-discover.cjs). cityHint utelämnad
    // för läns-/regionkonsortier (Umeåregionen) — filialnamnet bär orten då.
    { id: 'jonkoping',     customerId: '6489becd8094f362d53890d9', eventsUrl: 'https://bibliotek.jonkoping.se/evenemang',    name: 'Biblioteken i Jönköping',      cityHint: 'Jönköping' },
    { id: 'umea',          customerId: '67efbbec296c3258c8eaf816', eventsUrl: 'https://www.minabibliotek.se/evenemang',      name: 'Umeåregionens bibliotek' },
    { id: 'vaxjo',         customerId: '62418559ae077e04267beb89', eventsUrl: 'https://bibliotek.vaxjo.se/evenemang',        name: 'Biblioteken i Växjö',          cityHint: 'Växjö' },
    { id: 'sundsvall',     customerId: '5dceb8c39cf47722f2bb983a', eventsUrl: 'https://bibliotek.sundsvall.se/evenemang',    name: 'Sundsvalls bibliotek',         cityHint: 'Sundsvall' },
    { id: 'molndal',       customerId: '6638d1d9f9286e318ed74d05', eventsUrl: 'https://bibliotek.molndal.se/evenemang',      name: 'Mölndals bibliotek',           cityHint: 'Mölndal' },
    { id: 'lidingo',       customerId: '68b69024a2fccd7fbf6612a8', eventsUrl: 'https://bibliotek.lidingo.se/evenemang',      name: 'Lidingö bibliotek',            cityHint: 'Lidingö' },
    { id: 'solna',         customerId: '6149c6bce9a84303da337dbc', eventsUrl: 'https://bibliotek.solna.se/evenemang',        name: 'Solna bibliotek',              cityHint: 'Solna' },
    { id: 'jarfalla',      customerId: '63f5de79ca75745f4f4e22e3', eventsUrl: 'https://bibliotek.jarfalla.se/evenemang',     name: 'Järfälla bibliotek',           cityHint: 'Järfälla' },
    { id: 'botkyrka',      customerId: '62aae50fbbee2204026d77fc', eventsUrl: 'https://bibliotek.botkyrka.se/evenemang',     name: 'Botkyrka bibliotek',           cityHint: 'Botkyrka' },
    { id: 'haninge',       customerId: '65c5fc645e592b04e0b56544', eventsUrl: 'https://bibliotek.haninge.se/evenemang',      name: 'Haninge bibliotek',            cityHint: 'Haninge' },
    { id: 'norrtalje',     customerId: '5dceb8969cf47722f2bb9839', eventsUrl: 'https://bibliotek.norrtalje.se/evenemang',    name: 'Norrtälje bibliotek',          cityHint: 'Norrtälje' },
    { id: 'taby',          customerId: '612de570a5a63e0394389918', eventsUrl: 'https://bibliotek.taby.se/evenemang',         name: 'Täby bibliotek',               cityHint: 'Täby' },
    { id: 'tyreso',        customerId: '66cd7c2af9286e318ed75a97', eventsUrl: 'https://bibliotek.tyreso.se/evenemang',       name: 'Tyresö bibliotek',             cityHint: 'Tyresö' },
    { id: 'osteraker',     customerId: '61939a5de9a84303da338712', eventsUrl: 'https://bibliotek.osteraker.se/evenemang',    name: 'Österåkers bibliotek',         cityHint: 'Åkersberga' },
    { id: 'upplandsvasby', customerId: '672b50ac296c3201a2484d32', eventsUrl: 'https://bibliotek.upplandsvasby.se/evenemang', name: 'Väsby bibliotek',             cityHint: 'Upplands Väsby' },
    { id: 'sigtuna',       customerId: '692948d5cdc95c5435968696', eventsUrl: 'https://bibliotek.sigtuna.se/evenemang',      name: 'Sigtuna bibliotek',            cityHint: 'Sigtuna' },
    { id: 'nykoping',      customerId: '67bc4753296c3258c8eae737', eventsUrl: 'https://bibliotek.nykoping.se/evenemang',     name: 'Nyköpings bibliotek',          cityHint: 'Nyköping' },
    { id: 'kungsbacka',    customerId: '5fc0e7799cf4776ba2b1a71f', eventsUrl: 'https://bibliotek.kungsbacka.se/evenemang',   name: 'Kungsbacka bibliotek',         cityHint: 'Kungsbacka' },
    { id: 'salem',         customerId: '63737c9f71432976b7d81926', eventsUrl: 'https://bibliotek.salem.se/evenemang',        name: 'Salems bibliotek',             cityHint: 'Salem' },
    { id: 'ekero',         customerId: '66d6d049f9286e318ed75da9', eventsUrl: 'https://bibliotek.ekero.se/evenemang',        name: 'Ekerö bibliotek',              cityHint: 'Ekerö' },
    { id: 'katrineholm',   customerId: '675c2772296c323bdabd9479', eventsUrl: 'https://bibliotek.katrineholm.se/evenemang',  name: 'Katrineholms bibliotek',       cityHint: 'Katrineholm' },
    { id: 'nykvarn',       customerId: '68e4dd92a2fccd7fbf6623f3', eventsUrl: 'https://bibliotek.nykvarn.se/evenemang',      name: 'Nykvarns bibliotek',           cityHint: 'Nykvarn' },

    // ── Discovery-runda 2 samma dag, ur axiell.com/se/bibliotek-med-arena-nova/ ──
    // Fyrstad (Trollhättan/Uddevalla/Vänersborg/Lysekil) och Dalsland är
    // konsortier → ingen cityHint, filialnamnet bär orten.
    { id: 'fyrstad',       customerId: '6392e838d76e6e2eb0e75894', eventsUrl: 'https://bibliotekenifyrstad.se/evenemang',    name: 'Biblioteken i Fyrstad' },
    { id: 'varnamo',       customerId: '5ed608059cf47776dc7b115a', eventsUrl: 'https://bibliotek.varnamo.se/evenemang',     name: 'Värnamo bibliotek',            cityHint: 'Värnamo' },
    { id: 'kavlinge',      customerId: '613b2517e9a84303da337bf1', eventsUrl: 'https://bibliotek.kavlinge.se/evenemang',    name: 'Kävlinge bibliotek',           cityHint: 'Kävlinge' },
    { id: 'laholm',        customerId: '639059cfd76e6e2eb0e75860', eventsUrl: 'https://bibliotek.laholm.se/evenemang',      name: 'Laholms bibliotek',            cityHint: 'Laholm' },
    { id: 'harnosand',     customerId: '5e37d5ab9cf47722f2bb98aa', eventsUrl: 'https://bibliotek.harnosand.se/evenemang',   name: 'Härnösands bibliotek',         cityHint: 'Härnösand' },
    { id: 'dalsland',      customerId: '5dceb9039cf47722f2bb983c', eventsUrl: 'https://bibliotekdalsland.se/evenemang',     name: 'Dalslands bibliotek' },
    { id: 'gislaved',      customerId: '5e25b56b9cf47722f2bb9889', eventsUrl: 'https://bibliotek.gislaved.se/evenemang',    name: 'Gislaveds bibliotek',          cityHint: 'Gislaved' },
    { id: 'gnesta',        customerId: '5fbfa0e49cf4776ba2b1a710', eventsUrl: 'https://bibliotek.gnesta.se/evenemang',      name: 'Gnesta bibliotek',             cityHint: 'Gnesta' },
    // Runda 3 (2026-07-03): Skellefteå hade 0 event vid proben (sommardvala) —
    // giltig tenant, fylls på till hösten.
    { id: 'ornskoldsvik',  customerId: '60af2bf84cfcfc2892c16572', eventsUrl: 'https://bibliotek.ornskoldsvik.se/evenemang', name: 'Örnsköldsviks bibliotek',     cityHint: 'Örnsköldsvik' },
    { id: 'gnosjo',        customerId: '615c380fe9a84303da33805a', eventsUrl: 'https://bibliotek.gnosjo.se/evenemang',      name: 'Gnosjö bibliotek',             cityHint: 'Gnosjö' },
    { id: 'skelleftea',    customerId: '6087d3134cfcfc2892c15af1', eventsUrl: 'https://bibliotek.skelleftea.se/evenemang',  name: 'Skellefteå bibliotek',         cityHint: 'Skellefteå' },
    // V8 = åtta inlandskommuner i Västerbotten (Lycksele/Storuman/Vilhelmina m.fl.) — konsortium, filialen bär orten.
    { id: 'v8',            customerId: '68f0ea72cdc95c54359674f8', eventsUrl: 'https://v8biblioteken.se/evenemang',         name: 'V8-biblioteken' },
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
