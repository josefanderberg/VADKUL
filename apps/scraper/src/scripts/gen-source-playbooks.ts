/**
 * Gen-source-playbooks: skriver en Markdown-playbook per kommun-källa till
 * `docs/scrapers/kommuner/<id>.md`. Varje playbook beskriver:
 *
 *   1. Hur källan upptäcktes (discovery)
 *   2. Engine + config (vad runtime gör)
 *   3. Field-map (var i råsvaret kommer respektive RawEvent-fält ifrån)
 *   4. Re-discovery-kommando (hur man kör om probet)
 *   5. Sample event-URL för regression
 *   6. Troubleshooting (kända fallgropar)
 *
 * En "MANUELLT"-sektion längst ner bevaras mellan körningar — det är där
 * människor lägger debug-historik som inte ska skrivas över av nästa
 * generation.
 *
 * Användning:
 *   npx ts-node src/scripts/gen-source-playbooks.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { SOURCES } from '../sources';
import type { Source } from '../sources/types';

const DOCS_DIR = path.resolve(__dirname, '../../../../docs/scrapers/kommuner');

const MANUAL_HEADER = '## Manuell debug-historik';
const MANUAL_PLACEHOLDER = '_Lägg dina manuella anteckningar här — bevaras mellan körningar._';

function configBlock(s: Source): string {
    return '```ts\n' + JSON.stringify(s.config, null, 2) + '\n```';
}

function fieldMapBlock(s: Source): string {
    if (!s.fieldMap) return '_Ingen field-map definierad._';
    const lines: string[] = [];
    lines.push('| Fält | Källa |');
    lines.push('|---|---|');
    const entries: [string, string | undefined][] = [
        ['title', s.fieldMap.title],
        ['startDate', s.fieldMap.startDate],
        ['endDate', s.fieldMap.endDate],
        ['url', s.fieldMap.url],
        ['venueName', s.fieldMap.venueName],
        ['address', s.fieldMap.address],
        ['city', s.fieldMap.city],
        ['coords', s.fieldMap.coords],
        ['description', s.fieldMap.description],
        ['imageUrl', s.fieldMap.imageUrl],
        ['organizer', s.fieldMap.organizer],
    ];
    for (const [k, v] of entries) {
        if (v) lines.push(`| \`${k}\` | ${v} |`);
    }
    if (s.fieldMap.other) {
        for (const [k, v] of Object.entries(s.fieldMap.other)) {
            lines.push(`| \`${k}\` | ${v} |`);
        }
    }
    return lines.join('\n');
}

function troubleshootingBlock(s: Source): string {
    if (!s.troubleshooting || s.troubleshooting.length === 0) {
        return '_Inga kända fallgropar dokumenterade._';
    }
    return s.troubleshooting.map(t => `- ${t}`).join('\n');
}

function buildPlaybook(s: Source, existingManual: string | null): string {
    const lines: string[] = [];
    lines.push(`# ${s.hostName}`);
    lines.push('');
    lines.push(`> Auto-genererad från \`src/sources/registry.ts\` + \`src/sources/data/provenance.ts\`.`);
    lines.push(`> Re-generera med \`npx ts-node src/scripts/gen-source-playbooks.ts\`.`);
    lines.push('');
    lines.push('| | |');
    lines.push('|---|---|');
    lines.push(`| **ID** | \`${s.id}\` |`);
    lines.push(`| **Region** | ${s.region || '—'} |`);
    lines.push(`| **Engine** | \`${s.engine}\` |`);
    lines.push(`| **Update frequency** | \`${s.updateFrequency || 'daily'}\` |`);
    if (s.disabled) lines.push(`| **Status** | 🔴 DISABLED |`);
    lines.push('');

    lines.push('## Hur vi hittade den');
    lines.push('');
    if (s.discovery) {
        lines.push(`- **Metod:** \`${s.discovery.method}\``);
        lines.push(`- **Probe-URL:** ${s.discovery.probeUrl}`);
        lines.push(`- **Upptäckt:** ${s.discovery.date}`);
        if (s.discovery.rawEventCount != null) {
            lines.push(`- **Antal events vid upptäckt:** ${s.discovery.rawEventCount}`);
        }
        if (s.discovery.rediscoverCommand) {
            lines.push(`- **Kör om probet:** \`${s.discovery.rediscoverCommand}\``);
        }
        if (s.discovery.notes) {
            lines.push('');
            lines.push(`> ${s.discovery.notes}`);
        }
    } else {
        lines.push('_Ingen discovery-information sparad._');
    }
    lines.push('');

    lines.push('## Engine-config');
    lines.push('');
    lines.push(configBlock(s));
    lines.push('');

    lines.push('## Field-map (var fälten kommer ifrån i råsvaret)');
    lines.push('');
    lines.push(fieldMapBlock(s));
    lines.push('');

    lines.push('## Larmtrösklar & sample');
    lines.push('');
    if (s.expectedMinEvents != null) {
        lines.push(`- **expectedMinEvents:** ${s.expectedMinEvents} (under detta = potentiellt trasig källa)`);
    } else {
        lines.push('- _expectedMinEvents inte satt._');
    }
    if (s.sampleEventUrl) {
        lines.push(`- **Sample event-URL:** ${s.sampleEventUrl}`);
    } else {
        lines.push('- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._');
    }
    if (s.lastVerified) {
        lines.push(`- **Senast verifierad:** ${s.lastVerified}`);
    }
    lines.push('');

    lines.push('## Troubleshooting');
    lines.push('');
    lines.push(troubleshootingBlock(s));
    lines.push('');

    lines.push(MANUAL_HEADER);
    lines.push('');
    lines.push(existingManual?.trim() || MANUAL_PLACEHOLDER);
    lines.push('');

    return lines.join('\n');
}

/** Plocka ut "Manuell debug-historik"-sektionen från en befintlig playbook. */
function extractManualSection(md: string): string | null {
    const idx = md.indexOf(MANUAL_HEADER);
    if (idx < 0) return null;
    const after = md.slice(idx + MANUAL_HEADER.length);
    // Plocka allt fram till nästa H2 (vi har inga efter manualen normalt)
    const nextHeading = after.search(/\n##\s/);
    const content = (nextHeading >= 0 ? after.slice(0, nextHeading) : after).trim();
    if (!content || content === MANUAL_PLACEHOLDER) return null;
    return content;
}

function buildIndex(sources: Source[]): string {
    const lines: string[] = [];
    lines.push('# Kommun-källor — index');
    lines.push('');
    lines.push('Auto-genererad. Re-skapa med `npx ts-node src/scripts/gen-source-playbooks.ts`.');
    lines.push('');
    lines.push(`Totalt: **${sources.length}** kommun-källor i registry.`);
    lines.push('');
    lines.push('| Kommun | Engine | Discovery | Min events |');
    lines.push('|---|---|---|---|');
    const sorted = [...sources].sort((a, b) => a.hostName.localeCompare(b.hostName, 'sv'));
    for (const s of sorted) {
        const d = s.discovery?.date || '—';
        const eng = `${s.engine}${s.config?.variant ? ` (${s.config.variant})` : ''}`;
        const min = s.expectedMinEvents ?? '—';
        const status = s.disabled ? ' 🔴' : '';
        lines.push(`| [${s.hostName}](./${s.id}.md)${status} | \`${eng}\` | ${d} | ${min} |`);
    }
    lines.push('');
    return lines.join('\n');
}

async function main() {
    if (!fs.existsSync(DOCS_DIR)) {
        fs.mkdirSync(DOCS_DIR, { recursive: true });
    }
    let updated = 0;
    let preservedManual = 0;
    for (const s of SOURCES) {
        const file = path.join(DOCS_DIR, `${s.id}.md`);
        let existingManual: string | null = null;
        if (fs.existsSync(file)) {
            const prev = fs.readFileSync(file, 'utf8');
            existingManual = extractManualSection(prev);
            if (existingManual) preservedManual++;
        }
        const md = buildPlaybook(s, existingManual);
        fs.writeFileSync(file, md, 'utf8');
        updated++;
    }
    const indexFile = path.join(DOCS_DIR, 'README.md');
    fs.writeFileSync(indexFile, buildIndex(SOURCES), 'utf8');
    console.log(`Genererade ${updated} playbooks → ${DOCS_DIR}`);
    console.log(`Bevarade manuella debug-anteckningar för ${preservedManual} källor.`);
    console.log(`Index: ${indexFile}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
