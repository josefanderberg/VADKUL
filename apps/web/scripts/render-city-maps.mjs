#!/usr/bin/env node
/**
 * render-city-maps.mjs — bakar stads-heronas kartbild EN gång i stället för i
 * varje besökares webbläsare.
 *
 * VARFÖR: hero-kameran är låst per stad, så kartan ser alltid exakt likadan
 * ut. Ändå laddade varje besök MapLibre (269 kB gzippad JS, ~1 MB att parsa),
 * hämtade CARTO:s stil-JSON och sedan vektorkakel innan första kartpixeln
 * ritades — på en sida vars hela HTML är 121 kB gzippad. Kartmotorn var alltså
 * sidans tyngsta post, för att rita en bild vi kunde ha haft färdig.
 *
 * VAD SOM RENDERAS: bara kartbotten. Brickorna förblir levande DOM ovanpå
 * bilden (CityMapHeroMarkers) — de måste följa period- och kategorifiltret och
 * visa dagens utbud, inte byggdagens. Skriptet döljer därför brickor, chips
 * och krediten innan det fotograferar.
 *
 * HUR: sidan renderar automatiskt den riktiga GL-kartan för städer som SAKNAR
 * bild (se cityMapImageSrc i CityMapHero). Skriptet utnyttjar det: det flyttar
 * undan eventuella befintliga bilder, låter dev-servern rita kartan på riktigt,
 * fotograferar, och skriver de nya bilderna. Ingen särskild render-route
 * behövs, och reservvägen testas på köpet.
 *
 * KAKLEN MÅSTE VARA VÅRA EGNA. CARTO tillåter att deras kakel visas direkt
 * för besökare (§9.c.i) men förbjuder att vi cachar innehållet på vår server
 * (§9.c.iii) — och en förrenderad bild är precis det. Voyager-stilen däremot
 * är BSD-3 och sedan oktober 2026 skriven mot det öppna Protomaps-schemat, så
 * samma stil mot ett utdrag ur Protomaps eget bygge ger identiskt utseende,
 * helt lagligt. (Före oktober var det OpenMapTiles-schemat och kakel från
 * planetiler. De passar inte längre.)
 * Skriptet KONTROLLERAR båda delarna per stad: det vägrar spara en bild om
 * något kakel hämtats från CARTO (licensvakten) eller om de egna kaklen inte
 * följer Protomaps-schemat (schemavakten). Ta inte bort vakterna.
 *
 * KÖRS SÄLLAN — inte i CI. Bara när en stad tillkommer eller kartstilen ändras.
 * Kräver node 22.18 eller senare: vakterna bor i src/utils/cartoTiles.ts och
 * node kör TypeScript-filen direkt. Tre terminaler:
 *
 *   1) kakelservern (se docs/kartbilder.md för hur sweden.pmtiles tas fram)
 *      node serve-tiles.mjs
 *   2) dev-servern MED egna kakel:
 *      cd apps/web && NEXT_PUBLIC_VECTOR_TILES_URL='http://localhost:8099/{z}/{x}/{y}.pbf' npm run dev
 *   3) själva renderingen:
 *      node scripts/render-city-maps.mjs
 *
 * Flaggor:
 *   --city=malmo,vaxjo   bara de städerna
 *   --base=http://...    annan dev-server (default http://localhost:3000)
 *   --keep               behåll befintliga bilder (rendera bara de som saknas)
 */

import { readFile, writeFile, mkdir, rename, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Vakterna delas med webben (v2MapBaseStyles byter källan med samma test) och
// har sina tester där. Node 22.18+ stryker typerna själv.
let kakel;
try {
    kakel = await import('../src/utils/cartoTiles.ts');
} catch (e) {
    console.error(`\n  Kunde inte läsa src/utils/cartoTiles.ts (${e.message}).\n  Skriptet kräver node 22.18 eller senare, som kör TypeScript direkt.\n`);
    process.exit(1);
}
const { isCartoTileUrl, isVectorTileUrl, mvtLayerNames, tileSchemaOf } = kakel;

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const OUT_DIR = path.join(WEB, 'public', 'kartbilder');
const STASH_DIR = path.join(WEB, 'public', '.kartbilder-stash');

// MÅSTE spegla HERO_IMG_W/HERO_IMG_H i CityMapHero.tsx. Går de isär blir
// bilden skalad och brickorna hamnar fel i förhållande till gatorna.
const HERO_W = 630;
const HERO_H = 318;
// 2× för retina. Högre ger skarpare bild men tyngre filer — 2× räcker.
const SCALE = 2;
// Under detta är bilden med säkerhet en tom platta, inte en karta (se
// tomhetsvakten nedan). Glesaste riktiga stad hittills: ~20 kB.
const MIN_IMAGE_BYTES = 8 * 1024;

const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
        const m = a.match(/^--([^=]+)(?:=(.*))?$/);
        return m ? [m[1], m[2] ?? true] : [a, true];
    }),
);
const BASE = typeof args.base === 'string' ? args.base : 'http://localhost:3000';
const ONLY = typeof args.city === 'string' ? new Set(args.city.split(',')) : null;

