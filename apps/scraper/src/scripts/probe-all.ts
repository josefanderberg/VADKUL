/**
 * Probe-all: kör alla probes sekventiellt och diffa mot nuvarande registry.
 *
 * Användning:
 *   npm run probe-all                  # bara probe + visa vad som är nytt
 *   npm run probe-all -- --emit        # printa Source-config för nya hits
 *
 * Output:
 *   ✅ Redan i registry (befintliga källor som svarar)
 *   🆕 Nya potentiella källor (kommuner med svar men inte i registry)
 *   🔴 Befintliga källor som nu inte svarar (kan behöva ses över)
 *
 * Rekommenderas att köra månadsvis för att fånga:
 *   - Nya kommuner som installerat WP/Tribe/SiteVision
 *   - Befintliga källor som ändrat URL eller plattform
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { SOURCES } from '../sources/registry';

const SNAPSHOT_DIR = path.resolve(__dirname, '../sources/data/probe-snapshots');

function saveSnapshot(date: string, name: string, output: string): string {
    const dir = path.join(SNAPSHOT_DIR, date);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.txt`);
    fs.writeFileSync(file, output, 'utf8');
    return file;
}

const EMIT = process.argv.includes('--emit');

function runScript(name: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn('npx', ['ts-node', `src/scripts/${name}.ts`, '--concurrency=24'], {
            cwd: path.resolve(__dirname, '../..'),
            env: process.env,
        });
        let out = '';
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.stderr.on('data', (d) => { out += d.toString(); });
        proc.on('close', (code) => {
            if (code !== 0) {
                console.error(`[${name}] avslutade med kod ${code}`);
            }
            resolve(out);
        });
        proc.on('error', reject);
    });
}

interface ProbeHit {
    kommun: string;
    engine: string;
    events: number;
    url: string;
}

function parseProbeOutput(output: string, engineLabel: string): ProbeHit[] {
    const hits: ProbeHit[] = [];
    // Probe-WP-rader: "✅ [N/M] KommunNamn   wp-v2/tribe   N events  https://..."
    // Probe-SiteVision-rader: "✅ [N/M] KommunNamn   N events  https://..."
    const lines = output.split('\n');
    for (const line of lines) {
        if (!line.startsWith('✅')) continue;
        // Försök matcha båda formaten
        const wpMatch = line.match(/✅\s*\[[^\]]+\]\s+(.+?)\s+(wp-v2|tribe)\s+(\d+)\s+events\s+(\S+)/);
        if (wpMatch) {
            hits.push({
                kommun: wpMatch[1].trim(),
                engine: `wp-rest (${wpMatch[2]})`,
                events: parseInt(wpMatch[3], 10),
                url: wpMatch[4],
            });
            continue;
        }
        const svMatch = line.match(/✅\s*\[[^\]]+\]\s+(.+?)\s+(\d+)\s+events\s+(\S+)/);
        if (svMatch) {
            hits.push({
                kommun: svMatch[1].trim(),
                engine: engineLabel,
                events: parseInt(svMatch[3], 10),
                url: svMatch[4],
            });
        }
    }
    return hits;
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
    console.log('🔎 Kör alla probes (kan ta ~10 min)…\n');

    const [wpOut, svOut, icalOut] = await Promise.all([
        runScript('probe-wordpress').then(o => { console.log('  ✓ probe-wp klart'); return o; }),
        runScript('probe-sitevision').then(o => { console.log('  ✓ probe-sitevision klart'); return o; }),
        runScript('probe-ical').then(o => { console.log('  ✓ probe-ical klart'); return o; }),
    ]);

    // Snapshot rå output per probe-typ för senare diff vid förändringar.
    const today = new Date().toISOString().slice(0, 10);
    saveSnapshot(today, 'probe-wp', wpOut);
    saveSnapshot(today, 'probe-sitevision', svOut);
    saveSnapshot(today, 'probe-ical', icalOut);
    console.log(`  📸 Snapshots sparade i src/sources/data/probe-snapshots/${today}/`);

    const wpHits = parseProbeOutput(wpOut, 'wp-rest');
    const svHits = parseProbeOutput(svOut, 'sitevision');
    const icalHits = parseProbeOutput(icalOut, 'ical');
    const allHits = [...wpHits, ...svHits, ...icalHits];

    // Vilka kommuner är redan i vårt registry?
    const registeredSlugs = new Set(SOURCES.map(s => slugify(s.region || s.hostName)));

    const newHits = allHits.filter(h => !registeredSlugs.has(slugify(h.kommun)));
    const knownHits = allHits.filter(h => registeredSlugs.has(slugify(h.kommun)));

    // Befintliga källor som INTE svarade i någon probe
    const respondedSlugs = new Set(allHits.map(h => slugify(h.kommun)));
    const silentSources = SOURCES.filter(s => !s.disabled && !respondedSlugs.has(slugify(s.region || s.hostName)));

    console.log('\n=== SAMMANFATTNING ===\n');
    console.log(`Totalt probe-träffar:     ${allHits.length}`);
    console.log(`  ✅ Redan i registry:     ${knownHits.length}`);
    console.log(`  🆕 Nya kandidater:        ${newHits.length}`);
    console.log(`  🔴 Källor utan svar nu:   ${silentSources.length}`);

    if (newHits.length > 0) {
        console.log(`\n🆕 NYA KANDIDATER (${newHits.length}):\n`);
        for (const h of newHits.sort((a, b) => b.events - a.events)) {
            console.log(`  ${h.kommun.padEnd(20)} ${h.engine.padEnd(20)} ${String(h.events).padStart(4)} events  ${h.url}`);
        }
        if (EMIT) {
            console.log('\n--- Source-config att lägga i registry.ts ---\n');
            for (const h of newHits) {
                console.log(`    {`);
                console.log(`        id: '${slugify(h.kommun)}',`);
                console.log(`        hostName: '${h.kommun} Kommun',`);
                console.log(`        region: '${slugify(h.kommun)}',`);
                console.log(`        engine: '${h.engine.includes('tribe') ? 'wp-rest' : h.engine.split(' ')[0]}',`);
                console.log(`        config: {`);
                if (h.engine.startsWith('wp-rest')) {
                    console.log(`            baseUrl: '${new URL(h.url).origin}',`);
                    console.log(`            variant: '${h.engine.includes('tribe') ? 'tribe' : 'wp-v2'}',`);
                    console.log(`            defaultCity: '${h.kommun}',`);
                } else if (h.engine === 'sitevision') {
                    console.log(`            urls: ['${h.url}'],`);
                    console.log(`            defaultCity: '${h.kommun}',`);
                } else if (h.engine === 'ical') {
                    console.log(`            urls: ['${h.url}'],`);
                }
                console.log(`        },`);
                console.log(`        updateFrequency: 'every-3d',`);
                console.log(`        notes: 'Probe-all ${new Date().toISOString().slice(0,10)}: ${h.events} events.',`);
                console.log(`    },`);
            }
        } else {
            console.log('\nKör med --emit för att printa Source-config att klistra in i registry.ts');
        }
    }

    if (silentSources.length > 0) {
        console.log(`\n🔴 BEFINTLIGA KÄLLOR UTAN SVAR (${silentSources.length}):\n`);
        for (const s of silentSources) {
            console.log(`  ${(s.region || s.hostName).padEnd(20)} ${s.engine.padEnd(15)} ${s.hostName}`);
        }
        console.log('\nDessa svarade INTE i någon probe. Kan ha ändrat URL eller plattform.');
        console.log('Kör "npm run health" för att se om de fortfarande producerar events.');
    }

    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
