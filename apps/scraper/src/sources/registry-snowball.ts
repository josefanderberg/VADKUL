/**
 * GENERERAD FIL — webb-snöbollens auto-upptäckta källor.
 *
 * Pipeline (scripts/web-snowball.ts, veckokörning tis 09:00 via launchd):
 *   1. Skörda kandidat-domäner ur eventdatan (länkar i beskrivningar +
 *      slug-gissningar för återkommande arrangörer utan känd domän).
 *   2. bulk-probe verifierar strukturerad eventdata (Tribe/wp-v2/sitemap).
 *   3. Smoke-test: motorn körs på riktigt (utan DB-skrivning) och eventen
 *      rimlighetskontrolleras (antal, datum, titelkvalitet, Sverige-signal).
 *   4. Bara godkända kandidater skrivs hit, som status 'experimental'.
 *
 * Skyddsnät efteråt: nattkedjans AI-audit + hide-junk + auto-karantänen
 * (4 raka tomma körningar ⇒ paus). Redigera hellre kurerade källor i
 * registry.ts — denna fil skrivs över av snöbollen.
 */

import { Source } from './types';

export const SNOWBALL_SOURCES: Source[] = [

    {
        id: 'sb-visitpitea-se',
        hostName: 'Visit Piteå',
        region: 'pitea',
        engine: 'wp-rest' as const,
        config: { baseUrl: 'https://visitpitea.se', variant: 'wp-v2', defaultCity: 'Piteå', fetchDetailPage: true, maxPages: 5 },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://visitpitea.se',
            date: '2026-08-19',
            rawEventCount: 50,
        },
        notes: 'web-snöboll 2026-08-19: wp-v2, smoke 50 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-19',
    },
    {
        id: 'sb-visitsundsvall-se',
        hostName: 'Visit Sundsvall',
        region: 'sundsvall',
        engine: 'sitevision' as const,
        config: { urls: ["https://visitsundsvall.se/destination/evenemang"], defaultCity: 'Sundsvall' },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://visitsundsvall.se/destination/evenemang',
            date: '2026-08-19',
            rawEventCount: 4,
        },
        notes: 'web-snöboll 2026-08-19: sitevision-cal, smoke 4 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-19',
    },

    {
        id: 'sb-gamlalinkoping-info',
        hostName: 'Gamla Linköping',
        region: 'linkoping',
        engine: 'wp-rest' as const,
        config: { baseUrl: 'https://gamlalinkoping.info', variant: 'wp-v2', defaultCity: 'Linköping', fetchDetailPage: true, maxPages: 5 },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://gamlalinkoping.info',
            date: '2026-08-20',
            rawEventCount: 13,
        },
        notes: 'web-snöboll 2026-08-20: wp-v2, smoke 13 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-20',
    },
    {
        id: 'sb-linkopingsstadsfest-se',
        hostName: 'Linköpings Stadsfest',
        region: 'linkoping',
        engine: 'sitemap' as const,
        config: { sitemapUrl: 'https://linkopingsstadsfest.se/sitemap.xml', urlPatterns: [/\/evenemang\/[a-z0-9][a-z0-9-]{2,}/i], defaultCity: 'Linköping', maxUrls: 200 },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://linkopingsstadsfest.se/sitemap.xml',
            date: '2026-08-20',
            rawEventCount: 51,
        },
        notes: 'web-snöboll 2026-08-20: sitemap-text, smoke 51 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-20',
    },

    {
        id: 'sb-regionostergotland-se',
        hostName: 'Region Östergötland',
        region: 'ostergotland',
        engine: 'sitemap' as const,
        config: { sitemapUrl: 'https://www.regionostergotland.se/rest-api/sitemap/4.32669883183822752aa905', urlPatterns: [/\/kalender\/[a-z0-9][a-z0-9-]{2,}/i], defaultCity: '', maxUrls: 200 },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.regionostergotland.se/rest-api/sitemap/4.32669883183822752aa905',
            date: '2026-08-20',
            rawEventCount: 3,
        },
        notes: 'web-snöboll 2026-08-20: sitemap-text, smoke 3 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-20',
    },

    {
        id: 'sb-ulricehamn-se',
        hostName: 'Ulricehamn Kommun',
        region: 'ulricehamn',
        engine: 'sitevision' as const,
        config: { urls: ["https://www.ulricehamn.se/arkiv/kalender"], defaultCity: 'Ulricehamn' },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.ulricehamn.se/arkiv/kalender',
            date: '2026-08-23',
            rawEventCount: 10,
        },
        notes: 'web-snöboll 2026-08-23: sitevision-cal, smoke 10 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },
    {
        id: 'sb-norberg-se',
        hostName: 'Norberg Kommun',
        region: 'norberg',
        engine: 'sitevision' as const,
        config: { urls: ["https://www.norberg.se/visitnorberg/visit-norberg"], defaultCity: 'Norberg' },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.norberg.se/visitnorberg/visit-norberg',
            date: '2026-08-23',
            rawEventCount: 4,
        },
        notes: 'web-snöboll 2026-08-23: sitevision-cal, smoke 4 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },
    {
        id: 'sb-surahammar-se',
        hostName: 'Surahammar Kommun',
        region: 'surahammar',
        engine: 'sitevision' as const,
        config: { urls: ["https://www.surahammar.se/download/18.11ab9bc018b6ab78ed33df3"], defaultCity: 'Surahammar', restApi: {"url":"https://www.surahammar.se/rest-api/Evenemang"} },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.surahammar.se/download/18.11ab9bc018b6ab78ed33df3',
            date: '2026-08-23',
            rawEventCount: 36,
        },
        notes: 'web-snöboll 2026-08-23: sitevision-restapp, smoke 36 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },
    {
        id: 'sb-gagnef-se',
        hostName: 'Gagnef Kommun',
        region: 'gagnef',
        engine: 'sitemap' as const,
        config: { sitemapUrl: 'https://www.gagnef.se/gagnef-event-sitemap.xml', urlPatterns: [/\/evenemang\/[a-z0-9][a-z0-9-]{2,}/i], defaultCity: 'Gagnef', maxUrls: 200 },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.gagnef.se/gagnef-event-sitemap.xml',
            date: '2026-08-23',
            rawEventCount: 34,
        },
        notes: 'web-snöboll 2026-08-23: sitemap-text, smoke 34 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },

    {
        id: 'sb-jarfalla-se',
        hostName: 'Järfälla Kommun',
        region: 'jarfalla',
        engine: 'sitevision' as const,
        config: { urls: ["https://www.jarfalla.se/evenemang"], defaultCity: 'Järfälla' },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.jarfalla.se/evenemang',
            date: '2026-08-23',
            rawEventCount: 121,
        },
        notes: 'web-snöboll 2026-08-23: sitevision-cal, smoke 121 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },
    {
        id: 'sb-ydre-se',
        hostName: 'Ydre Kommun',
        region: 'ydre',
        engine: 'sitevision' as const,
        config: { urls: ["https://www.ydre.se/destinationydre/evenemang"], defaultCity: 'Ydre' },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.ydre.se/destinationydre/evenemang',
            date: '2026-08-23',
            rawEventCount: 11,
        },
        notes: 'web-snöboll 2026-08-23: sitevision-cal, smoke 11 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },
    {
        id: 'sb-varberg-se',
        hostName: 'Varberg Kommun',
        region: 'varberg',
        engine: 'sitevision' as const,
        config: { urls: ["https://www.varberg.se/kalender"], defaultCity: 'Varberg' },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.varberg.se/kalender',
            date: '2026-08-23',
            rawEventCount: 148,
        },
        notes: 'web-snöboll 2026-08-23: sitevision-cal, smoke 148 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },
    {
        id: 'sb-askersund-se',
        hostName: 'Askersund Kommun',
        region: 'askersund',
        engine: 'sitevision' as const,
        config: { urls: ["https://www.askersund.se/evenemang"], defaultCity: 'Askersund' },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.askersund.se/evenemang',
            date: '2026-08-23',
            rawEventCount: 5,
        },
        notes: 'web-snöboll 2026-08-23: sitevision-cal, smoke 5 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },
    {
        id: 'sb-lekeberg-se',
        hostName: 'Lekeberg Kommun',
        region: 'lekeberg',
        engine: 'sitevision' as const,
        config: { urls: ["https://www.lekeberg.se/upplevaochgora/evenemang.4.711bc06b14820d116bc33f4.html"], defaultCity: 'Lekeberg' },
        updateFrequency: 'every-3d' as const,
        status: 'experimental' as const,
        discovery: {
            method: 'hint' as const,
            probeUrl: 'https://www.lekeberg.se/upplevaochgora/evenemang.4.711bc06b14820d116bc33f4.html',
            date: '2026-08-23',
            rawEventCount: 4,
        },
        notes: 'web-snöboll 2026-08-23: sitevision-cal, smoke 4 event ok. Manuell kandidatlista (stads-svep).',
        lastVerified: '2026-08-23',
    },
];
