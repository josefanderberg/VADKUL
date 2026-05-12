#!/usr/bin/env ts-node
/**
 * VADKUL SCRAPER DASHBOARD
 * Kör med: npm run dashboard
 */

import * as readline from 'readline';
import * as cp from 'child_process';
import * as path from 'path';
import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// ─── ANSI färgkoder ───────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m',
    red: '\x1b[31m', white: '\x1b[37m', gray: '\x1b[90m',
} as const;

const W = process.stdout.columns || 80;

function clr() { process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); }
function c(col: keyof typeof C, txt: string) { return `${C[col]}${txt}${C.reset}`; }
function bold(t: string) { return `${C.bold}${t}${C.reset}`; }
function sep() { return c('gray', `  ${'─'.repeat(W - 4)}`); }

function pad(text: string, w: number) {
    const len = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    return text + ' '.repeat(Math.max(0, w - len));
}

// ─── Global State ─────────────────────────────────────────────────────────────
interface Stats {
    total: number; today: number; week: number;
    bySource: Record<string, number>; updated: string;
}

let stats: Stats = { total: 0, today: 0, week: 0, bySource: {}, updated: 'laddar...' };
let activeJob: { name: string; startedAt: Date } | null = null;
let currentView: 'menu' | 'list' | 'running' = 'menu';

// ─── Statistik ────────────────────────────────────────────────────────────────
async function fetchStats(): Promise<Stats> {
    if (!db) return { total: 0, today: 0, week: 0, bySource: {}, updated: '—' };
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // VIKTIGT: Vi hämtar från linkEvents (externa)
    const snap = await db.collection('linkEvents')
        .where('time', '>=', Timestamp.fromDate(todayStart)).get();

    let today = 0, week = 0;
    const bySource: Record<string, number> = {};
    for (const doc of snap.docs) {
        const d = doc.data();
        const t: Date = d.time?.toDate?.() ?? new Date(0);
        if (t <= todayEnd) today++;
        if (t <= weekEnd) week++;
        const src = d.hostName || d.host?.name || 'Extern';
        bySource[src] = (bySource[src] || 0) + 1;
    }
    return { total: snap.size, today, week, bySource, updated: now.toLocaleTimeString('sv-SE') };
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderHeader() {
    console.log(c('cyan', `\n╔${'═'.repeat(W - 2)}╗`));
    console.log(c('cyan', '║') + pad(c('cyan', bold(' 🎯  VADKUL SCRAPER DASHBOARD')), W - 2) + c('cyan', '║'));
    console.log(c('cyan', '║') + pad(c('gray', '  Hanterar externa events (linkEvents)'), W - 2) + c('cyan', '║'));
    console.log(c('cyan', `╚${'═'.repeat(W - 2)}╝`));
}

function draw(msg?: string) {
    if (currentView !== 'menu') return; // Rör inte skärmen om vi är i en annan vy

    clr();
    renderHeader();

    // Statistik-del
    const col = Math.floor((W - 4) / 3);
    console.log(c('white', `\n  📊  ${bold('EXTERNA EVENTS')}  ${c('gray', `(${stats.updated})`)}`));
    console.log(sep());
    console.log(
        `  ${pad(`${c('green', bold(String(stats.total)))} skrapade event`, col + 12)}` +
        `${pad(`${c('yellow', bold(String(stats.today)))} händer idag`, col + 12)}` +
        `${c('cyan', bold(String(stats.week)))} denna vecka`
    );

    // Jobb-indikator
    if (activeJob) {
        const elapsed = Math.round((Date.now() - activeJob.startedAt.getTime()) / 1000);
        console.log(c('yellow', `\n  ⏳ Bakgrundsjobb: ${activeJob.name} (${elapsed}s)`));
    }

    // Meny-del
    console.log(c('white', `\n  🗂️   ${bold('MENY')}`));
    console.log(sep());
    const items = [
        { k: '1', i: '🔍', l: 'Kör alla scrapers', s: 'Tickster · Upplev · Växjö&Co · Eventbrite' },
        { k: '2', i: '📅', l: 'Scrapa IDAG (hela Sverige)', s: 'Tickster · Eventbrite · Billetto' },
        { k: '3', i: '➕', l: 'Skapa event manuellt', s: 'Lägg till i huvudlistan (events)' },
        { k: '4', i: '📋', l: 'Lista externa events', s: 'Visar innehållet i linkEvents' },
        { k: '5', i: '🗑️ ', l: 'Rensa utgångna externa', s: 'Tar bort gamla skrapade event' },
        { k: '6', i: '🔄', l: 'Uppdatera statistik', s: '' },
        { k: '7', i: '📱', l: 'Publicera till Facebook', s: 'Postar dagens events till FB' },
        { k: '8', i: '👥', l: 'Skrapa Facebook (Live)', s: 'Loggar in och skrapar grupper' },
        { k: 'q', i: '❌', l: 'Avsluta', s: '' },
    ];
    for (const x of items) {
        console.log(`  ${c('cyan', bold(` [${x.k}] `))} ${x.i} ${pad(bold(x.l), 32)} ${c('gray', x.s)}`);
    }
    console.log(sep());

    if (msg) console.log(`\n  ${msg}`);
    process.stdout.write(c('cyan', '\n  → Ditt val: '));
}

// ─── Visa events ──────────────────────────────────────────────────────────────
async function listEvents() {
    currentView = 'list';
    clr();
    renderHeader();
    console.log(c('dim', '\n  ⏳ Hämtar lista från Firestore...'));

    if (!db) { console.log(c('red', '  ❌ Ingen FB-koppling.')); return; }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    // HÄMTA FRÅN linkEvents
    const snap = await db.collection('linkEvents')
        .where('time', '>=', Timestamp.fromDate(todayStart))
        .orderBy('time', 'asc').limit(40).get();

    clr();
    renderHeader();
    console.log(c('cyan', `\n  📋 Kommande externa event (${snap.size}):\n`));

    if (snap.empty) {
        console.log(c('dim', '  Inga externa event hittades i linkEvents.'));
    } else {
        console.log(c('gray', `  ${'Titel'.padEnd(30)} ${'Datum'.padEnd(13)} ${'Plats'.padEnd(20)} Källa`));
        console.log(sep());
        for (const doc of snap.docs) {
            const d = doc.data();
            const t: Date = d.time?.toDate?.() ?? new Date();
            const isToday = t.toDateString() === new Date().toDateString();
            const dateStr = t.toLocaleDateString('sv-SE', { weekday: 'short', month: 'short', day: 'numeric' });
            console.log(
                `  ${c(isToday ? 'green' : 'white', (d.title || '').slice(0, 28).padEnd(28))}` +
                `  ${c('yellow', dateStr.padEnd(12))}` +
                `  ${c('dim', (d.locationName || '').slice(0, 18).padEnd(18))}` +
                `  ${c('gray', (d.hostName || d.host?.name || 'Extern').slice(0, 14))}`
            );
        }
    }
    console.log('\n' + sep());
    console.log(c('gray', '\n  Tryck valfri tangent för att gå tillbaka till menyn...'));
}

// ─── Kör bakgrundsjobb ────────────────────────────────────────────────────────
function runBackground(script: string, label: string, onDone: (saved: number) => void) {
    const dir = path.resolve(__dirname, '../../');
    activeJob = { name: label, startedAt: Date.now() as any };

    let output = '';
    const child = cp.spawn('npm', ['run', script], {
        cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], shell: true,
    });
    child.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { output += d.toString(); });

    child.on('close', async () => {
        const savedMatches = output.match(/✅ Saved:/g);
        const savedCount = savedMatches ? savedMatches.length : 0;
        activeJob = null;
        onDone(savedCount);
    });
}

