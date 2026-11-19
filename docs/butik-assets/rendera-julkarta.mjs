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
 *   --kant = vit kant runt brickorna i css-px (0 = ingen), med skugga under. Gröna brickor
 *   på grön karta flöt ihop (Josef 18/11: "lite svårt att se dem"), därför 2.5 som standard.
 *   --text = kort fras i en pratbubbla (Fredoka), --tx/--ty = mitten i bildens pixlar,
 *   --ts = textstorlek i bildens pixlar. Håll den inom Apples "art safe area".
 *
 * JULTEMAT (--jul=1, Josef 18/11: "rött tema och lite snöflingor som glittrar ... några av
 * de molnen vi har på kartan ... extra brickor med tomtar och paket med röd bakgrund ...
 * Det blir lite för grönt och blått"):
 *   kartan blir vinterblek (grönt -> snö, blått -> isgrått), granarna mörkgröna, paketen gula,
 *   tomtarna röda, texten i en röd bubbla, glittrande snöflingor framför allt och kartans egna moln (v2MapClouds).
 *   --extra = "🎅:x,y;🎁:x,y" extra brickor i bildens pixlar (illustration, inga event).
 *   --farger = "🎄:#hex;🎁:#hex" brickfärg per emoji (granar mörkgröna, paket gula som standard).
 *   --ort = "Göteborg:x,y,storlek" ortnamn i kartstil ovanpå brickorna, i bildens pixlar.
 *   --moln = "x,y,bredd,form;..." i bildens pixlar, form = index bland molnformerna.
 *   --sno = antal snöflingor, --fro = slumpfrö.
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

const arg = Object.fromEntries(process.argv.slice(2).map(a => {
    const i = a.indexOf('=');
    return i < 0 ? [a.replace(/^--/, ''), '1'] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
const LAT = Number(arg.lat ?? 57.70);
const LNG = Number(arg.lng ?? 11.97);
const ZOOM = Number(arg.zoom ?? 9.5);
const PX_W = Number(arg.w ?? 3840);
const PX_H = Number(arg.h ?? 1646);
const DPR = Number(arg.dpr ?? 6);
const STORLEK = Number(arg.size ?? 1);
const UT = arg.out ?? 'ut.jpg';
const KANT = Number(arg.kant ?? 2.5);
const TEXT = arg.text ?? '';
const TX = Number(arg.tx ?? PX_W / 2);
const TY = Number(arg.ty ?? PX_H / 2);
const TS = Number(arg.ts ?? 110);
const JUL = arg.jul === '1';
const RÖD = '#d62839';
const BRICKFÄRG = arg.brickfarg ?? (JUL ? RÖD : null);
// Egen brickfärg per emoji, "🎄:#hex;🎁:#hex". Josef 18/11: "julgranarna kan vara
// mörkgröna, och paketen kanske gula" - tomtarna behåller den röda.
const FÄRG_PER_EMOJI = {
    ...(JUL ? { '🎄': '#145a32', '🎁': '#f2b705' } : {}),
    ...Object.fromEntries((arg.farger ?? '').split(';').map(x => x.trim()).filter(Boolean).map(x => x.split(':'))),
};
const TEXT_BG = arg.textbg ?? (JUL ? RÖD : '#fff');
const TEXT_FÄRG = arg.textfarg ?? (JUL ? '#fff' : '#006AA7');
const tolka = s => (s ?? '').split(';').map(x => x.trim()).filter(Boolean);
const EXTRA = tolka(arg.extra).map(x => { const [e, p] = x.split(':'); const [ex, ey] = p.split(',').map(Number); return { e, x: ex, y: ey }; });
// Ortnamn ovanpå brickorna, "Göteborg:x,y,storlek" i bildens pixlar. Kartans egen
// Göteborg-etikett göms under brickklustret (Josef 18/11: "skriv göteborg större med,
// så man ser att det är en karta och var").
const ORTER = tolka(arg.ort).map(x => { const [namn, p] = x.split(':'); const [ox, oy, os] = p.split(',').map(Number); return { namn: namn.replace(/[<>&]/g, ''), x: ox, y: oy, s: os || 90 }; });
const MOLN = tolka(arg.moln).map(x => x.split(',').map(Number));
const SNÖ = Number(arg.sno ?? (JUL ? 46 : 0));
const FRÖ = Number(arg.fro ?? 1225);
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
    features: [...perPlats.values()].map(p => ({ type: 'Feature', properties: { n: p.n, e: '🎄' }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
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
            import { makeBrickaImageData, GL_ICON_SIZE_STOPS, zoomStopsExpr, interpolateZoomStops } from './components/v2/v2MapBricka';
            import { makeSprite, makeShadowSprite, SPRITE_PUFFS, TOP_PUFFS, SPRITE_W, SPRITE_H, SIDE_ANCHOR_Y } from './components/v2/v2MapClouds';
            import { EVENT_CATEGORIES } from './utils/categories';
            window.__r = { maplibregl, fetchAndTransformThemeParkStyle, makeBrickaImageData, GL_ICON_SIZE_STOPS, zoomStopsExpr, interpolateZoomStops, EVENT_CATEGORIES,
                makeSprite, makeShadowSprite, SPRITE_PUFFS, TOP_PUFFS, SPRITE_W, SPRITE_H, SIDE_ANCHOR_Y };
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

const lager = `position:absolute;left:0;top:0;width:${CSS_W}px;height:${CSS_H}px;pointer-events:none`;
const sida = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/maplibre-gl.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Montserrat:wght@700&display=block">
<style>html,body{margin:0;background:#4e8ab7}#map{width:${CSS_W}px;height:${CSS_H}px}
#text{position:absolute;left:${TX / DPR}px;top:${TY / DPR}px;transform:translate(-50%,-50%);white-space:nowrap;
  font:700 ${TS / DPR}px/1 Fredoka,sans-serif;color:${TEXT_FÄRG};letter-spacing:-0.01em;background:${TEXT_BG};
  padding:${TS * 0.28 / DPR}px ${TS * 0.5 / DPR}px ${TS * 0.32 / DPR}px;border-radius:${TS / DPR}px;
  ${JUL ? `border:${TS * 0.045 / DPR}px solid #fff;` : ''}
  box-shadow:0 ${TS * 0.06 / DPR}px ${TS * 0.25 / DPR}px rgba(${JUL ? '90,10,20' : '0,40,80'},.35)}
.ort{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-family:Montserrat,sans-serif;font-weight:700;
  color:#2c3e55;letter-spacing:0.02em;line-height:1}</style>
<div id="map"></div>
<canvas id="moln" width="${PX_W}" height="${PX_H}" style="${lager}"></canvas>
${ORTER.map(o => {
    // Kartetikett: mörk text i en tjock vit gloria (ring av skuggor) som i kartstilen, fast större.
    const f = o.s / DPR, g = f * 0.13;
    const ring = Array.from({ length: 16 }, (_, i) => { const v = i / 16 * Math.PI * 2; return `${(Math.cos(v) * g).toFixed(2)}px ${(Math.sin(v) * g).toFixed(2)}px 0 #fff`; });
    return `<div class="ort" style="left:${o.x / DPR}px;top:${o.y / DPR}px;font-size:${f}px;text-shadow:${ring.join(',')},0 0 ${f * 0.35}px rgba(255,255,255,.9)">${o.namn}</div>`;
}).join('\n')}
${TEXT ? `<div id="text">${TEXT.replace(/[<>&]/g, '')}</div>` : ''}
<canvas id="sno" width="${PX_W}" height="${PX_H}" style="${lager}"></canvas>
<script type="module" src="/bundle.js"></script>
<script type="module">
await new Promise(r => { const t = setInterval(() => { if (window.__r) { clearInterval(t); r(); } }, 20); });
const R = window.__r;
const JUL = ${JUL};
const style = await R.fetchAndTransformThemeParkStyle();
// Voyager tar name:en först ("Gothenburg", "River Göta") - butiksbilden ska ha svenska namn.
for (const l of style.layers) {
    const tf = l.layout && l.layout['text-field'];
    if (tf) l.layout['text-field'] = JSON.parse(JSON.stringify(tf).replaceAll('"name:en"', '"name:sv"'));
}

// Vinterkartan: varje färg i ytor och linjer räknas om efter sin kulör. Grönt blir
// snö (ljushetsskillnaden mellan skog och fält finns kvar, svagt), blått blir isgrått,
// vita vägar blir varmt grå så de syns mot snön. Etiketterna lämnas orörda.
const tolk = document.createElement('canvas').getContext('2d');
const hsl = c => {
    tolk.fillStyle = '#000'; tolk.fillStyle = c;
    const v = tolk.fillStyle;
    let r, g, b, a = 1;
    if (v[0] === '#') { r = parseInt(v.slice(1, 3), 16); g = parseInt(v.slice(3, 5), 16); b = parseInt(v.slice(5, 7), 16); }
    else { [r, g, b, a = 1] = v.match(/[\\d.]+/g).map(Number); }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    let h = 0, s = 0;
    if (d) {
        s = d / (1 - Math.abs(2 * l - 1));
        h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }
    return { h, s, l, a };
};
const kläm = (x, a, b) => Math.min(b, Math.max(a, x));
const ut = (h, s, l, a) => 'hsla(' + h.toFixed(1) + ',' + (s * 100).toFixed(1) + '%,' + (l * 100).toFixed(1) + '%,' + a + ')';
const vinter = (c, typ) => {
    const { h, s, l, a } = hsl(c);
    const blå = h >= 180 && h <= 255 && s > 0.12;
    const grön = h >= 55 && h < 180 && s > 0.08;
    if (blå) return ut(208, 0.2, kläm(0.72 + (l - 0.45) * 0.25, 0.64, 0.8), a);
    if (typ === 'line' && l > 0.82) return ut(20, 0.14, 0.8, a);
    if (grön) return ut(32, 0.14, kläm(0.9 + (l - 0.5) * 0.3, 0.82, 0.96), a);
    return ut(h, s * 0.3, kläm(0.85 + l * 0.1, 0.8, 0.96), a);
};
const färgord = /#[0-9a-fA-F]{3,8}\\b|rgba?\\([^)]*\\)|hsla?\\([^)]*\\)/g;
if (JUL) {
    for (const l of style.layers) {
        if (!l.paint || !['fill', 'background', 'line', 'fill-extrusion'].includes(l.type)) continue;
        for (const [k, v] of Object.entries(l.paint)) {
            if (!k.endsWith('-color')) continue;
            if (typeof v === 'string' && !färgord.test(v)) { färgord.lastIndex = 0; l.paint[k] = vinter(v, l.type); continue; }
            färgord.lastIndex = 0;
            l.paint[k] = JSON.parse(JSON.stringify(v).replace(färgord, m => vinter(m, l.type)));
        }
    }
}

const map = new R.maplibregl.Map({
    container: 'map', style, center: [${LNG}, ${LAT}], zoom: ${ZOOM},
    attributionControl: false, interactive: false, fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true },
});
map.on('load', () => {
    const punkter = ${JSON.stringify(punkter)};
    // Extra brickor (tomtar, paket) i bildens pixlar -> kartans koordinater.
    for (const x of ${JSON.stringify(EXTRA)}) {
        const p = map.unproject([x.x / ${DPR}, x.y / ${DPR}]);
        punkter.features.push({ type: 'Feature', properties: { n: 1, e: x.e }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } });
    }
    const hex = ${JSON.stringify(BRICKFÄRG)} ?? R.EVENT_CATEGORIES.market.markerHex;
    // Vit kant + mjuk skugga runt brickan, så den lossnar från kartan.
    const KANT = ${KANT};
    let lyft = 0;
    const medKant = res => {
        if (!KANT) return res;
        const pr = res.pixelRatio, k = KANT * pr, blur = 3 * pr, ned = 1.2 * pr;
        const pad = Math.ceil(k + blur * 1.5 + ned);
        lyft = pad / pr;
        const { width: w, height: h } = res.data;
        const duk = (bw, bh) => { const c = document.createElement('canvas'); c.width = bw; c.height = bh; return c; };
        const original = duk(w, h); original.getContext('2d').putImageData(res.data, 0, 0);
        const siluett = duk(w, h); const s = siluett.getContext('2d');
        s.drawImage(original, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#fff'; s.fillRect(0, 0, w, h);
        const ring = duk(w + pad * 2, h + pad * 2); const r = ring.getContext('2d');
        for (let i = 0; i < 48; i++) {
            const v = i / 48 * Math.PI * 2;
            r.drawImage(siluett, pad + Math.cos(v) * k, pad + Math.sin(v) * k);
        }
        r.drawImage(siluett, pad, pad);
        const ut = duk(w + pad * 2, h + pad * 2); const u = ut.getContext('2d');
        u.shadowColor = JUL ? 'rgba(70,10,20,0.45)' : 'rgba(0,30,20,0.45)'; u.shadowBlur = blur; u.shadowOffsetY = ned;
        u.drawImage(ring, 0, 0);
        u.shadowColor = 'transparent';
        u.drawImage(original, pad, pad);
        return { data: u.getImageData(0, 0, ut.width, ut.height), pixelRatio: pr };
    };
    for (const nyckel of new Set(punkter.features.map(f => f.properties.e + '-' + f.properties.n))) {
        const [e, n] = [nyckel.slice(0, nyckel.lastIndexOf('-')), Number(nyckel.slice(nyckel.lastIndexOf('-') + 1))];
        // makeBrickaImageData(emoji, bodyColor, selected, saved, wish, starred, count, gold, pop) - count = +N utöver brickans eget
        const färg = ${JSON.stringify(FÄRG_PER_EMOJI)}[e] ?? hex;
        const res = medKant(R.makeBrickaImageData(e, färg, false, false, false, false, n - 1, false, false));
        map.addImage(nyckel, res.data, { pixelRatio: res.pixelRatio });
    }
    // Brickornas rutor i bildens pixlar - snön lägger inga flingor över dem.
    {
        const iw = {};
        for (const nyckel of new Set(punkter.features.map(f => f.properties.e + '-' + f.properties.n))) {
            const im = map.getImage(nyckel);
            iw[nyckel] = [im.data.width / im.pixelRatio, im.data.height / im.pixelRatio];
        }
        const sk = R.interpolateZoomStops(R.GL_ICON_SIZE_STOPS, map.getZoom()) * ${STORLEK};
        window.__brickRutor = punkter.features.map(f => {
            const p = map.project(f.geometry.coordinates);
            const [w, h] = iw[f.properties.e + '-' + f.properties.n];
            const bw = w * sk * 0.62, bh = h * sk * 0.8;
            return [(p.x - bw / 2) * ${DPR}, (p.y - bh) * ${DPR}, (p.x + bw / 2) * ${DPR}, p.y * ${DPR}];
        });
    }
    map.addSource('jul', { type: 'geojson', data: punkter });
    const storlek = R.zoomStopsExpr(R.GL_ICON_SIZE_STOPS.map(([z, v]) => [z, v * ${STORLEK}]));
    map.addLayer({
        id: 'jul', type: 'symbol', source: 'jul',
        // icon-offset: spetsen kvar på platsen trots kantens utfyllnad under brickan.
        layout: { 'icon-image': ['concat', ['get', 'e'], '-', ['to-string', ['get', 'n']]], 'icon-anchor': 'bottom', 'icon-offset': [0, lyft], 'icon-allow-overlap': true, 'icon-size': storlek, 'symbol-z-order': 'viewport-y' },
    });
    map.once('idle', () => { window.__klar = true; });
    // Reserv: idle uteblir ibland i headless - då räcker laddade kakel + en ritning till.
    const t = setInterval(() => {
        if (map.areTilesLoaded() && map.isStyleLoaded()) { clearInterval(t); map.once('render', () => setTimeout(() => { window.__klar = true; }, 500)); map.triggerRepaint(); }
    }, 1000);
});
map.on('error', e => { window.__fel = String(e.error?.message || e); });
if (${Boolean(arg.debug)}) setInterval(() => console.log('läge: stil', map.isStyleLoaded(), 'kakel', map.areTilesLoaded(), 'klar', map.loaded()), 5000);

// Molnen och snön ritas först när kartan laddat: på huvudtråden blockerade de annars
// stilens och workerns anrop (18/11). Varje flinga ritas i en egen liten duk och
// stämplas sedan in - glöd och oskärpa direkt på den stora duken tog minuter.
window.__lager = false;
map.once('load', () => setTimeout(() => {
    // Kartans egna moln (v2MapClouds): samma former och skuggor, utplacerade för hand.
    {
        const c = document.getElementById('moln').getContext('2d');
        const former = [...R.SPRITE_PUFFS, ...R.TOP_PUFFS];
        for (const [x, y, w, i] of ${JSON.stringify(MOLN)}) {
            const puffar = former[i % former.length];
            const top = i >= R.SPRITE_PUFFS.length;
            const h = w * R.SPRITE_H / R.SPRITE_W;
            const ay = top ? 0.5 : R.SIDE_ANCHOR_Y;
            c.globalAlpha = 0.22;
            c.drawImage(R.makeShadowSprite(puffar), x - w / 2 + w * 0.09, y - h * ay + w * 0.14, w, h);
            c.globalAlpha = 1;
            c.drawImage(R.makeSprite(puffar, top), x - w / 2, y - h * ay, w, h);
        }
    }
    // Glittrande snöflingor: sexuddiga kristaller med glöd, några glimtar (fyruddiga
    // stjärnor) och några stora suddiga flingor närmast "kameran". Inga över texten.
    {
        const c = document.getElementById('sno').getContext('2d');
        let frö = ${FRÖ};
        const slump = () => { frö = (frö * 1664525 + 1013904223) % 4294967296; return frö / 4294967296; };
        const fri = (x, y, m) => !${TEXT ? 'true' : 'false'} || Math.abs(x - ${TX}) > ${TS * 4.6} + m || Math.abs(y - ${TY}) > ${TS * 1.05} + m;
        const stämpel = (r, rita, oskärpa = 0) => {
            const S = Math.ceil(r * 5);
            const d = document.createElement('canvas'); d.width = S; d.height = S;
            const k = d.getContext('2d');
            if (oskärpa) k.filter = 'blur(' + oskärpa.toFixed(1) + 'px)';
            k.translate(S / 2, S / 2);
            rita(k);
            return d;
        };
        const kristall = (k, r, vrid, suddig) => {
            k.rotate(vrid);
            const arm = () => {
                k.beginPath();
                for (let i = 0; i < 6; i++) {
                    k.save(); k.rotate(i * Math.PI / 3);
                    k.moveTo(0, 0); k.lineTo(0, -r);
                    for (const [p, g] of [[0.42, 0.3], [0.68, 0.22]]) {
                        k.moveTo(0, -r * p); k.lineTo(-r * g, -r * (p + g * 0.85));
                        k.moveTo(0, -r * p); k.lineTo(r * g, -r * (p + g * 0.85));
                    }
                    k.restore();
                }
                k.stroke();
            };
            k.lineCap = 'round'; k.lineJoin = 'round';
            // Mörk kontur först, så flingan syns även mot snövit mark. Inte på de suddiga
            // närbildsflingorna - där blev konturen en grå fläck.
            if (!suddig) { k.strokeStyle = 'rgba(70,95,130,0.5)'; k.lineWidth = r * 0.2; arm(); }
            k.shadowColor = 'rgba(255,255,255,0.95)'; k.shadowBlur = r * 0.7;
            k.strokeStyle = '#fff'; k.lineWidth = r * 0.11; arm();
            k.shadowBlur = 0;
            k.fillStyle = '#fff'; k.beginPath(); k.arc(0, 0, r * 0.12, 0, Math.PI * 2); k.fill();
        };
        const glimt = (k, r) => {
            const g = k.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
            g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(255,246,220,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            k.fillStyle = g; k.beginPath(); k.arc(0, 0, r * 0.9, 0, Math.PI * 2); k.fill();
            k.fillStyle = '#fff';
            k.shadowColor = 'rgba(255,240,200,0.9)'; k.shadowBlur = r * 0.5;
            k.beginPath();
            const t = r * 0.11;
            k.moveTo(0, -r * 1.6); k.quadraticCurveTo(t, -t, r * 1.6, 0); k.quadraticCurveTo(t, t, 0, r * 1.6);
            k.quadraticCurveTo(-t, t, -r * 1.6, 0); k.quadraticCurveTo(-t, -t, 0, -r * 1.6);
            k.fill();
        };
        const W = ${PX_W}, H = ${PX_H}, skala = Math.sqrt(W * H) / 2514;
        const ortRutor = [...document.querySelectorAll('.ort')].map(el => { const b = el.getBoundingClientRect(); return [b.left * ${DPR}, b.top * ${DPR}, b.right * ${DPR}, b.bottom * ${DPR}]; });
        const ledig = (x, y, r) => fri(x, y, r)
            && !ortRutor.some(([a, b, c2, d]) => x > a - r && x < c2 + r && y > b - r && y < d + r)
            && !(window.__brickRutor || []).some(([a, b, c2, d]) => x > a - r * 0.4 && x < c2 + r * 0.4 && y > b - r * 0.4 && y < d + r * 0.2);
        for (let i = 0; i < ${SNÖ}; i++) {
            // En tredjedel hamnar i mitten - där telefonen beskär till Apples safe area -
            // och letar då upp en ledig plats (inte över text eller brickor) i stället
            // för att hoppa över. Bara skarpa flingor och glimtar där, inga suddiga.
            const mitt = i < ${SNÖ} / 3;
            const typ = slump(), r = (18 + slump() * 36) * skala, v = slump() * Math.PI;
            let x = 0, y = 0, hittad = false;
            for (let f = 0; f < (mitt ? 20 : 1) && !hittad; f++) {
                x = (mitt ? 0.27 + slump() * 0.46 : slump()) * W;
                y = (mitt ? 0.31 + slump() * 0.38 : slump()) * H;
                hittad = ledig(x, y, r);
            }
            if (!hittad) continue;
            let d;
            if (typ < 0.58 || (mitt && typ >= 0.9)) d = stämpel(r, k => kristall(k, r, v, false));
            else if (typ < 0.9) d = stämpel(r, k => glimt(k, r * 0.8));
            else { d = stämpel(r * 1.7, k => kristall(k, r * 1.7, v, true), r * 0.12); c.globalAlpha = 0.8; }
            c.drawImage(d, x - d.width / 2, y - d.height / 2);
            c.globalAlpha = 1;
        }
    }
    window.__lager = true;
}, 0));
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
    // Licensvakten: inget kartinnehåll från CARTO (bara stil, sprite, typsnitt). Den
    // BEVAKAR i stället för att fånga upp anropen: med setRequestInterception fastnade
    // kartans worker-anrop ibland (18/11), och bilden sparas ändå inte om ett enda
    // CARTO-kakel hämtats.
    page.on('request', r => {
        if (isCartoTileUrl(r.url())) cartoKakel++;
        if (r.url().startsWith(`http://localhost:${KAKEL_PORT}/`)) egnaKakel++;
    });
    page.on('pageerror', e => console.error('sidfel:', e.message));
    if (arg.debug) {
        page.on('console', m => console.log('konsol:', m.type(), m.text().slice(0, 200)));
        page.on('requestfailed', r => console.log('misslyckad:', r.url().slice(0, 120), r.failure()?.errorText));
        const t0 = Date.now();
        page.on('request', r => { if (!r.url().includes(':' + KAKEL_PORT)) console.log('->', ((Date.now() - t0) / 1000).toFixed(1), r.url().slice(0, 110)); });
        page.on('requestfinished', r => { if (!r.url().includes(':' + KAKEL_PORT)) console.log('<-', ((Date.now() - t0) / 1000).toFixed(1), r.response()?.status(), r.url().slice(0, 110)); });
    }
    await page.goto(`http://localhost:${SIDA_PORT}/`);
    await page.waitForFunction('(window.__klar && window.__lager) || window.__fel', { timeout: 120000 });
    const fel = await page.evaluate('window.__fel');
    if (fel) throw new Error(`kartfel: ${fel}`);
    if (cartoKakel) throw new Error(`licensvakten: ${cartoKakel} kakel från CARTO - sparar inget`);
    if (!egnaKakel) throw new Error('inga egna kakel hämtades');
    if (TEXT && !(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 20px Fredoka'); }))) {
        throw new Error('Fredoka laddades inte - texten skulle få fel typsnitt');
    }
    if (ORTER.length && !(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 20px Montserrat'); }))) {
        throw new Error('Montserrat laddades inte - ortnamnet skulle få fel typsnitt');
    }
    const typ = UT.endsWith('.png') ? 'png' : 'jpeg';
    const bild = await page.screenshot({ type: typ, ...(typ === 'jpeg' ? { quality: 95 } : {}), clip: { x: 0, y: 0, width: CSS_W, height: CSS_H } });
    writeFileSync(resolve(UT), bild);
    if (CSS_W * DPR !== PX_W || CSS_H * DPR !== PX_H) {
        const { execFileSync } = await import('node:child_process');
        execFileSync('sips', ['--cropToHeightWidth', String(PX_H), String(PX_W), '-s', 'formatOptions', '95', resolve(UT)], { stdio: 'ignore' });
    }
    console.log(`${UT}: ${perPlats.size} platser, ${EXTRA.length} extra, ${egnaKakel} egna kakel, 0 från CARTO`);
} finally {
    await browser.close();
    kakelServer.kill();
    server.close();
}
