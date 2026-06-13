/**
 * Sources-arkitekturen — kontrakt
 *
 * En **Source** är en deklarativ beskrivning av en eventkälla (en sajt, ett API).
 * En **Engine** är en återanvändbar funktion som extraherar `RawEvent[]` ur en sådan källa.
 *
 * Tanken: Istället för en handskriven scraper per sajt (~300 rader styck) beskriver
 * vi källan i ~10 rader config och lämnar tunga lyftet (HTML/JSON-parsing) till motorn.
 */

/**
 * Minimum-formatet som varje engine måste producera. Runnern tar hand om
 * geocoding, kategorisering, bild-fallback och DB-skrivning.
 */
export interface RawEvent {
    /** Stabil ID från källan, om finns (för dedup mellan körningar) */
    externalId?: string;
    title: string;
    /** ISO-string ok — runnern konverterar */
    startDate: Date;
    endDate?: Date;
    /** Publika eventsidan/biljettsidan */
    url: string;

    venueName?: string;
    city?: string;
    address?: string;
    /** Om källan levererar färdiga koordinater (t.ex. JSON-LD med geo) */
    coords?: [number, number];
    /**
     * Ordnade geocoding-frågor som runnern provar i tur och ordning (första träff
     * vinner) när coords saknas. Utelämnad → runnern frågar "venueName, city".
     * För paraply-källor med fallback-kedjor (kyrkonamn → församling → ortnamn).
     */
    geocodeCandidates?: string[];

    description?: string;
    imageUrl?: string;
    organizer?: string;
    /** Kategori om källan vet (annars klassificerar runnern via title+desc) */
    category?: string;
    price?: string;
    /**
     * Per-event-värd för paraply-källor (församling, klubb, lokalkrets).
     * Utelämnad → source.hostName används.
     */
    hostName?: string;
    /**
     * Sätt när källan VET om tiden är specifik (t.ex. isFullDayEvent-fält).
     * Utelämnad → runnern använder midnatts-heuristiken (00:00 lokal/UTC = heldag).
     */
    hasSpecificTime?: boolean;
}

/**
 * Hur källan upptäcktes — för felsökning och re-discovery när sajten ändras.
 *
 * VIKTIGT: Vi sparar detta för att framtida-vi (eller framtida-Claude) snabbt
 * ska kunna upprepa det probe-anrop som ursprungligen hittade endpointen,
 * och därigenom kunna jämföra "vad ändrades" om scrapern slutar fungera.
 */
export interface SourceDiscovery {
    /**
     * Vilket probe-script eller manuell process hittade källan.
     *   - 'probe-wp'         — automatisk WordPress REST-probe
     *   - 'probe-sitevision' — automatisk SiteVision-probe
     *   - 'probe-ical'       — automatisk iCal-feed-probe
     *   - 'probe-jsonld'     — automatisk JSON-LD-probe
     *   - 'probe-xhr'        — automatisk Next.js/Nuxt XHR-discovery
     *   - 'manual'           — handgrävt av människa
     *   - 'hint'             — tipsad av annan källa (länkad från annan kommun etc)
     */
    method: 'probe-wp' | 'probe-sitevision' | 'probe-ical' | 'probe-jsonld' | 'probe-xhr' | 'probe-sitemap' | 'probe-drupal' | 'manual' | 'hint';
    /** Exakt URL som probaren träffade och som returnerade hit-svaret */
    probeUrl: string;
    /** ISO-datum (YYYY-MM-DD) när källan upptäcktes */
    date: string;
    /** Antal events som probet rapporterade vid upptäckt */
    rawEventCount?: number;
    /** Kommando för att köra om probet manuellt (för debug) */
    rediscoverCommand?: string;
    /** Fri anteckning om upptäckten — vad gjorde att probet hittade det här? */
    notes?: string;
}

/**
 * Mappning från källans råa fält → vårt RawEvent-format. Dokumenterar
 * "var hittar jag titel/datum/plats i den här källan". Används vid felsökning
 * när ett fält slutar fyllas i (har källan döpt om sina nycklar?).
 *
 * Värdena är JSON-path-liknande strängar, ex: `"d.startDate"`, `"acf.event_start"`.
 * De är BARA dokumentation — runtime-mappningen sker i engines.
 */
export interface SourceFieldMap {
    title?: string;
    startDate?: string;
    endDate?: string;
    url?: string;
    venueName?: string;
    address?: string;
    city?: string;
    description?: string;
    imageUrl?: string;
    organizer?: string;
    coords?: string;
    /** Övriga fält som är värda att dokumentera */
    other?: Record<string, string>;
}

/**
 * Deklarativ beskrivning av en eventkälla.
 */