/** Stadsslugs ur utils/cityPages.ts — listan som genererar sidorna. */
async function citySlugs() {
    const src = await readFile(path.join(WEB, 'src', 'utils', 'cityPages.ts'), 'utf8');
    const slugs = [...src.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
    if (slugs.length < 10) {
        throw new Error(`Hittade bara ${slugs.length} städer i cityPages.ts — har formatet ändrats?`);
    }
    return ONLY ? slugs.filter(s => ONLY.has(s)) : slugs;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    const slugs = await citySlugs();
    console.log(`${slugs.length} städer att rendera. Dev-server: ${BASE}`);

    // Nåbar dev-server? Annars renderar sidan ingenting och vi skriver 71
    // gröna plattor utan att märka det.
    try {
        const res = await fetch(`${BASE}/evenemang/${slugs[0]}`, { method: 'HEAD' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
        console.error(`\n  Når inte ${BASE} (${e.message}).\n  Starta dev-servern först: cd apps/web && npm run dev\n`);
        process.exit(1);
    }

    await mkdir(OUT_DIR, { recursive: true });

    // Sidan ritar GL-kartan bara för städer UTAN bild. Flytta undan de gamla
    // så vi fotograferar den riktiga kartan och inte gårdagens bild.
    let stashed = false;
    if (!args.keep) {
        const befintliga = existsSync(OUT_DIR) ? await readdir(OUT_DIR) : [];
        if (befintliga.length) {
            await rm(STASH_DIR, { recursive: true, force: true });
            await rename(OUT_DIR, STASH_DIR);
            await mkdir(OUT_DIR, { recursive: true });
            stashed = true;
            console.log(`  (${befintliga.length} befintliga bilder undanflyttade under renderingen)`);
        }
    }

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--enable-webgl', '--use-gl=angle', '--ignore-gpu-blocklist'],
    });

    let ok = 0;
    const misslyckade = [];
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: SCALE });

        for (const [i, slug] of slugs.entries()) {
            const mål = path.join(OUT_DIR, `${slug}.webp`);
            if (args.keep && existsSync(mål)) { console.log(`  [${i + 1}/${slugs.length}] ${slug} — finns, hoppar över`); continue; }
            try {
                // Spåra var kaklen kom ifrån - vakterna nedan bygger på detta.
                // Puppeteer rapporterar även MapLibres worker-hämtningar här.
                const cartoKakel = [];
                const egnaKakel = [];
                const onResp = r => {
                    // Bara KARTKAKLEN får fälla renderingen: allt från
                    // cartocdn.com utom formgivningen. Stilens övriga delar
                    // hämtas fortfarande därifrån och SKA göra det: style.json
                    // (BSD-3), sprite (ikonatlasen) och fonts/*.pbf (typsnitten)
                    // hör till formgivningen, som är CC-BY och fri att använda
                    // när vi krediterar, vilket kartkrediten gör. Den gamla
                    // vakten letade efter /vector/ i sökvägen och missade v2-
                    // kaklen (/v/<datum>/vectortiles/…) när Voyager bytte i
                    // oktober 2026 (#205). isCartoTileUrl släpper därför bara
                    // det kända och fäller allt annat.
                    const u = r.url();
                    if (isCartoTileUrl(u)) cartoKakel.push(u);
                    else if (r.ok() && isVectorTileUrl(u)) egnaKakel.push(u);
                };
                page.on('response', onResp);

                await page.goto(`${BASE}/evenemang/${slug}`, { waitUntil: 'networkidle2', timeout: 90_000 });

                // Vänta på att GL-kartan tonats in (.city-hero-map får
                // opacity 1 först när MapLibre sagt 'load').
                await page.waitForFunction(() => {
                    const el = document.querySelector('.city-hero-map');
                    return el && getComputedStyle(el).opacity === '1';
                }, { timeout: 60_000 });
                // …och sedan på att kaklen faktiskt ritats färdigt.
                await sleep(2500);

                // Dölj allt som INTE ska in i bilden: brickor, periodchips,
                // kartkrediten. Bara kartbotten fotograferas.
                await page.evaluate(() => {
                    const hero = document.querySelector('.city-hero-map')?.parentElement;
                    if (!hero) return;
                    for (const el of hero.children) {
                        if (!el.classList.contains('city-hero-map')) el.style.visibility = 'hidden';
                    }
                    for (const m of hero.querySelectorAll('.maplibregl-marker')) m.style.visibility = 'hidden';
                    // RAKA HÖRN i bilden. Hero-rutan är rounded-2xl, och bakas
                    // rundningen in i bilden hamnar den fel så fort object-cover
                    // beskär i sidled på en smalare skärm. Containern rundar
                    // ändå bilden när den visas.
                    hero.style.borderRadius = '0';
                });

                const hero = await page.$('.city-hero-map');
                const box = await hero.boundingBox();
                if (!box || Math.round(box.width) !== HERO_W || Math.round(box.height) !== HERO_H) {
                    throw new Error(`hero är ${Math.round(box?.width)}×${Math.round(box?.height)}, väntade ${HERO_W}×${HERO_H} — justera HERO_W/HERO_H här och i CityMapHero`);
                }
                // LICENSVAKTEN: ritades kartan ur CARTO:s kakel får bilden inte
                // sparas. Glömd NEXT_PUBLIC_VECTOR_TILES_URL på dev-servern är
                // det enda realistiska sättet att hamna här.
                page.off('response', onResp);
                if (cartoKakel.length) {
                    throw new Error(`${cartoKakel.length} kakel hämtades från CARTO (${cartoKakel[0]}) — kör dev-servern med NEXT_PUBLIC_VECTOR_TILES_URL mot egna kakel`);
                }
                // SCHEMAVAKTEN: de egna kaklen måste följa samma schema som
                // stilen. Planetilers gamla sweden.pmtiles (OpenMapTiles) mot
                // Voyagers Protomaps-stil ritar bara vatten och bakgrund, och
                // en sådan bild kan bli stor nog att passera tomhetsvakten.
                // Läs några av kaklen direkt från kakelservern och titta på
                // lagernamnen.
                const scheman = await Promise.all(egnaKakel.slice(0, 3).map(async u => {
                    try {
                        const res = await fetch(u);
                        return tileSchemaOf(mvtLayerNames(new Uint8Array(await res.arrayBuffer())));
                    } catch {
                        return 'okänt';
                    }
                }));
                if (scheman.includes('openmaptiles')) {
                    throw new Error('kakelservern levererar OpenMapTiles-kakel (planetilers gamla sweden.pmtiles), men Voyager-stilen kräver Protomaps-schemat. Ta fram ett utdrag ur Protomaps bygge enligt docs/kartbilder.md');
                }
                if (!scheman.includes('protomaps')) {
                    throw new Error(`hittade inga egna kakel i Protomaps-schemat (${egnaKakel.length} vektorkakel hämtades) - kör dev-servern med NEXT_PUBLIC_VECTOR_TILES_URL mot ett Protomaps-utdrag, se docs/kartbilder.md`);
                }

                const buf = await hero.screenshot({ type: 'webp', quality: 82, optimizeForSpeed: false });
                // TOMHETSVAKT: en karta utan kakel blir en enfärgad platta i
                // landfärgen, och den komprimerar till ett par kB medan en
                // riktig karta landar på 20–90 kB. Hände på riktigt: en
                // felaktig Content-Encoding på kakelservern gjorde att
                // MapLibre tyst fick noll kakel, kartan sa ändå 'load', och
                // 71 gröna plattor hade sparats utan att någon märkt det.
                if (buf.length < MIN_IMAGE_BYTES) {
                    throw new Error(`bilden är bara ${Math.round(buf.length / 1024)} kB — kartan ritade troligen inga kakel`);
                }
                await writeFile(mål, buf);
                ok++;
                console.log(`  [${i + 1}/${slugs.length}] ${slug} — ${Math.round(buf.length / 1024)} kB`);
            } catch (e) {
                misslyckade.push(slug);
                console.error(`  [${i + 1}/${slugs.length}] ${slug} — MISSLYCKADES: ${e.message}`);
            }
        }
    } finally {
        await browser.close();
    }

    // Allt som INTE fick en ny bild får tillbaka sin gamla — både städer som
    // misslyckades och (viktigt vid --city) alla som aldrig var med i den här
    // körningen. Utan den andra delen raderade en enstads-körning de övriga
    // 70 bilderna tillsammans med stashen.
    if (stashed) {
        for (const fil of await readdir(STASH_DIR)) {
            if (existsSync(path.join(OUT_DIR, fil))) continue; // ny bild finns
            await rename(path.join(STASH_DIR, fil), path.join(OUT_DIR, fil));
            const slug = fil.replace(/\.webp$/, '');
            if (misslyckade.includes(slug)) console.log(`  ${slug} — behöll den gamla bilden`);
        }
        await rm(STASH_DIR, { recursive: true, force: true });
    }

    console.log(`\nKlart: ${ok} renderade, ${misslyckade.length} misslyckade.`);
    if (misslyckade.length) {
        console.log('Misslyckade städer faller tillbaka på GL-kartan i webben — inget går sönder.');
        process.exitCode = 1;
    }
}

main().catch(e => { console.error(e); process.exit(1); });
