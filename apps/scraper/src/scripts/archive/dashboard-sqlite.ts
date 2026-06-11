#!/usr/bin/env ts-node
/**
 * VADKUL SQLITE DASHBOARD (OFFLINE)
 * Kör med: npm run dashboard:sqlite
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as readline from 'readline';

// ANSI färgkoder
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m',
    red: '\x1b[31m', white: '\x1b[37m', gray: '\x1b[90m',
} as const;

const W = 80;

function clr() { process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); }
function c(col: keyof typeof C, txt: string) { return `${C[col]}${txt}${C.reset}`; }
function bold(t: string) { return `${C.bold}${t}${C.reset}`; }
function sep() { return c('gray', `  ${'─'.repeat(W - 4)}`); }

function pad(text: string, w: number) {
    const len = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    return text + ' '.repeat(Math.max(0, w - len));
}

const dbPath = path.resolve(__dirname, '../../events.db');
if (!fs.existsSync(dbPath)) {
    console.error(c('red', `❌ Hittade inte SQLite-databasen på: ${dbPath}`));
    console.error(c('yellow', 'Starta webbservern först eller kör en build för att auto-seeda databasen.'));
    process.exit(1);
}

const db = new Database(dbPath);

interface Stats {
    total: number;
    today: number;
    week: number;
    bySource: Record<string, number>;
    updated: string;
}

function fetchStats(): Stats {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const todayStartIso = todayStart.toISOString();
    const todayEndIso = todayEnd.toISOString();
    const weekEndIso = weekEnd.toISOString();

    // 1. Totalt skrapade framtida event
    const totalRow = db.prepare('SELECT COUNT(*) AS count FROM link_events WHERE time >= ?').get(todayStartIso) as any;
    const total = totalRow?.count || 0;

    // 2. Idag
    const todayRow = db.prepare('SELECT COUNT(*) AS count FROM link_events WHERE time >= ? AND time <= ?').get(todayStartIso, todayEndIso) as any;
    const today = todayRow?.count || 0;

    // 3. Denna vecka
    const weekRow = db.prepare('SELECT COUNT(*) AS count FROM link_events WHERE time >= ? AND time <= ?').get(todayStartIso, weekEndIso) as any;
    const week = weekRow?.count || 0;

    // 4. Per källa
    const sourceRows = db.prepare('SELECT hostName, COUNT(*) AS count FROM link_events WHERE time >= ? GROUP BY hostName').all(todayStartIso) as any[];
    const bySource: Record<string, number> = {};
    for (const r of sourceRows) {
        bySource[r.hostName || 'Extern'] = r.count;
    }

    return {
        total,
        today,
        week,
        bySource,
        updated: now.toLocaleTimeString('sv-SE')
    };
}

function listEvents() {
    clr();
    renderHeader();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    const rows = db.prepare('SELECT * FROM link_events WHERE time >= ? ORDER BY time ASC LIMIT 30').all(todayStartIso) as any[];

    console.log(c('cyan', `\n  📋 Kommande lokala SQLite-event (visar de närmsta ${rows.length}):\n`));

    if (rows.length === 0) {
        console.log(c('dim', '  Inga framtida event hittades i SQLite-databasen.'));
    } else {
        console.log(c('gray', `  ${'Titel'.padEnd(28)} ${'Datum'.padEnd(12)} ${'Plats'.padEnd(18)} ${'Deltagare'.padEnd(10)} Källa`));
        console.log(sep());
        for (const d of rows) {
            const t = new Date(d.time);
            const isToday = t.toDateString() === new Date().toDateString();
            const dateStr = t.toLocaleDateString('sv-SE', { weekday: 'short', month: 'short', day: 'numeric' });
            console.log(
                `  ${c(isToday ? 'green' : 'white', (d.title || '').slice(0, 26).padEnd(26))}` +
                `  ${c('yellow', dateStr.padEnd(11))}` +
                `  ${c('dim', (d.locationName || '').slice(0, 16).padEnd(16))}` +
                `  ${c('cyan', String(d.attendees || 0).padEnd(9))}` +
                `  ${c('gray', (d.hostName || 'Extern').slice(0, 12))}`
            );
        }
    }
    console.log('\n' + sep());
    console.log(c('gray', '\n  Tryck valfri tangent för att gå tillbaka till menyn...'));
}

function renderHeader() {
    console.log(c('cyan', `\n╔${'═'.repeat(W - 2)}╗`));
    console.log(c('cyan', '║') + pad(c('cyan', bold(' 🎯  VADKUL SQLITE DASHBOARD (OFFLINE)')), W - 2) + c('cyan', '║'));
    console.log(c('cyan', '║') + pad(c('gray', '  Läser direkt från den lokala events.db-filen'), W - 2) + c('cyan', '║'));
    console.log(c('cyan', `╚${'═'.repeat(W - 2)}╝`));
}

let stats = fetchStats();
let currentView: 'menu' | 'list' = 'menu';

function draw(msg?: string) {
    if (currentView !== 'menu') return;

    clr();
    renderHeader();

    const col = Math.floor((W - 4) / 3);
    console.log(c('white', `\n  📊  ${bold('LOKALA EVENT (SQLITE)')}  ${c('gray', `(${stats.updated})`)}`));
    console.log(sep());
    console.log(
        `  ${pad(`${c('green', bold(String(stats.total)))} aktiva event`, col + 12)}` +
        `${pad(`${c('yellow', bold(String(stats.today)))} händer idag`, col + 12)}` +
        `${c('cyan', bold(String(stats.week)))} denna vecka`
    );

    // Källfördelning
    console.log(c('white', `\n  🔌  ${bold('KÄLLOR')}`));
    console.log(sep());
    const sources = Object.entries(stats.bySource);
    if (sources.length === 0) {
        console.log(c('dim', '      Inga källor tillgängliga.'));
    } else {
        for (const [src, count] of sources) {
            console.log(`      ${c('white', src.padEnd(20))}: ${c('green', bold(String(count)))} event`);
        }
    }

    // Meny-del
    console.log(c('white', `\n  🗂️   ${bold('MENY')}`));
    console.log(sep());
    const items = [
        { k: '1', i: '📋', l: 'Lista SQLite-event', s: 'Visar innehållet i link_events' },
        { k: '2', i: '🔄', l: 'Uppdatera statistik', s: 'Laddar om data från filen' },
        { k: 'q', i: '❌', l: 'Avsluta', s: '' },
    ];
    for (const x of items) {
        console.log(`  ${c('cyan', bold(` [${x.k}] `))} ${x.i} ${pad(bold(x.l), 32)} ${c('gray', x.s)}`);
    }
    console.log(sep());

    if (msg) console.log(`\n  ${msg}`);
    process.stdout.write(c('cyan', '\n  → Ditt val: '));
}

async function main() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    draw();

    process.stdin.on('keypress', (ch, key) => {
        if (key?.ctrl && key?.name === 'c') process.exit(0);

        if (currentView !== 'menu') {
            currentView = 'menu';
            stats = fetchStats();
            draw();
            return;
        }

        if (!ch) return;
        const k = ch.toLowerCase();

        if (k === 'q') process.exit(0);

        if (k === '1') {
            currentView = 'list';
            listEvents();
        } else if (k === '2' || k === 'r') {
            stats = fetchStats();
            draw(c('green', '✅ Statistik uppdaterad!'));
        } else {
            draw();
        }
    });
}

main().catch(err => console.error(err));
