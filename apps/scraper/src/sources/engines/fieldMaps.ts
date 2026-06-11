/**
 * Default field-maps per engine — DOKUMENTATION, inte runtime.
 *
 * Beskriver var i källans råa svar respektive RawEvent-fält tas ifrån.
 * Används av playbook-generatorn för att kunna förklara för debug-människor
 * "var brukar `startDate` ligga i en wp-v2-respons" utan att de behöver läsa
 * 343 rader engine-kod.
 *
 * Om en specifik källa avviker (t.ex. ACF-fält istället för standard) — sätt
 * `fieldMap` direkt på Source-objektet, så vinner den över denna default.
 */

import type { SourceFieldMap, EngineName } from '../types';

interface VariantMap {
    [variant: string]: SourceFieldMap;
}

/** wp-rest: två varianter — wp-v2 (CPT i WP REST) eller tribe (The Events Calendar) */
const WP_REST_VARIANTS: VariantMap = {
    'wp-v2': {
        title: 'item.title.rendered',
        startDate: 'parsad ur item.content.rendered (svensk datumtext) eller item.acf.start_date',
        endDate: 'parsad ur item.content.rendered eller item.acf.end_date',
        url: 'item.link',
        description: 'item.excerpt.rendered (HTML→text) eller item.content.rendered',
        imageUrl: 'item._embedded["wp:featuredmedia"][0].source_url',
        venueName: 'parsad ur content.rendered, ex. "Plats: X" eller "på X"',
        address: 'parsad ur content.rendered (gatunamn + nr + postnr + stad)',
        city: 'config.defaultCity om inget hittas i content.rendered',
        organizer: 'config.hostName (sajten själv)',
        other: {
            categories: 'item._embedded["wp:term"][0][].name',
            slug: 'item.slug',
        },
    },
    'tribe': {
        title: 'item.title',
        startDate: 'item.start_date (ISO)',
        endDate: 'item.end_date (ISO)',
        url: 'item.url',
        description: 'item.description (HTML→text)',
        imageUrl: 'item.image.url || item.image.sizes.full.url',
        venueName: 'item.venue.venue',
        address: 'item.venue.address + item.venue.city + item.venue.zip',
        city: 'item.venue.city',
        coords: '[item.venue.geo_lat, item.venue.geo_lng]',
        organizer: 'item.organizer[0].organizer',
        other: {
            categories: 'item.categories[].name',
            cost: 'item.cost',
        },
    },
};

const SITEVISION_FIELDS: SourceFieldMap = {
    title: 'eventListing.events[].title  (XHR: /api/event-search eller liknande)',
    startDate: 'eventListing.events[].startDate (ISO eller "YYYY-MM-DD HH:mm")',
    endDate: 'eventListing.events[].endDate',
    url: 'eventListing.events[].url (relativ — joinas med urls[0])',
    description: 'eventListing.events[].description eller .summary',
    imageUrl: 'eventListing.events[].image.url',
    venueName: 'eventListing.events[].location.name',
    address: 'eventListing.events[].location.address',
    city: 'eventListing.events[].location.city || config.defaultCity',
    organizer: 'config.hostName',
    other: {
        engineHint: 'se.soleil.eventListingLocal — SiteVisions standard-modul',
    },
};

const ICAL_FIELDS: SourceFieldMap = {
    title: 'VEVENT.SUMMARY',
    startDate: 'VEVENT.DTSTART',
    endDate: 'VEVENT.DTEND',
    url: 'VEVENT.URL eller VEVENT.UID-länkad sida',
    description: 'VEVENT.DESCRIPTION',
    venueName: 'VEVENT.LOCATION (första delen, före komma)',
    address: 'VEVENT.LOCATION (hela strängen)',
    city: 'config.defaultCity om inget i LOCATION',
    coords: 'VEVENT.GEO',
    organizer: 'VEVENT.ORGANIZER eller config.hostName',
};

