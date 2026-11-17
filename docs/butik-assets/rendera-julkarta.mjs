#!/usr/bin/env node
/**
 * Ritar en App Store-bild (header / sökträff) av VADKUL-kartan full av
 * julmarknader: webbens egen kartstil (fetchAndTransformThemeParkStyle) mot
 * EGNA Protomaps-kakel (pmtiles serve, samma licensväg som stadssidornas
 * kartbilder - docs/kartbilder.md) och 🎄-brickorna ritade med webbens egen
 * makeBrickaImageData i full upplösning. Ingen dev-server. Bilderna i
 * app-store-jul-2026/ gjordes så här 17/11 2026 (#192).
 *
 * Förberedelser (i en tom arbetsmapp, inte i repot):
 *   brew install pmtiles
 *   pmtiles extract https://build.protomaps.com/20261113.pmtiles tiles/gbg.pmtiles --bbox=10.6,57.2,13.4,58.2 --maxzoom=13
 *   ssh mini 'cd ~/Repos/VADKUL/apps/scraper && sqlite3 -json events.db "select title, time, lat, lng from link_events
 *     where lower(title) like \"%julmarkn%\" or lower(title) like \"%julbasar%\" ..."' > jul.json
 *
 * Kör från arbetsmappen (node v22.18+, kör cartoTiles.ts direkt):
 *   node <repo>/docs/butik-assets/rendera-julkarta.mjs --lat=57.70 --lng=11.93 --zoom=8.8 --size=0.85 --out=header.jpg
 *   --w/--h = bildens pixlar, --dpr = skärpa (6 för 3840 bred, 3 för 1920), --size = brickstorlek mot webbens,
 *   --data/--tiles/--tileset = jul.json, tiles/, gbg som standard.
 * Etiketterna byts från name:en till name:sv (Voyager visar annars "Gothenburg").
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HÄR = dirname(fileURLToPath(import.meta.url));
const ROT = '/Users/josefanderberg/source/VADKUL';
const WEB = join(ROT, 'apps/web');
const req = createRequire(join(ROT, 'package.json'));
const esbuild = req('esbuild');
const puppeteer = req('puppeteer');
const { isCartoTileUrl } = await import(join(WEB, 'src/utils/cartoTiles.ts'));

const arg = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const LAT = Number(arg.lat ?? 57.70);
const LNG = Number(arg.lng ?? 11.97);
const ZOOM = Number(arg.zoom ?? 9.5);
const PX_W = Number(arg.w ?? 3840);
const PX_H = Number(arg.h ?? 1646);
const DPR = Number(arg.dpr ?? 6);
const STORLEK = Number(arg.size ?? 1);
const UT = arg.out ?? 'ut.jpg';
// Hela css-pixlar (Chrome avrundar klippet nedåt); sips beskär till exakt mått.
const CSS_W = Math.ceil(PX_W / DPR);
const CSS_H = Math.ceil(PX_H / DPR);
const KAKEL_PORT = 8099;
const SIDA_PORT = 8098;
const KAKEL = `http://localhost:${KAKEL_PORT}/${arg.tileset ?? 'gbg'}/{z}/{x}/{y}.mvt`;

// Julmarknaderna: en punkt per plats, n = antal event där.
const jul = JSON.parse(readFileSync(resolve(arg.data ?? 'jul.json'), 'utf8'));
const perPlats = new Map();
for (const e of jul) {
    const k = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
    const p = perPlats.get(k) ?? { lat: e.lat, lng: e.lng, n: 0 };
    p.n++;
    perPlats.set(k, p);
}
const punkter = {
    type: 'FeatureCollection',
    features: [...perPlats.values()].map(p => ({ type: 'Feature', properties: { n: p.n }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
};

// Webbens brickkod med DPR = sidans, så brickan blir lika skarp som kartan.
const dprPlugin = {
    name: 'bricka-dpr',
    setup(b) {
        b.onLoad({ filter: /v2MapBricka\.ts$/ }, args => {
            const src = readFileSync(args.path, 'utf8');
            if (!src.includes('const DPR = 2.5;')) throw new Error('v2MapBricka: hittade inte DPR-raden');
            return { contents: src.replace('const DPR = 2.5;', `const DPR = ${DPR};`), loader: 'ts' };
        });
    },
};
const bundle = await esbuild.build({
    stdin: {
        contents: `
            import * as maplibregl from 'maplibre-gl';
            import { fetchAndTransformThemeParkStyle } from './components/v2/v2MapBaseStyles';
            import { makeBrickaImageData, GL_ICON_SIZE_STOPS, zoomStopsExpr } from './components/v2/v2MapBricka';
            import { EVENT_CATEGORIES } from './utils/categories';
            window.__r = { maplibregl, fetchAndTransformThemeParkStyle, makeBrickaImageData, GL_ICON_SIZE_STOPS, zoomStopsExpr, EVENT_CATEGORIES };
        `,
        resolveDir: join(WEB, 'src'),
        loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    banner: { js: 'globalThis.process = globalThis.process || { env: {} };' },
    define: { 'process.env.NEXT_PUBLIC_VECTOR_TILES_URL': JSON.stringify(KAKEL), 'process.env.NODE_ENV': '"production"' },
    loader: { '.png': 'empty', '.svg': 'empty', '.jpg': 'empty', '.css': 'empty' },
    nodePaths: [join(ROT, 'node_modules'), join(WEB, 'node_modules')],
    plugins: [dprPlugin],
    logLevel: 'error',
});

const sida = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/maplibre-gl.css">
<style>html,body{margin:0;background:#4e8ab7}#map{width:${CSS_W}px;height:${CSS_H}px}</style>
<div id="map"></div>
<script type="module" src="/bundle.js"></script>
<script type="module">
await new Promise(r => { const t = setInterval(() => { if (window.__r) { clearInterval(t); r(); } }, 20); });
const R = window.__r;
const style = await R.fetchAndTransformThemeParkStyle();
// Voyager tar name:en först ("Gothenburg", "River Göta") - butiksbilden ska ha svenska namn.
for (const l of style.layers) {
    const tf = l.layout && l.layout['text-field'];
    if (tf) l.layout['text-field'] = JSON.parse(JSON.stringify(tf).replaceAll('"name:en"', '"name:sv"'));
}
const map = new R.maplibregl.Map({
    container: 'map', style, center: [${LNG}, ${LAT}], zoom: ${ZOOM},
    attributionControl: false, interactive: false, fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true },
});
map.on('load', () => {
    const punkter = ${JSON.stringify(punkter)};
    const hex = R.EVENT_CATEGORIES.market.markerHex;
    for (const n of new Set(punkter.features.map(f => f.properties.n))) {
        // makeBrickaImageData(emoji, bodyColor, selected, saved, wish, starred, count, gold, pop) - count = +N utöver brickans eget
        const res = R.makeBrickaImageData('🎄', hex, false, false, false, false, n - 1, false, false);
        map.addImage('jul-' + n, res.data, { pixelRatio: res.pixelRatio });
    }
    map.addSource('jul', { type: 'geojson', data: punkter });
    const storlek = R.zoomStopsExpr(R.GL_ICON_SIZE_STOPS.map(([z, v]) => [z, v * ${STORLEK}]));
    map.addLayer({
        id: 'jul', type: 'symbol', source: 'jul',
        layout: { 'icon-image': ['concat', 'jul-', ['to-string', ['get', 'n']]], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-size': storlek, 'symbol-z-order': 'viewport-y' },
    });
    map.once('idle', () => { window.__klar = true; });
    // Reserv: idle uteblir ibland i headless - då räcker laddade kakel + en ritning till.
    const t = setInterval(() => {
        if (map.areTilesLoaded() && map.isStyleLoaded()) { clearInterval(t); map.once('render', () => setTimeout(() => { window.__klar = true; }, 500)); map.triggerRepaint(); }
    }, 1000);
});
map.on('error', e => { window.__fel = String(e.error?.message || e); });
</script>`;

const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const server = http.createServer((rq, rs) => {
    const u = new URL(rq.url, 'http://x');
    if (u.pathname === '/') { rs.writeHead(200, { 'content-type': 'text/html' }); return rs.end(sida); }
    if (u.pathname === '/bundle.js') { rs.writeHead(200, { 'content-type': 'text/javascript' }); return rs.end(bundle.outputFiles[0].text); }
    const fil = u.pathname === '/maplibre-gl.css'
        ? join(WEB, 'node_modules/maplibre-gl/dist/maplibre-gl.css')
        : join(WEB, 'public', decodeURIComponent(u.pathname));
    if (!fil.startsWith(WEB) || !existsSync(fil)) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'content-type': mime[extname(fil)] ?? 'application/octet-stream' });
    rs.end(readFileSync(fil));
});
await new Promise(r => server.listen(SIDA_PORT, r));

const kakelServer = spawn('pmtiles', ['serve', resolve(arg.tiles ?? 'tiles'), `--port=${KAKEL_PORT}`, '--cors=*'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let cartoKakel = 0, egnaKakel = 0;
try {
    const page = await browser.newPage();
    await page.setViewport({ width: Math.ceil(CSS_W), height: Math.ceil(CSS_H), deviceScaleFactor: DPR });
    await page.setRequestInterception(true);
    page.on('request', r => {
        // Licensvakten: inget kartinnehåll från CARTO (bara stil, sprite, typsnitt).
        if (isCartoTileUrl(r.url())) { cartoKakel++; return r.abort(); }
        if (r.url().startsWith(`http://localhost:${KAKEL_PORT}/`)) egnaKakel++;
        r.continue();
    });
    page.on('pageerror', e => console.error('sidfel:', e.message));
    await page.goto(`http://localhost:${SIDA_PORT}/`);
    await page.waitForFunction('window.__klar || window.__fel', { timeout: 120000 });
    const fel = await page.evaluate('window.__fel');
    if (fel) throw new Error(`kartfel: ${fel}`);
    if (cartoKakel) throw new Error(`licensvakten: ${cartoKakel} kakel från CARTO - sparar inget`);
    if (!egnaKakel) throw new Error('inga egna kakel hämtades');
    const typ = UT.endsWith('.png') ? 'png' : 'jpeg';
    const bild = await page.screenshot({ type: typ, ...(typ === 'jpeg' ? { quality: 95 } : {}), clip: { x: 0, y: 0, width: CSS_W, height: CSS_H } });
    writeFileSync(resolve(UT), bild);
    if (CSS_W * DPR !== PX_W || CSS_H * DPR !== PX_H) {
        const { execFileSync } = await import('node:child_process');
        execFileSync('sips', ['--cropToHeightWidth', String(PX_H), String(PX_W), '-s', 'formatOptions', '95', resolve(UT)], { stdio: 'ignore' });
    }
    console.log(`${UT}: ${perPlats.size} platser, ${egnaKakel} egna kakel, 0 från CARTO`);
} finally {
    await browser.close();
    kakelServer.kill();
    server.close();
}
