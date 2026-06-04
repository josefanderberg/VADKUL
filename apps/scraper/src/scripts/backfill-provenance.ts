/**
 * Backfill-provenance: läs befintliga SOURCES + deras notes, generera
 * `src/sources/data/provenance.ts` med strukturerad discovery + fieldMap.
 *
 * Strategi:
 *   - method     härleds från engine
 *   - probeUrl   från config.baseUrl eller config.urls[0]
 *   - date       parsas ur notes ("Probe 2026-06: …") → annars dagens datum
 *   - rawEventCount   parsas ur notes ("369 events", "~48 events")
 *   - rediscoverCommand   från fieldMaps.ts helper
 *   - expectedMinEvents   rawEventCount / 2 (varna om träffarna halveras)
 *   - fieldMap   default per engine (kan overrides manuellt sen)
 *
 * Användning:
 *   npx ts-node src/scripts/backfill-provenance.ts
 *   → skriver src/sources/data/provenance.ts
 *
 * Köra om: säkert. Skriver alltid över hela filen från SOURCES + notes.
 * Manuella override till provenance.ts överlever inte — gör dem som
 * direkta fält på Source i registry.ts istället.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SOURCES } from '../sources/registry';
import { defaultFieldMap, rediscoverCommand } from '../sources/engines/fieldMaps';
import type { SourceDiscovery, SourceFieldMap } from '../sources/types';

interface ProvenanceEntry {
    discovery: SourceDiscovery;
    fieldMap: SourceFieldMap;
    expectedMinEvents?: number;
    sampleEventUrl?: string;
}

function parseDate(notes: string | undefined): string {
    if (!notes) return new Date().toISOString().slice(0, 10);
    // "Probe 2026-06" / "Probe 2026-06-02" / "Probe-all 2026-06-03"
    const m = notes.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (!m) return new Date().toISOString().slice(0, 10);
    const yyyy = m[1], mm = m[2], dd = m[3] || '01';
    return `${yyyy}-${mm}-${dd}`;
}

function parseRawEventCount(notes: string | undefined): number | undefined {
    if (!notes) return undefined;
    // "369 events" / "~48 events" / "1217 events"
    const m = notes.match(/~?\s*(\d{1,5})\s+events/i);
    return m ? parseInt(m[1], 10) : undefined;
}

function inferProbeUrl(engine: string, config: Record<string, any>): string {
    switch (engine) {
        case 'wp-rest':
            const base = config.baseUrl || '';
            const ep = config.endpoint || (config.variant === 'tribe'
                ? '/wp-json/tribe/events/v1/events'
                : '/wp-json/wp/v2/event');
            return `${base}${ep}`;
        case 'sitemap':
            return config.sitemapUrl || '';
        case 'sitevision':
        case 'ical':
        case 'json-ld':
        case 'nextjs-data':
        case 'nuxt-data':
            return (config.urls && config.urls[0]) || config.baseUrl || '';
        default:
            return config.baseUrl || (config.urls && config.urls[0]) || '';
    }
}

function methodFromEngine(engine: string): SourceDiscovery['method'] {
    switch (engine) {
        case 'wp-rest': return 'probe-wp';
        case 'sitevision': return 'probe-sitevision';
        case 'ical': return 'probe-ical';
        case 'json-ld': return 'probe-jsonld';
        case 'sitemap': return 'probe-sitemap';
        case 'nextjs-data':
        case 'nuxt-data': return 'probe-xhr';
        default: return 'manual';
    }
}

function noteSnippet(notes: string | undefined): string {
    if (!notes) return '';
    // Det som kommer EFTER ": " i noten är ofta hur+vad — ta hela för historik
    return notes.trim();
}

function buildProvenance(source: typeof SOURCES[number]): ProvenanceEntry {
    const variant = source.config?.variant as string | undefined;
    const probeUrl = inferProbeUrl(source.engine, source.config || {});
    const count = parseRawEventCount(source.notes);

    const discovery: SourceDiscovery = {
        method: methodFromEngine(source.engine),
        probeUrl,
        date: parseDate(source.notes),
        rawEventCount: count,
        rediscoverCommand: rediscoverCommand(source.engine, source.region || source.id),
        notes: noteSnippet(source.notes),
    };

    return {
        discovery,
        fieldMap: defaultFieldMap(source.engine, variant),
        expectedMinEvents: count != null ? Math.max(1, Math.floor(count / 2)) : undefined,
    };
}

function stringify(value: unknown, indent: number): string {
    // Egen pretty-printer som ger snygg TS-output (inga citattecken runt nycklar,
    // single-quote-strängar, korrekt indragning).
    const pad = ' '.repeat(indent);
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
        // Escape single-quotes och backslash
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map(v => pad + '    ' + stringify(v, indent + 4));
        return `[\n${items.join(',\n')},\n${pad}]`;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value).filter(([_, v]) => v !== undefined);
        if (entries.length === 0) return '{}';
        const lines = entries.map(([k, v]) => {
            // TS object-literal keys måste citeras om de innehåller annat än identifier-chars
            const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${k.replace(/'/g, "\\'")}'`;
            return `${pad}    ${safeKey}: ${stringify(v, indent + 4)}`;
        });
        return `{\n${lines.join(',\n')},\n${pad}}`;
    }
    return 'undefined';
}

async function main() {
    console.log(`Backfill provenance för ${SOURCES.length} källor …\n`);
    const provenance: Record<string, ProvenanceEntry> = {};
    for (const s of SOURCES) {
        provenance[s.id] = buildProvenance(s);
        const d = provenance[s.id].discovery;
        console.log(`  ${s.id.padEnd(20)} ${d.method.padEnd(20)} ${d.date}  ${d.rawEventCount ?? '?'} events`);
    }

    const out = `/**
 * Auto-genererad provenance för registrerade källor.
 *
 * Genereras av: \`npx ts-node src/scripts/backfill-provenance.ts\`
 *
 * Varje entry beskriver HUR vi hittade källan och VAR i råsvaret fälten
 * ligger. Filen är dokumentation + felsökningsstöd — den används inte vid
 * runtime av engines. Den merges in i SOURCES i sources/index.ts så att
 * \`SOURCES[i].discovery\` är tillgänglig för konsumenter.
 *
 * EDIT-POLICY:
 *   - Re-generera om du vill nollställa från registry.ts-notes.
 *   - För manuella overrides — lägg dem som \`discovery\`/\`fieldMap\` direkt
 *     på Source i registry.ts. Sources/index.ts mergar med Source-värden
 *     som vinnare.
 *
 * Senast genererad: ${new Date().toISOString()}
 */

import type { SourceDiscovery, SourceFieldMap } from '../types';

export interface ProvenanceEntry {
    discovery: SourceDiscovery;
    fieldMap?: SourceFieldMap;
    expectedMinEvents?: number;
    sampleEventUrl?: string;
}

export const PROVENANCE: Record<string, ProvenanceEntry> = ${stringify(provenance, 0)};
`;

    const outPath = path.resolve(__dirname, '../sources/data/provenance.ts');
    fs.writeFileSync(outPath, out, 'utf8');
    console.log(`\nSkrev ${outPath} (${SOURCES.length} källor).`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