const JSON_LD_FIELDS: SourceFieldMap = {
    title: 'JSON-LD Event.name',
    startDate: 'JSON-LD Event.startDate',
    endDate: 'JSON-LD Event.endDate',
    url: 'JSON-LD Event.url eller dokumentets canonical URL',
    description: 'JSON-LD Event.description',
    imageUrl: 'JSON-LD Event.image (string eller array)',
    venueName: 'JSON-LD Event.location.name',
    address: 'JSON-LD Event.location.address (streetAddress + postalCode + addressLocality)',
    city: 'JSON-LD Event.location.address.addressLocality',
    coords: '[Event.location.geo.latitude, Event.location.geo.longitude]',
    organizer: 'JSON-LD Event.organizer.name',
};

const NEXTJS_DATA_FIELDS: SourceFieldMap = {
    title: '__NEXT_DATA__.props.pageProps.<...>.title (path varierar per sajt)',
    startDate: '__NEXT_DATA__.props.pageProps.<...>.startDate (eller .date / .start)',
    endDate: '__NEXT_DATA__.props.pageProps.<...>.endDate',
    url: 'relativ slug joinat med config.urls[0]',
    description: '__NEXT_DATA__.props.pageProps.<...>.description',
    imageUrl: '__NEXT_DATA__.props.pageProps.<...>.image.url',
    venueName: '__NEXT_DATA__.props.pageProps.<...>.location.name',
    city: '__NEXT_DATA__.props.pageProps.<...>.location.city || config.defaultCity',
    other: {
        engineHint: 'Sök igenom __NEXT_DATA__ rekursivt efter array med {title, startDate}',
    },
};

const NUXT_DATA_FIELDS: SourceFieldMap = {
    title: 'window.__NUXT__.data.<...>.title',
    startDate: 'window.__NUXT__.data.<...>.startDate || .startsAt',
    endDate: 'window.__NUXT__.data.<...>.endDate || .endsAt',
    url: 'relativ slug joinat med config.urls[0]',
    description: 'window.__NUXT__.data.<...>.description || .body',
    imageUrl: 'window.__NUXT__.data.<...>.image || .heroImage',
    venueName: 'window.__NUXT__.data.<...>.venue.name',
    city: 'window.__NUXT__.data.<...>.venue.city || config.defaultCity',
    other: {
        engineHint: 'Sök igenom __NUXT__ rekursivt efter array med event-liknande objekt',
    },
};

const XHR_FIELDS: SourceFieldMap = {
    title: 'beroende på upptäckt endpoint — se discovery.notes',
    startDate: 'beroende på upptäckt endpoint',
    other: {
        engineHint: 'XHR-discovery upptäcker endpoint vid runtime — fieldMap fylls per source',
    },
};

const API_FIELDS: SourceFieldMap = {
    other: {
        engineHint: 'Egen API-engine — fieldMap definieras per source.',
    },
};

/**
 * drupal — två varianter:
 *   - jsonapi:      Drupal JSON:API (/jsonapi/node/<type>) — vanligast på Drupal 9/10
 *   - rest-format:  Drupal REST + ?_format=json på en views-sida
 */
const DRUPAL_VARIANTS: VariantMap = {
    'jsonapi': {
        title: 'data[].attributes.title',
        startDate: 'data[].attributes.field_event_date.value (eller field_start_date)',
        endDate: 'data[].attributes.field_event_date.end_value (eller field_end_date)',
        url: 'joinad från data[].attributes.path.alias + config.baseUrl',
        description: 'data[].attributes.body.processed (HTML→text)',
        imageUrl: 'data[].relationships.field_image.data → resolva via /jsonapi/file/file/<uuid>',
        venueName: 'data[].attributes.field_location.value (varierar per sajt)',
        address: 'data[].attributes.field_address (kan vara structured eller text)',
        city: 'config.defaultCity (Drupal har sällan stad som separat fält)',
        organizer: 'config.hostName',
        other: {
            uuid: 'data[].id',
            type: 'data[].type (= "node--event" etc)',
            engineHint: 'Drupal JSON:API — fältnamn (field_*) varierar per sajt-konfig.',
        },
    },
    'rest-format': {
        title: 'item.title (string eller [{value}])',
        startDate: 'item.field_event_date[0].value eller item.field_start_date[0].value',
        endDate: 'item.field_event_date[0].end_value eller item.field_end_date[0].value',
        url: 'item.path.alias eller item.url',
        description: 'item.body[0].processed eller .value',
        imageUrl: 'item.field_image[0].url',
        venueName: 'item.field_location[0].value',
        city: 'config.defaultCity',
        organizer: 'config.hostName',
        other: {
            engineHint: 'Drupal REST + ?_format=json — fältnamn varierar per sajt.',
        },
    },
};

