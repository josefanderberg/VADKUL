/**
 * Sources — public exports och engine-registry.
 *
 * Användning:
 *   import { runSources, ENGINES } from './sources';
 *   await runSources(sourceList, ENGINES);
 */

import { Engine, Source } from './types';
import { jsonLdEngine } from './engines/json-ld';
import { wpRestEngine } from './engines/wp-rest';
import { icalEngine } from './engines/ical';
import { xhrDiscoveryEngine } from './engines/xhr-discovery';
import { nextjsDataEngine } from './engines/nextjs-data';
import { nuxtDataEngine } from './engines/nuxt-data';
import { sitevisionEngine } from './engines/sitevision';
import { sitemapEngine } from './engines/sitemap';
// Nätverks-engines — paraply-API:er där EN engine täcker hela nätverket.
// Bor i src/scrapers/ (källspecifik kod) men kör genom samma runner-pipeline.
import { hembygdEngine } from '../scrapers/hembygd';
import { svenskaKyrkanEngine } from '../scrapers/svenskakyrkan';
import { naturskyddsforeningenEngine } from '../scrapers/naturskyddsforeningen';
import { rotaryEngine } from '../scrapers/rotary';
import { rodaKorsetEngine } from '../scrapers/rodakorset';
import { SOURCES as RAW_SOURCES } from './registry';
import { PROVENANCE } from './data/provenance';

export * from './types';
export { runSource, runSources, summarize } from './runner';
export { shouldRunToday, scheduledForToday, summarizeSchedule } from './schedule';
export { jsonLdEngine, wpRestEngine, icalEngine, xhrDiscoveryEngine, nextjsDataEngine, nuxtDataEngine, sitevisionEngine, sitemapEngine };

/**
 * SOURCES med provenance-overlay merge:
 *   - registry.ts är källan för engine + config (runtime).
 *   - data/provenance.ts är källan för discovery + fieldMap (felsökning).
 *   - Manuella fält direkt på Source i registry.ts VINNER över provenance-overlay.
 */
export const SOURCES: Source[] = RAW_SOURCES.map(s => {
    const p = PROVENANCE[s.id];
    if (!p) return s;
    return {
        ...s,
        discovery: s.discovery ?? p.discovery,
        fieldMap: s.fieldMap ?? p.fieldMap,
        expectedMinEvents: s.expectedMinEvents ?? p.expectedMinEvents,
        sampleEventUrl: s.sampleEventUrl ?? p.sampleEventUrl,
    };
});

/**
 * Default engine-registry. Skicka in i runSources för att binda namn → implementation.
 */
export const ENGINES: Record<string, Engine> = {
    'json-ld': jsonLdEngine,
    'wp-rest': wpRestEngine,
    'ical': icalEngine,
    'xhr-discovery': xhrDiscoveryEngine,
    'nextjs-data': nextjsDataEngine,
    'nuxt-data': nuxtDataEngine,
    'sitevision': sitevisionEngine,
    'sitemap': sitemapEngine,
    // Nätverks-engines (en källa = hela nätverket)
    'hembygd': hembygdEngine,
    'svenskakyrkan': svenskaKyrkanEngine,
    'naturskyddsforeningen': naturskyddsforeningenEngine,
    'rotary': rotaryEngine,
    'rodakorset': rodaKorsetEngine,
};
