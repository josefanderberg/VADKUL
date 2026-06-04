/**
 * Source-registry — deklarativ lista över alla eventkällor.
 *
 * ─── PROBE-RESULTAT 2026-06-01 ────────────────────────────────────────────
 * 58 kommuner probade. 7 träffar — men VIKTIG SKILLNAD MELLAN varianter:
 *
 *   ✅ Tribe (The Events Calendar): har start_date/end_date som riktiga
 *      event-datum. Användbar direkt.
 *
 *   ❌ wp/v2/event (eller /evenemang): exponerar bara WP:s publication date,
 *      INTE event-startdatum. Datum ligger i fritext i content.rendered eller
 *      i ACF-fält som inte är publika i REST. Kräver html-cheerio på
 *      detaljsidan ELLER content.rendered-parsing innan den är användbar.
 *
 * Aktiverade (Tribe):       1 källa,   ~48 events
 * Avstängda (wp/v2):        6 källor, ~1864 events — väntar på datum-extraktor
 * ─────────────────────────────────────────────────────────────────────────
 */

import { Source } from './types';

export const SOURCES: Source[] = [
    // ─── WP-REST KOMMUNER (auto-upptäckta via probe-wp) ──────────────────────

    {
        id: 'uppsala',
        hostName: 'Destination Uppsala',
        region: 'uppsala',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.destinationuppsala.se',
            variant: 'wp-v2',
            defaultCity: 'Uppsala',
            fetchDetailPage: true,
            maxPages: 6,  // 300 events max — annars tar fetch-loopen 30+ min
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 1217 events totalt. fetchDetailPage cap=300 för rimlig körtid.',
    },
    {
        id: 'helsingborg',
        hostName: 'Helsingborgs Stad',
        region: 'helsingborg',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.helsingborg.se',
            variant: 'wp-v2',
            defaultCity: 'Helsingborg',
        },
        updateFrequency: 'daily',
        notes: 'Probe 2026-06: 369 events. wp/v2 + content-parser + _embed (image + terms).',
    },
    {
        id: 'ostersund',
        hostName: 'Visit Östersund',
        region: 'ostersund',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.visitostersund.se',
            variant: 'wp-v2',
            endpoint: '/wp-json/wp/v2/evenemang',
            defaultCity: 'Östersund',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 226 events. Svensk CPT + content-parser.',
    },
    {
        id: 'bastad',
        hostName: 'Båstad',
        region: 'bastad',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.bastad.com',
            variant: 'tribe',
        },
        updateFrequency: 'daily',
        notes: 'Probe 2026-06: 48 events. The Events Calendar (Tribe).',
    },
    {
        id: 'trelleborg',
        hostName: 'Trelleborgs Kommun',
        region: 'trelleborg',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.trelleborg.se',
            variant: 'wp-v2',
            defaultCity: 'Trelleborg',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 33 events. wp/v2 + content-parser.',
    },
    {
        id: 'lidingo',
        hostName: 'Lidingö Stad',
        region: 'lidingo',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.lidingo.se',
            variant: 'wp-v2',
            endpoint: '/wp-json/wp/v2/evenemang',
            defaultCity: 'Lidingö',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 18 events. Svensk CPT + content-parser.',
    },
    {
        id: 'orebro',
        hostName: 'Visit Örebro',
        region: 'orebro',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.visitorebro.se',
            variant: 'wp-v2',
            defaultCity: 'Örebro',
        },
        updateFrequency: 'weekly',
        notes: 'Probe 2026-06: 1 event. wp/v2 + content-parser.',
    },

    // ─── ADDITIONAL FROM 290-KOMMUN PROBE (2026-06-02) ───────────────────────

    {
        id: 'eslov',
        hostName: 'Eslövs Kommun',
        region: 'eslov',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.eslov.se',
            variant: 'wp-v2',
            defaultCity: 'Eslöv',
            fetchDetailPage: true,
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 141 events. fetchDetailPage extraherar datum från HTML.',
    },
    {
        id: 'alingsas',
        hostName: 'Alingsås Kommun',
        region: 'alingsas',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.alingsas.se',
            variant: 'wp-v2',
            defaultCity: 'Alingsås',
            fetchDetailPage: true,
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 108 events. fetchDetailPage.',
    },
    {
        id: 'tranas',
        hostName: 'Tranås Kommun',
        region: 'tranas',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.tranas.se',
            variant: 'wp-v2',
            defaultCity: 'Tranås',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 53 events.',
    },
    {
        id: 'norsjo',
        hostName: 'Norsjö Kommun',
        region: 'norsjo',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.norsjo.se',
            variant: 'tribe',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 47 events. The Events Calendar (Tribe) — guld!',
    },
    {
        id: 'hoor',
        hostName: 'Höörs Kommun',
        region: 'hoor',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.hoor.se',
            variant: 'wp-v2',
            defaultCity: 'Höör',
            fetchDetailPage: true,
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 23 events. fetchDetailPage.',
    },
    {
        id: 'horby',
        hostName: 'Hörby Kommun',
        region: 'horby',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.horby.se',
            variant: 'wp-v2',
            defaultCity: 'Hörby',
            fetchDetailPage: true,
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 21 events. fetchDetailPage.',
    },
    {
        id: 'tingsryd',
        hostName: 'Tingsryds Kommun',
        region: 'tingsryd',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.tingsryd.se',
            variant: 'wp-v2',
            defaultCity: 'Tingsryd',
            fetchDetailPage: true,
        },
        updateFrequency: 'every-3d',
        notes: 'Probe 2026-06: 15 events. fetchDetailPage.',
    },
    {
        id: 'sater',
        hostName: 'Säters Kommun',
        region: 'sater',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.sater.se',
            variant: 'wp-v2',
            defaultCity: 'Säter',
            fetchDetailPage: true,
        },
        updateFrequency: 'weekly',
        notes: 'Probe 2026-06: 5 events. fetchDetailPage.',
    },
    // ─── NEXT.JS-DATA KÄLLOR (storstäderna är Next.js SSR) ───────────────────

    {
        id: 'visit-stockholm',
        hostName: 'Visit Stockholm',
        region: 'stockholm',
        engine: 'nextjs-data',
        config: {
            urls: ['https://www.visitstockholm.com/events/'],
            defaultCity: 'Stockholm',
        },
        updateFrequency: 'daily',
        notes: 'Next.js __NEXT_DATA__ extraction — events i contentBlocks[].value.items.',
    },

    {
        id: 'goteborg-co',
        hostName: 'Göteborg & Co',
        region: 'goteborg',
        engine: 'nuxt-data',
        config: {
            urls: ['https://www.goteborg.com/en/events'],
            defaultCity: 'Göteborg',
        },
        updateFrequency: 'daily',
        notes: 'Nuxt 3 __NUXT_DATA__ (devalue-format) dereferensering.',
    },

    // ─── SITEVISION KÄLLOR (svenska kommun-CMS) ──────────────────────────────

    {
        id: 'malmo',
        hostName: 'Malmö Stad',
        region: 'malmo',
        engine: 'sitevision',
        config: {
            urls: ['https://malmo.se/evenemangskalender'],
            defaultCity: 'Malmö',
        },
        updateFrequency: 'daily',
        notes: 'SiteVision se.soleil.eventListingLocal.',
    },

    // SiteVision-källor från probe 2026-06-02 (31 träffar utöver Malmö, ~836 events totalt)
    {
        id: 'nykvarn',
        hostName: 'Nykvarn Kommun',
        region: 'nykvarn',
        engine: 'sitevision',
        config: { urls: ['https://www.nykvarn.se/uppleva-och-gora/evenemang'], defaultCity: 'Nykvarn' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'sigtuna',
        hostName: 'Sigtuna Kommun',
        region: 'sigtuna',
        engine: 'sitevision',
        config: { urls: ['https://www.sigtuna.se/evenemang'], defaultCity: 'Sigtuna' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'sundbyberg',
        hostName: 'Sundbyberg Kommun',
        region: 'sundbyberg',
        engine: 'sitevision',
        config: { urls: ['https://www.sundbyberg.se/uppleva-och-gora/evenemang'], defaultCity: 'Sundbyberg' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'taby',
        hostName: 'Täby Kommun',
        region: 'taby',
        engine: 'sitevision',
        config: { urls: ['https://www.taby.se/evenemang'], defaultCity: 'Täby' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'nynashamn',
        hostName: 'Nynäshamn Kommun',
        region: 'nynashamn',
        engine: 'sitevision',
        config: { urls: ['https://www.nynashamn.se/evenemang'], defaultCity: 'Nynäshamn' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'gnesta',
        hostName: 'Gnesta Kommun',
        region: 'gnesta',
        engine: 'sitevision',
        config: { urls: ['https://www.gnesta.se/evenemang'], defaultCity: 'Gnesta' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'vetlanda',
        hostName: 'Vetlanda Kommun',
        region: 'vetlanda',
        engine: 'sitevision',
        config: { urls: ['https://www.vetlanda.se/uppleva-och-gora/evenemangskalender'], defaultCity: 'Vetlanda' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'ljungby',
        hostName: 'Ljungby Kommun',
        region: 'ljungby',
        engine: 'sitevision',
        config: { urls: ['https://www.ljungby.se/uppleva-och-gora/evenemangskalender'], defaultCity: 'Ljungby' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'uppvidinge',
        hostName: 'Uppvidinge Kommun',
        region: 'uppvidinge',
        engine: 'sitevision',
        config: { urls: ['https://www.uppvidinge.se/uppleva-och-gora/evenemang'], defaultCity: 'Uppvidinge' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'lessebo',
        hostName: 'Lessebo Kommun',
        region: 'lessebo',
        engine: 'sitevision',
        config: { urls: ['https://www.lessebo.se/evenemang'], defaultCity: 'Lessebo' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'kalmar-stad',
        hostName: 'Kalmar Kommun',
        region: 'kalmar',
        engine: 'sitevision',
        config: { urls: ['https://www.kalmar.se/evenemang'], defaultCity: 'Kalmar' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'gotland-kommun',
        hostName: 'Gotland Kommun',
        region: 'gotland',
        engine: 'sitevision',
        config: { urls: ['https://www.gotland.se/evenemang'], defaultCity: 'Gotland' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'klippan',
        hostName: 'Klippan Kommun',
        region: 'klippan',
        engine: 'sitevision',
        config: { urls: ['https://www.klippan.se/evenemang'], defaultCity: 'Klippan' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'ostra-goinge',
        hostName: 'Östra Göinge Kommun',
        region: 'ostra-goinge',
        engine: 'sitevision',
        config: { urls: ['https://www.ostragoinge.se/uppleva-och-gora/evenemang'], defaultCity: 'Östra Göinge' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'bengtsfors',
        hostName: 'Bengtsfors Kommun',
        region: 'bengtsfors',
        engine: 'sitevision',
        config: { urls: ['https://www.bengtsfors.se/uppleva-och-gora/evenemang'], defaultCity: 'Bengtsfors' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'herrljunga',
        hostName: 'Herrljunga Kommun',
        region: 'herrljunga',
        engine: 'sitevision',
        config: { urls: ['https://www.herrljunga.se/uppleva-och-gora/evenemang'], defaultCity: 'Herrljunga' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'lysekil',
        hostName: 'Lysekil Kommun',
        region: 'lysekil',
        engine: 'sitevision',
        config: { urls: ['https://www.lysekil.se/kalender'], defaultCity: 'Lysekil' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'molndal',
        hostName: 'Mölndal Kommun',
        region: 'molndal',
        engine: 'sitevision',
        config: { urls: ['https://www.molndal.se/uppleva-och-gora/evenemang'], defaultCity: 'Mölndal' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'svenljunga',
        hostName: 'Svenljunga Kommun',
        region: 'svenljunga',
        engine: 'sitevision',
        config: { urls: ['https://www.svenljunga.se/evenemangskalender'], defaultCity: 'Svenljunga' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'tranemo',
        hostName: 'Tranemo Kommun',
        region: 'tranemo',
        engine: 'sitevision',
        config: { urls: ['https://www.tranemo.se/kalender'], defaultCity: 'Tranemo' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'vargarda',
        hostName: 'Vårgårda Kommun',
        region: 'vargarda',
        engine: 'sitevision',
        config: { urls: ['https://www.vargarda.se/evenemang'], defaultCity: 'Vårgårda' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'forshaga',
        hostName: 'Forshaga Kommun',
        region: 'forshaga',
        engine: 'sitevision',
        config: { urls: ['https://www.forshaga.se/evenemang'], defaultCity: 'Forshaga' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'hammaro',
        hostName: 'Hammarö Kommun',
        region: 'hammaro',
        engine: 'sitevision',
        config: { urls: ['https://www.hammaro.se/uppleva-och-gora/evenemang'], defaultCity: 'Hammarö' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'kil',
        hostName: 'Kil Kommun',
        region: 'kil',
        engine: 'sitevision',
        config: { urls: ['https://www.kil.se/kalender'], defaultCity: 'Kil' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'fagersta',
        hostName: 'Fagersta Kommun',
        region: 'fagersta',
        engine: 'sitevision',
        config: { urls: ['https://www.fagersta.se/evenemang'], defaultCity: 'Fagersta' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'ljusnarsberg',
        hostName: 'Ljusnarsberg Kommun',
        region: 'ljusnarsberg',
        engine: 'sitevision',
        config: { urls: ['https://www.ljusnarsberg.se/evenemang'], defaultCity: 'Ljusnarsberg' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'borlange-stad',
        hostName: 'Borlänge Kommun',
        region: 'borlange',
        engine: 'sitevision',
        config: { urls: ['https://www.borlange.se/evenemang'], defaultCity: 'Borlänge' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'malung-salen',
        hostName: 'Malung-Sälen Kommun',
        region: 'malung-salen',
        engine: 'sitevision',
        config: { urls: ['https://www.malung-salen.se/evenemang'], defaultCity: 'Malung-Sälen' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'sandviken',
        hostName: 'Sandviken Kommun',
        region: 'sandviken',
        engine: 'sitevision',
        config: { urls: ['https://www.sandviken.se/evenemang'], defaultCity: 'Sandviken' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'stromsund',
        hostName: 'Strömsund Kommun',
        region: 'stromsund',
        engine: 'sitevision',
        config: { urls: ['https://www.stromsund.se/evenemang'], defaultCity: 'Strömsund' },
        updateFrequency: 'every-3d',
    },
    {
        id: 'haparanda',
        hostName: 'Haparanda Kommun',
        region: 'haparanda',
        engine: 'sitevision',
        config: { urls: ['https://www.haparanda.se/evenemang'], defaultCity: 'Haparanda' },
        updateFrequency: 'every-3d',
    },

    {
        id: 'staffanstorp',
        hostName: 'Staffanstorps Kommun',
        region: 'staffanstorp',
        engine: 'wp-rest',
        config: {
            baseUrl: 'https://www.staffanstorp.se',
            variant: 'wp-v2',
            defaultCity: 'Staffanstorp',
        },
        updateFrequency: 'weekly',
        notes: 'Probe 2026-06: 0 events vid probe (men endpoint finns). Kollar veckovis ifall de fyller på.',
    },

    // ─── SITEMAP-KÄLLOR (probe-sitemap 2026-06-03) ──────────────────────────
    // Discovery via /sitemap.xml. Datum extraheras via JSON-LD/microdata
    // när det finns, annars svensk text-parser. URL-blacklist (default i
    // engine) skippar protokoll/nämnd-möten som ligger i samma kalender.

    {
        id: 'motala',
        hostName: 'Motala Kommun',
        region: 'motala',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.motala.se/sitemap_index.xml',
            urlPatterns: [/\/(?:sv\/)?aktivitet(?:er)?\/[^/]+\/?$/i],
            defaultCity: 'Motala',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe-sitemap 2026-06-03: 131 aktivitet-URLs. Text-parser hittar datum i body.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'linkoping',
        hostName: 'Visit Linköping',
        region: 'linkoping',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.visitlinkoping.se/sitemap.xml',
            urlPatterns: [/\/(?:sv\/)?evenemang\/[^/]+\/?$/i],
            defaultCity: 'Linköping',
        },
        updateFrequency: 'daily',
        notes: 'Probe-sitemap 2026-06-03: 187 evenemang-URLs. <time datetime> finns.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'morbylanga',
        hostName: 'Mörbylånga Kommun',
        region: 'morbylanga',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.morbylanga.se/sitemap.xml',
            urlPatterns: [/\/(?:sv\/)?aktivitet(?:er)?\/[^/]+\/?$/i],
            defaultCity: 'Mörbylånga',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe-sitemap 2026-06-03: 12 aktivitet-URLs. microdata startDate.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'monsteras',
        hostName: 'Mönsterås Kommun',
        region: 'monsteras',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.monsteras.se/sitemap.xml',
            urlPatterns: [/\/event\/[^/]+\/?$/i],
            defaultCity: 'Mönsterås',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe-sitemap 2026-06-03: 649 event-URLs. Text-parser ur #event-dates-list.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'landskrona',
        hostName: 'Landskrona Stad',
        region: 'landskrona',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.landskrona.se/sitemap.xml',
            urlPatterns: [/\/(?:sv\/)?evenemang\/[^/]+\/?$/i],
            defaultCity: 'Landskrona',
        },
        updateFrequency: 'daily',
        notes: 'Probe-sitemap 2026-06-03: 180 evenemang-URLs. <time datetime>.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'karlsborg',
        hostName: 'Karlsborg Kommun',
        region: 'karlsborg',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.karlsborg.se/sitemap.xml',
            urlPatterns: [/\/(?:sv\/)?aktivitet(?:er)?\/[^/]+\/?$/i],
            defaultCity: 'Karlsborg',
        },
        updateFrequency: 'weekly',
        notes: 'Probe-sitemap 2026-06-03: 15 aktivitet-URLs. Text-parser.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'arjeplog',
        hostName: 'Arjeplog Kommun',
        region: 'arjeplog',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.arjeplog.se/sitemap.xml',
            urlPatterns: [/\/(?:sv\/)?evenemang\/[^/]+\/?$/i],
            defaultCity: 'Arjeplog',
        },
        updateFrequency: 'weekly',
        notes: 'Probe-sitemap 2026-06-03: 7 evenemang-URLs. Text-parser.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'jokkmokk',
        hostName: 'Jokkmokks Kommun',
        region: 'jokkmokk',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.jokkmokk.se/sitemap.xml',
            urlPatterns: [/\/(?:sv\/)?evenemang\/[^/]+\/?$/i],
            defaultCity: 'Jokkmokk',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe-sitemap 2026-06-03: 463 evenemang-URLs. Text-parser. OBS: många historiska — runner-fönster filtrerar.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'pitea',
        hostName: 'Piteå Kommun',
        region: 'pitea',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.pitea.se/sitemap.xml',
            urlPatterns: [/\/Upplev\/Evenemang\/[^/]+\/?$/i],
            defaultCity: 'Piteå',
        },
        updateFrequency: 'every-3d',
        notes: 'Probe-sitemap 2026-06-03: 17 evenemang-URLs. Text-parser.',
        lastVerified: '2026-06-04',
    },
    {
        id: 'dorotea',
        hostName: 'Dorotea Kommun',
        region: 'dorotea',
        engine: 'sitemap',
        config: {
            sitemapUrl: 'https://www.dorotea.se/sitemap.xml',
            urlPatterns: [/\/kalender\/[^/]+\/?$/i],
            defaultCity: 'Dorotea',
        },
        updateFrequency: 'weekly',
        notes: 'Probe-sitemap 2026-06-03: 10 kalender-URLs. Text-parser. Liten kommun, sparsam volym.',
        lastVerified: '2026-06-04',
    },
];

/**
 * Filtrera registry på id-prefix eller region — användbart för debugging:
 *   const stockholm = filterSources({ region: 'stockholm' });
 */
export function filterSources(opts: { id?: string; region?: string; engine?: string }): Source[] {
    return SOURCES.filter((s) => {
        if (opts.id && !s.id.includes(opts.id)) return false;
        if (opts.region && s.region !== opts.region) return false;
        if (opts.engine && s.engine !== opts.engine) return false;
        return true;
    });
}
