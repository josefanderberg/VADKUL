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
];
