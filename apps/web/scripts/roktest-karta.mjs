// RÖKTEST för kartan (efter prodstoppet 25/9): bygger förutsätts gjort —
// skriptet startar den byggda sajten (next start) och låter en riktig
// headless Chromium ladda kartsidan. Det som tsc/vitest/bygget ALDRIG ser
// fångas här: worker-filer som inte skeppats, modulskript som får HTML,
// kartmotorn som inte bootar. Grönt kräver:
//
//   1. maplibre-workern begärs och svarar 200 med JS-MIME
//   2. inga worker-/modulskriptfel i konsolen
//   3. maplibre-canvasen finns i DOM:en
//
// Körs i CI (typecheck.yml, jobbet "Röktest karta") på varje PR — ett fel
// här är ett riktigt prodfel som stoppas FÖRE merge. Lokalt:
//   cd apps/web && npm run build && node scripts/roktest-karta.mjs
//
// Chromium: CHROME_PATH om satt, annars kända platser (GitHub-runnerns
// google-chrome, molncontainerns /opt/pw-browsers/chromium).
import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { chromium } from 'playwright-core';

const PORT = 3100;
const URL = `http://localhost:${PORT}/?plats=stockholm`;

function hittaChrome() {
    if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    for (const p of ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']) {
        if (existsSync(p)) return p;
    }
    try { return execSync('which google-chrome || which chromium', { encoding: 'utf8' }).trim(); } catch { /* nedan */ }
    throw new Error('Ingen Chromium hittad — sätt CHROME_PATH.');
}

// next start mot den byggda .next-mappen. Egen port (3100) — aldrig dev-3000.
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
});
let serverUppe = false;
server.stdout.on('data', (d) => { if (String(d).includes('Ready')) serverUppe = true; });
server.stderr.on('data', () => { /* SSR-brus utan Firebase-env är väntat */ });

const dödaServern = () => { try { process.kill(-server.pid, 'SIGKILL'); } catch { try { server.kill('SIGKILL'); } catch { /* redan död */ } } };
process.on('exit', dödaServern);

const start = Date.now();
while (!serverUppe && Date.now() - start < 60000) await new Promise(r => setTimeout(r, 500));
if (!serverUppe) { console.error('RÖKTEST RÖTT: next start blev aldrig redo'); process.exit(1); }

const browser = await chromium.launch({
    executablePath: hittaChrome(),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-proxy-server', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 420, height: 850 } });

const workerSvar = [];
const dödsfel = [];
page.on('response', (r) => {
    if (/maplibre-gl-(worker|shared)/.test(r.url())) {
        workerSvar.push({ url: r.url(), status: r.status(), typ: r.headers()['content-type'] ?? '' });
    }
});
const DÖDSMÖNSTER = /worker failed|failed to load module script|non-javascript mime|importerror|maplibre/i;
page.on('pageerror', (e) => { if (DÖDSMÖNSTER.test(String(e))) dödsfel.push(String(e)); });
page.on('console', (m) => { if (m.type() === 'error' && DÖDSMÖNSTER.test(m.text())) dödsfel.push(m.text()); });

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(15000); // kartboot: stil, worker, första kaklen

const canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas.maplibregl-canvas');
    return c ? { w: c.width, h: c.height } : null;
});

await browser.close();
dödaServern();

const workerOk = workerSvar.some(s => s.url.includes('worker') && s.status === 200 && /javascript|ecmascript/.test(s.typ));
const sharedOk = workerSvar.some(s => s.url.includes('shared') && s.status === 200 && /javascript|ecmascript/.test(s.typ));

console.log('worker-/shared-svar:', workerSvar.length ? JSON.stringify(workerSvar) : 'INGA BEGÄRDA');
console.log('kartfel i konsolen:', dödsfel.length ? dödsfel.slice(0, 5).join(' | ') : 'inga');
console.log('maplibre-canvas:', canvas ? `${canvas.w}x${canvas.h}` : 'SAKNAS');

if (!workerOk || !sharedOk || dödsfel.length > 0 || !canvas) {
    console.error('RÖKTEST RÖTT — det här hade varit en död karta i prod.');
    process.exit(1);
}
console.log('RÖKTEST GRÖNT — kartan bootar i riktig webbläsare.');
process.exit(0);
