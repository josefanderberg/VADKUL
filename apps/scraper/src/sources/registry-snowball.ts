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
];