// ─── Kör live script (för t.ex. IDAG-skrapan) ─────────────────────────────────
async function runLive(script: string, label: string) {
    currentView = 'running';
    const dir = path.resolve(__dirname, '../../');
    clr(); renderHeader();
    console.log(c('yellow', `\n  ⏳ ${label}\n`));
    console.log(sep());

    if (process.stdin.isTTY) process.stdin.setRawMode(false);

    return new Promise<void>(resolve => {
        const child = cp.spawn('npm', ['run', script], {
            cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], shell: true,
        });
        child.stdout?.on('data', (d: Buffer) => process.stdout.write(d));
        child.stderr?.on('data', (d: Buffer) => process.stdout.write(c('red', d.toString())));
        child.on('close', code => {
            console.log('\n' + sep());
            console.log(code === 0 ? c('green', '\n  ✅ Klar! Tryck valfri tangent...') : c('red', `\n  ❌ Fel (kod ${code}). Tryck valfri tangent...`));
            if (process.stdin.isTTY) process.stdin.setRawMode(true);
            resolve();
        });
    });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    // Starta statistik-laddning
    fetchStats().then(s => { stats = s; draw(); });

    // Uppdatera klockan var 3:e sekund om jobb körs
    setInterval(() => { if (activeJob && currentView === 'menu') draw(); }, 3000);

    process.stdin.on('keypress', async (ch, key) => {
        if (key?.ctrl && key?.name === 'c') process.exit(0);

        // Om vi är i en sub-vy, gå bara tillbaka till menyn
        if (currentView !== 'menu') {
            currentView = 'menu';
            draw();
            return;
        }

        if (!ch || key?.name === 'return' || key?.name === 'enter') return;
        const k = ch.toLowerCase();

        if (k === 'q') process.exit(0);

        if (k === '1') {
            if (activeJob) return;
            const statsBefore = stats.total;
            runBackground('start', 'Kör alla scrapers', async (saved) => {
                stats = await fetchStats();
                draw(c('green', `✅ Scraping klar! ${saved} event sparade.`));
            });
            draw(c('dim', '⏳ Startar scrapers i bakgrunden...'));
        } else if (k === '2') {
            await runLive('today', 'Scraping IDAG – hela Sverige');
            stats = await fetchStats();
        } else if (k === '4') {
            await listEvents();
        } else if (k === '5') {
            currentView = 'running';
            clr(); renderHeader(); console.log(c('yellow', '\n  🗑️  Rensar gamla event...'));
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const snap = await db!.collection('linkEvents').where('time', '<', Timestamp.fromDate(yesterday)).get();
            if (!snap.empty) {
                const batch = db!.batch();
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            stats = await fetchStats();
            currentView = 'menu';
            draw(c('green', `✅ Rensning klar. Tog bort ${snap.size} event.`));
        } else if (k === '6' || k === 'r') {
            stats = await fetchStats();
            draw(c('green', '✅ Statistik uppdaterad!'));
        } else if (k === '7') {
            await runLive('publish-fb', 'Publicerar till Facebook');
        } else if (k === '8') {
            await runLive('scrape-fb', 'Facebook-skrapning (Webbläsare öppnas)');
            stats = await fetchStats();
            draw(c('green', '✅ Facebook-skrapning klar!'));
        } else {
            draw();
        }
    });
}

main().catch(err => console.error(err));