/**
 * sitemap — discovery via /sitemap.xml. URL:erna följs och JSON-LD
 * (Schema.org Event) eller cheerio används för att extrahera fälten.
 */
const SITEMAP_FIELDS: SourceFieldMap = {
    title: 'detalj-sidans <h1> eller JSON-LD Event.name',
    startDate: 'JSON-LD Event.startDate eller microdata itemprop="startDate"',
    endDate: 'JSON-LD Event.endDate',
    url: 'sitemap.xml <loc>',
    description: 'JSON-LD Event.description eller <meta name="description">',
    imageUrl: 'JSON-LD Event.image eller <meta property="og:image">',
    venueName: 'JSON-LD Event.location.name eller fritext-parsing',
    address: 'JSON-LD Event.location.address',
    city: 'JSON-LD Event.location.address.addressLocality eller config.defaultCity',
    coords: '[Event.location.geo.latitude, Event.location.geo.longitude]',
    organizer: 'JSON-LD Event.organizer.name eller config.hostName',
    other: {
        engineHint: 'Generisk sitemap-driven scraper — funkar oavsett CMS.',
        urlPatterns: 'config.urlPatterns = lista av regex som matchar event-URLs i sitemap',
    },
};

/**
 * Hämta default-fältmappning för en engine. Variant används bara för wp-rest.
 */
export function defaultFieldMap(engine: EngineName, variant?: string): SourceFieldMap {
    switch (engine) {
        case 'wp-rest':
            return WP_REST_VARIANTS[variant || 'wp-v2'] || WP_REST_VARIANTS['wp-v2'];
        case 'sitevision':
            return SITEVISION_FIELDS;
        case 'ical':
            return ICAL_FIELDS;
        case 'json-ld':
            return JSON_LD_FIELDS;
        case 'nextjs-data':
            return NEXTJS_DATA_FIELDS;
        case 'nuxt-data':
            return NUXT_DATA_FIELDS;
        case 'xhr-discovery':
            return XHR_FIELDS;
        case 'api':
            return API_FIELDS;
        case 'drupal':
            return DRUPAL_VARIANTS[variant || 'jsonapi'] || DRUPAL_VARIANTS['jsonapi'];
        case 'sitemap':
            return SITEMAP_FIELDS;
        default:
            // Nätverks-engines (hembygd, svenskakyrkan, …) — mappningen
            // dokumenteras i respektive engine-fils header istället.
            return API_FIELDS;
    }
}

/**
 * Föreslår ett kommando för att probe-om en källa.
 */
export function rediscoverCommand(engine: EngineName, region: string): string {
    switch (engine) {
        case 'wp-rest':
            return `npm run probe-wp -- --only=${region}`;
        case 'sitevision':
            return `npm run probe-sitevision -- --only=${region}`;
        case 'ical':
            return `npm run probe-ical -- --only=${region}`;
        case 'json-ld':
            return `npx ts-node src/scripts/probe-jsonld.ts --only=${region}`;
        case 'nextjs-data':
        case 'nuxt-data':
        case 'xhr-discovery':
            return `npx ts-node src/scripts/probe-xhr.ts --only=${region}`;
        case 'api':
            return `# Egen API — re-discovery sker manuellt`;
        case 'drupal':
            return `npm run probe-drupal -- --filter=${region}`;
        case 'sitemap':
            return `npm run probe-sitemap -- --filter=${region}`;
        default:
            // Nätverks-engines — endpoint + rediscovery-steg står i engine-filens header.
            return `# Nätverks-engine — se header i src/scrapers/ för endpoint & rediscovery`;
    }
}
