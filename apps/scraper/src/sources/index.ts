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
import { crunchoEngine } from './engines/cruncho';
import { gotohubEngine } from './engines/gotohub';
import { everysportEngine } from './engines/everysport';
import { wpGraphqlEngine } from './engines/wp-graphql';
// Nätverks-engines — paraply-API:er där EN engine täcker hela nätverket.
// Bor i src/scrapers/ (källspecifik kod) men kör genom samma runner-pipeline.
import { hembygdEngine } from '../scrapers/hembygd';
import { svenskaKyrkanEngine } from '../scrapers/svenskakyrkan';
import { naturskyddsforeningenEngine } from '../scrapers/naturskyddsforeningen';
import { rotaryEngine } from '../scrapers/rotary';
import { rodaKorsetEngine } from '../scrapers/rodakorset';
import { friluftsframjandetEngine } from '../scrapers/friluftsframjandet';
import { proEngine } from '../scrapers/pro';
import { korpenEngine } from '../scrapers/korpen';
import { riksteaternEngine } from '../scrapers/riksteatern';
import { bibliotekEngine } from '../scrapers/bibliotek';
import { raceidEngine } from '../scrapers/raceid';
import { bildaEngine } from '../scrapers/bilda';
import { medborgarskolanEngine } from '../scrapers/medborgarskolan';
import { svVuxenskolanEngine } from '../scrapers/sv';
import { abfEngine } from '../scrapers/abf';
import { slagthusetEngine } from '../scrapers/slagthuset';
import { norticEngine } from '../scrapers/nortic';
import { cbisEngine } from '../scrapers/cbis';
import { fhpEngine } from '../scrapers/fhp';
import { goteborgStadEngine } from '../scrapers/goteborgstad';
import { gotlandComEngine } from '../scrapers/gotlandcom';
import { bergmancenterEngine } from '../scrapers/bergmancenter';
import { turidEngine } from '../scrapers/turid';
import { SOURCES as RAW_SOURCES } from './registry';
import { PROVENANCE } from './data/provenance';

export * from './types';
export { runSource, runSources, summarize } from './runner';
export { shouldRunToday, scheduledForToday, summarizeSchedule } from './schedule';
export { jsonLdEngine, wpRestEngine, icalEngine, xhrDiscoveryEngine, nextjsDataEngine, nuxtDataEngine, sitevisionEngine, sitemapEngine, crunchoEngine };

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
    'cruncho': crunchoEngine,
    'gotohub': gotohubEngine,
    'everysport': everysportEngine,
    'wp-graphql': wpGraphqlEngine,
    // Nätverks-engines (en källa = hela nätverket)
    'hembygd': hembygdEngine,
    'svenskakyrkan': svenskaKyrkanEngine,
    'naturskyddsforeningen': naturskyddsforeningenEngine,
    'rotary': rotaryEngine,
    'rodakorset': rodaKorsetEngine,
    'friluftsframjandet': friluftsframjandetEngine,
    'pro': proEngine,
    'korpen': korpenEngine,
    'riksteatern': riksteaternEngine,
    'bibliotek': bibliotekEngine,
    'raceid': raceidEngine,
    'bilda': bildaEngine,
    'medborgarskolan': medborgarskolanEngine,
    'sv-vuxenskolan': svVuxenskolanEngine,
    'abf': abfEngine,
    'slagthuset': slagthusetEngine,
    'nortic': norticEngine,
    'cbis': cbisEngine,
    'fhp': fhpEngine,
    'goteborgstad': goteborgStadEngine,
    'gotlandcom': gotlandComEngine,
    'bergmancenter': bergmancenterEngine,
    'turid': turidEngine,
};
