/**
 * Import-sitemap-hits: läser probe-sitemap-output (text) och plockar de
 * Source-configs för kandidater som:
 *   1. Inte redan finns i registry.ts (matchas på id)
 *   2. Har minst MIN_URLS event-URLs (default 30) — annars är det tomt
 *
 * Skriver kandidaternas Source-block (inkl. lastVerified-datum från idag) som
 * en TS-snippet på stdout, redo att klistras in i registry.ts.
 *
 * Användning:
 *   npx ts-node src/scripts/import-sitemap-hits.ts <probe-output-path> [--min=30]
 *
 * Ej automatiskt: vi vill att människa scrollar genom output och spot-checkar
 * varje rad innan klistring.
 */

import * as fs from 'fs';
import { SOURCES } from '../sources/registry';

interface ParsedConfig {
    id: string;
    hostName: string;
    region: string;
    engine: string;
    config: string;   // hela config-blocket som rå TS-text
    notes: string;
    urlCount: number;
}

function parseArgs(): { input: string; min: number } {
    let input = '';
    let min = 30;
    for (const a of process.argv.slice(2)) {
        if (a.startsWith('--min=')) min = parseInt(a.slice(6), 10);
        else if (!a.startsWith('--')) input = a;
    }
    if (!input) {
        console.error('Användning: import-sitemap-hits.ts <probe-output-path> [--min=30]');
        process.exit(1);
    }
    return { input, min };
}

/**
 * Extraherar `{...}` Source-block ur probe-sitemap-output. Probe-skriptet
 * emit:ar strikt format så vi kan regex:a bracket-balansering enkelt.
 */
function extractSourceBlocks(raw: string): string[] {
    const blocks: string[] = [];
    const lines = raw.split('\n');
    let in_ = false;
    let depth = 0;
    let buf: string[] = [];
    for (const line of lines) {
        if (!in_ && /^\s{4}\{\s*$/.test(line)) {
            in_ = true; depth = 1; buf = [line];
            continue;
        }
        if (in_) {
            buf.push(line);
            for (const ch of line) {
                if (ch === '{') depth++;
                else if (ch === '}') depth--;
            }
            if (depth === 0) {
                blocks.push(buf.join('\n'));
                in_ = false; buf = [];
            }
        }
    }
    return blocks;
}

/**
 * Plockar id, hostName, region + URL-count ur ett source-block.
 */
function parseBlock(block: string): ParsedConfig | null {
    const id = block.match(/id:\s*'([^']+)'/)?.[1];
    const hostName = block.match(/hostName:\s*'([^']+)'/)?.[1];
    const region = block.match(/region:\s*'([^']+)'/)?.[1];
    const engine = block.match(/engine:\s*'([^']+)'/)?.[1];
    const notes = block.match(/notes:\s*'([^']+)'/)?.[1] || '';
    if (!id || !hostName || !region || !engine) return null;
    const urlCountMatch = notes.match(/(\d+)\s+event-URLs/);
    const urlCount = urlCountMatch ? parseInt(urlCountMatch[1], 10) : 0;
    // Plocka config-blocket (allt mellan "config: {" och matchande "}")
    const cfgStart = block.indexOf('config: {');
    if (cfgStart < 0) return null;
    let depth = 1, i = cfgStart + 'config: {'.length;
    while (i < block.length && depth > 0) {
        if (block[i] === '{') depth++;
        else if (block[i] === '}') depth--;
        i++;
    }
    const config = block.slice(cfgStart + 'config: '.length, i);
    return { id, hostName, region, engine, config, notes, urlCount };
}

function main() {
    const { input, min } = parseArgs();
    const raw = fs.readFileSync(input, 'utf8');
    const blocks = extractSourceBlocks(raw);
    const parsed = blocks.map(parseBlock).filter((p): p is ParsedConfig => p !== null);

    const existingIds = new Set(SOURCES.map(s => s.id));
    const today = new Date().toISOString().slice(0, 10);

    const newCandidates = parsed
        .filter(p => !existingIds.has(p.id))
        .filter(p => p.urlCount >= min)
        .sort((a, b) => b.urlCount - a.urlCount);

    console.error(`Hittade ${parsed.length} parseable source-blocks i input.`);
    console.error(`Av dem ${parsed.filter(p => !existingIds.has(p.id)).length} är NYA (inte i registry).`);
    console.error(`Med min=${min}: ${newCandidates.length} kandidater att lägga in.`);
    console.error('');

    // Föreslå updateFrequency baserat på volym
    function freq(count: number): string {
        if (count >= 200) return 'daily';
        if (count >= 50) return 'every-3d';
        return 'weekly';
    }

    for (const p of newCandidates) {
        console.log(`    {`);
        console.log(`        id: '${p.id}',`);
        console.log(`        hostName: '${p.hostName}',`);
        console.log(`        region: '${p.region}',`);
        console.log(`        engine: '${p.engine}',`);
        console.log(`        config: ${p.config.trim().replace(/\n/g, '\n        ')},`);
        console.log(`        updateFrequency: '${freq(p.urlCount)}',`);
        console.log(`        notes: '${p.notes}',`);
        console.log(`        lastVerified: '${today}',`);
        console.log(`    },`);
    }
}

main();