export interface Source {
    /** Stabil identifierare: 'visit-stockholm', 'vaxjo-kommun' */
    id: string;
    /** Visas i UI som "Värd": 'Visit Stockholm', 'Växjö Kommun' */
    hostName: string;
    /** Geografisk region (kommunkod, län, eller 'national') — för täcknings-analys */
    region?: string;
    /** Vilken engine som driver källan */
    engine: EngineName;
    /** Engine-specifik konfig */
    config: Record<string, any>;
    /** Hur många dagar framåt vi hämtar (default: SCRAPE_WINDOW_DAYS env / 30) */
    windowDays?: number;
    /**
     * Hur ofta källan behöver scrapas. Används av schemaläggaren för att
     * sprida ut körningar — small kommun-sajter behöver inte köras dagligen.
     * Källor med kadens > 1 dag fas-sprids per natt via hash(id) i schedule.ts.
     *   - 'hourly'      — högfrekventa (Facebook, Tickster)
     *   - 'daily'       — default, för stora ticketing-platforms
     *   - 'every-3d'    — kommunsajter, måttligt uppdaterade
     *   - 'weekly'      — sällan uppdaterade, små kommuner / turism
     *   - 'biweekly'    — långhorisont-venues (operahus/konserthus som
     *                     publicerar hela säsonger månader i förväg)
     */
    updateFrequency?: 'hourly' | 'daily' | 'every-3d' | 'weekly' | 'biweekly';
    /** Engångskoll-flagga: hoppa över denna källa */
    disabled?: boolean;
    /**
     * Medveten livscykel-status (satt av människa, inte av körhistorik).
     * Styr schemaläggning OCH dokumenterar vad vi vet om källan.
     *   - 'active'        — fungerar, i rotation (default om utelämnad)
     *   - 'experimental'  — tillagd men underpresterar; värd att utveckla
     *                       vidare (fel mönster, behöver overlap-fönster,
     *                       säsong/sommaruppehåll). Körs fortfarande, men
     *                       sätt gärna 'weekly' så den inte hamrar i onödan.
     *   - 'dead'          — bevisat utan användbara events (stale sitemap,
     *                       landningssidor, fel CMS). Hoppas över av både
     *                       schemaläggare och runner — så vi inte slösar tid
     *                       på att proba om den. Skriv ALLTID `notes` med
     *                       varför + `lastVerified` med när vi konstaterade det.
     */
    status?: 'active' | 'experimental' | 'dead';
    /** Fri anteckning till oss själva */
    notes?: string;
    /**
     * ─── PROVENANCE ──────────────────────────────────────────────────────
     * Allt här under är dokumentation för att kunna felsöka och återupptäcka
     * källan när sajten ändras. Inget av det används vid runtime.
     */
    /** Hur källan upptäcktes och hur man kör om probet */
    discovery?: SourceDiscovery;
    /** Var i källans struktur respektive RawEvent-fält kommer ifrån */
    fieldMap?: SourceFieldMap;
    /** En känd-bra event-URL för regressions-test */
    sampleEventUrl?: string;
    /** Tröskel för larm — sjunker antalet under detta kan något vara trasigt */
    expectedMinEvents?: number;
    /**
     * Volym-säkring: max sparade event per körning (default 3000 i runnern).
     * En källa som plötsligt levererar mångdubbelt stannar vid taket med fel
     * i run-historiken istället för att dränka databasen (SvK-floden 2026-06-11).
     */
    maxSavedPerRun?: number;
    /** ISO-datum (YYYY-MM-DD) när källan senast bevisat fungerade i prod */
    lastVerified?: string;
    /** Kända fallgropar — pagination, login, rate limits, malformed JSON etc. */
    troubleshooting?: string[];
}

export type EngineName =
    | 'json-ld' | 'wp-rest' | 'ical' | 'api' | 'sitevision' | 'xhr-discovery'
    | 'nextjs-data' | 'nuxt-data' | 'drupal' | 'sitemap'
    // Nätverks-engines: en per paraply-API (hela nätverket = EN källa i registryt)
    | 'hembygd' | 'svenskakyrkan' | 'naturskyddsforeningen' | 'rotary' | 'rodakorset'
    | 'friluftsframjandet' | 'pro' | 'korpen' | 'riksteatern' | 'bibliotek' | 'raceid'
    | 'bilda' | 'medborgarskolan' | 'abf';

/**
 * Skickas in i engine vid körning — tid, loggning, fetch.
 */
export interface EngineContext {
    /** Inklusive dagens datum, kl 00:00 lokalt */
    windowStart: Date;
    /** Exklusive — windowDays dagar framåt */
    windowEnd: Date;
    log: (msg: string) => void;
    /** Avbryt om den här tickar — för timeouts */
    signal?: AbortSignal;
    /**
     * Finns URL:en redan i DB? Låter engines hoppa över dyra per-event-hämtningar
     * (detail-sidor, content-API-anrop) för event vi redan har. Dedup sker ändå
     * alltid i runnern — detta är enbart en kostnadsoptimering.
     */
    isKnownUrl?: (url: string) => Promise<boolean>;
    /**
     * Full-refresh-körning: motorn ska IGNORERA isKnownUrl-optimeringen och
     * hämta även kända URL:er, så ändrade/flyttade event upptäcks. Sätts av
     * runnern var 4:e körning per källa (se schedule.isRefreshRun).
     */
    refreshKnown?: boolean;
}

/**
 * Signaturen för en engine. Den får sin egen config + kontext och
 * returnerar ofiltrerade RawEvents — datumfilter, dedup etc gör runnern.
 */
export type Engine = (config: any, ctx: EngineContext) => Promise<RawEvent[]>;

/**
 * Resultat efter att runnern processat en källa — för observability.
 */
export interface SourceRunResult {
    sourceId: string;
    durationMs: number;
    found: number;          // hur många RawEvents engine returnerade
    saved: number;          // hur många som faktiskt skrevs till DB
    /** Kända event vars tid uppdaterades vid full-refresh (flyttat datum / nytt klockslag) */
    updated: number;
    skipped: {
        duplicate: number;
        outsideWindow: number;
        invalid: number;
    };
    errors: string[];
    /** Antal events som skickades till LLM-audit (0 om AUDIT_ENABLED=false) */
    audited: number;
    /** Antal events som auto-doldes pga verdict=junk + confidence=high */
    autoHidden: number;
}
