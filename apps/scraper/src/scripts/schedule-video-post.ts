/**
 * schedule-video-post.ts — ett videoinlägg på Facebook-sidan och Instagram.
 *
 * Första användningen: iOS-appens lanseringsfilm 26/10 2026 kl 11
 * (docs/social/ios-app-video/). Skriptet är generellt: vilken fil, vilka
 * texter och vilket klockslag som helst. Normalt körs det av Actions-
 * workflown videoinlagg.yml (nycklarna finns på GitHub), men det går lika
 * bra på minin (~/.vadkul-secrets/env).
 *
 * Körning (från apps/scraper):
 *   npm run video-inlagg -- --lage=kolla --video=<fil> --fb-text=<fil> --ig-text=<fil> --klockan="2026-10-26 11:00"
 *   npm run video-inlagg -- --lage=fb --klockan="2026-10-26 11:00" … --commit   # schemalägg hos Meta
 *   npm run video-inlagg -- --lage=ig --klockan="2026-10-26 11:00" … --commit   # starta ≤45 min före: väntar + publicerar
 *   npm run video-inlagg -- --lage=ig --nu … --commit                            # publicera reelen NU
 *
 * Flaggor:
 *   --lage=kolla|fb|ig   kolla (default) publicerar inget: scopes, IG-konto, plan
 *   --video=<fil|https>  lokal fil laddas upp till Storage; en https-URL används som den är
 *   --fb-text=<fil>      Facebook-texten (videons description)
 *   --ig-text=<fil>      Instagram-bildtexten (default: samma fil som FB)
 *   --titel=<text>       videons titel i Sidans videobibliotek
 *   --klockan=<"YYYY-MM-DD HH:MM">  publiceringstid i Stockholmstid (TZ sätts av workflown)
 *   --nu                 ig: strunta i klockslaget och publicera direkt
 *   --max-vantan=45      ig: längsta väntan i minuter innan körningen avbryts som för tidig
 *   --commit             gör det på riktigt (utan: bara utskrift)
 *
 * VARFÖR TVÅ LÄGEN: Facebook schemalägger själv (scheduled_publish_time),
 * Instagram kan inte — reelen publiceras av en körning som startas strax
 * före klockslaget och sover fram till det (utils/videoPost.ts, reelTiming).
 * Secrets: FB_PAGE_ID + FB_PAGE_TOKEN (probe i workflown / minins env-fil),
 * IG_USER_ID (saknas den slås IG-kontot upp via Sidan).
 */

import fs from 'fs';
import path from 'path';
import {
    loadSocialSecrets, isFacebookConfigured, postVideoToFacebook, postReelToInstagram,
    facebookVideoPermalink, lookupInstagramUserId, getTokenScopes,
} from '../utils/socialPublish';
import { uploadMarketingVideo } from '../utils/marketingVideo';
import {
    parseLocalTime, reelTiming, formatStockholm, formatDuration, REEL_MAX_WAIT_MS,
} from '../utils/videoPost';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string): string | undefined =>
    argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const lage = opt('lage') ?? 'kolla';
const commit = flag('commit');
const nu = flag('nu');
const videoArg = opt('video') ?? '';
const fbTextPath = opt('fb-text');
const igTextPath = opt('ig-text') ?? fbTextPath;
const titel = opt('titel') ?? 'VADKUL: Event nära dig';
const klockanArg = opt('klockan');
const maxVantanMin = Number(opt('max-vantan') ?? '') || REEL_MAX_WAIT_MS / 60_000;

function fail(msg: string): never {
    console.error(`❌ ${msg}`);
    process.exit(1);
}

function readText(p: string | undefined, vad: string): string {
    if (!p) fail(`--${vad} saknas`);
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) fail(`${vad}: filen finns inte: ${abs}`);
    const text = fs.readFileSync(abs, 'utf-8').trim();
    if (!text) fail(`${vad}: filen är tom: ${abs}`);
    return text;
}

function publishAtOrFail(): number {
    if (!klockanArg) fail('--klockan saknas (t.ex. --klockan="2026-10-26 11:00", Stockholmstid)');
    const ts = parseLocalTime(klockanArg);
    if (ts === null) fail(`--klockan går inte att tolka: "${klockanArg}" (format YYYY-MM-DD HH:MM)`);
    return ts;
}

const isUrl = (s: string) => /^https:\/\//.test(s);

function describeVideo(): string {
    if (!videoArg) return '(ingen --video)';
    if (isUrl(videoArg)) return videoArg;
    const abs = path.resolve(videoArg);
    if (!fs.existsSync(abs)) return `${abs} (FINNS INTE)`;
    return `${abs} (${Math.round(fs.statSync(abs).size / 1024)} kB)`;
}

/** Publik URL till videon: en https-URL som den är, en lokal fil via Storage. */
async function resolveVideoUrl(): Promise<string> {
    if (!videoArg) fail('--video saknas');
    if (isUrl(videoArg)) return videoArg;
    const abs = path.resolve(videoArg);
    if (!fs.existsSync(abs)) fail(`videon finns inte: ${abs}`);
    const url = await uploadMarketingVideo(abs);
    if (!url) fail('uppladdningen till Storage föll');
    console.log(`☁️  Video i Storage: ${url}`);
    return url;
}

async function ensureIgUserId(): Promise<string> {
    if (process.env.IG_USER_ID) return process.env.IG_USER_ID;
    const found = await lookupInstagramUserId();
    if (!found) fail('IG_USER_ID saknas och Sidan visar inget kopplat Instagram-konto (kräver instagram_basic)');
    process.env.IG_USER_ID = found;
    console.log(`📷 IG-konto slaget upp via Sidan: ${found}`);
    return found;
}

const indent = (text: string) => text.split('\n').map(l => `  │ ${l}`).join('\n');

/* ── kolla ────────────────────────────────────────────────────────────────── */

async function runKolla(): Promise<void> {
    loadSocialSecrets();
    console.log('Läge: kolla — publicerar inget.\n');
    console.log(`Video:    ${describeVideo()}`);
    if (klockanArg) {
        const ts = parseLocalTime(klockanArg);
        console.log(`Klockan:  ${ts === null
            ? `"${klockanArg}" GÅR INTE ATT TOLKA`
            : `${formatStockholm(ts)} Stockholm = ${new Date(ts).toISOString()} (${formatDuration(ts - Date.now())} ${ts > Date.now() ? 'fram' : 'sedan'})`}`);
    } else {
        console.log('Klockan:  (ingen --klockan)');
    }
    for (const [vad, p] of [['FB-text', fbTextPath], ['IG-text', igTextPath]] as const) {
        if (!p) { console.log(`${vad}:  (saknas)`); continue; }
        const abs = path.resolve(p);
        const text = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf-8').trim() : '';
        console.log(`${vad}:  ${text ? `${abs} — ${text.length} tecken, börjar "${text.split('\n')[0]}"` : `${abs} SAKNAS/TOM`}`);
    }
    if (!isFacebookConfigured()) {
        console.error('\n❌ FB_PAGE_ID / FB_PAGE_TOKEN saknas');
        process.exitCode = 1;
        return;
    }

    const tok = await getTokenScopes();
    console.log(`\nSida:   ${process.env.FB_PAGE_ID}`);
    console.log(`Token:  giltig=${tok.valid} går ut=${tok.expiresAt ? new Date(tok.expiresAt).toISOString() : 'aldrig'}`);
    console.log(`Scopes: ${tok.scopes.join(', ') || '(inga)'}`);
    const need: [string, string][] = [
        ['pages_manage_posts', 'FB-inlägg'],
        ['publish_video', 'FB-video (/videos)'],
        ['instagram_basic', 'IG-koppling'],
        ['instagram_content_publish', 'IG-reel'],
    ];
    let ok = tok.valid;
    for (const [scope, vad] of need) {
        const has = tok.scopes.includes(scope);
        if (!has) ok = false;
        console.log(`  ${has ? '✅' : '❌'} ${scope.padEnd(26)} ${vad}`);
    }
    const ig = process.env.IG_USER_ID || await lookupInstagramUserId();
    console.log(`\nIG-konto: ${ig ?? '(hittas inte — IG_USER_ID saknas och Sidan visar inget kopplat konto)'}`);
    if (!ok || !ig) process.exitCode = 1;
}

/* ── fb: schemalägg hos Meta ──────────────────────────────────────────────── */

async function runFb(): Promise<void> {
    const publishAt = publishAtOrFail();
    const text = readText(fbTextPath, 'fb-text');
    loadSocialSecrets();
    if (!isFacebookConfigured()) fail('FB_PAGE_ID / FB_PAGE_TOKEN saknas');

    console.log(`Facebook: schemalägg video till ${formatStockholm(publishAt)} (om ${formatDuration(publishAt - Date.now())})`);
    console.log(`Video:    ${describeVideo()}`);
    console.log(`Titel:    ${titel}`);
    console.log(`Text:\n${indent(text)}\n`);
    if (!commit) {
        console.log('DRY-RUN — inget laddas upp eller schemaläggs. Kör om med --commit.');
        return;
    }

    const videoUrl = await resolveVideoUrl();
    const id = await postVideoToFacebook(videoUrl, text, { title: titel, scheduledFor: publishAt });
    console.log(`✅ Schemalagt hos Meta: video ${id} → ${facebookVideoPermalink(process.env.FB_PAGE_ID ?? '', id)}`);
    console.log('   (ligger i Business Suite → Planner tills Meta publicerar den)');
}

/* ── ig: vänta till klockslaget och publicera ─────────────────────────────── */

async function runIg(): Promise<void> {
    const text = readText(igTextPath, 'ig-text');
    loadSocialSecrets();
    if (!isFacebookConfigured()) fail('FB_PAGE_ID / FB_PAGE_TOKEN saknas');

    let publishAt: number | undefined;
    if (nu) {
        console.log('Instagram: publicera reelen NU (--nu).');
    } else {
        publishAt = publishAtOrFail();
        const t = reelTiming(Date.now(), publishAt, { maxWaitMs: maxVantanMin * 60_000 });
        if (t.action === 'för-tidigt') {
            fail(`klockslaget ${formatStockholm(publishAt)} är ${formatDuration(t.waitMs)} fram — starta körningen högst ${maxVantanMin} min före (eller --nu).`);
        }
        if (t.action === 'för-sent') {
            fail(`klockslaget ${formatStockholm(publishAt)} passerade för ${formatDuration(t.lateMs)} sedan — publiceras inte (färskvara). Vill du ändå: --nu.`);
        }
        if (t.action === 'publicera-nu') {
            console.log(`Instagram: klockslaget ${formatStockholm(publishAt)} passerade för ${formatDuration(t.lateMs)} sedan — publicerar så fort videon är bearbetad.`);
            publishAt = undefined;
        } else {
            console.log(`Instagram: reel ${formatStockholm(publishAt)} — förbereder nu, publicerar om ${formatDuration(t.waitMs)}.`);
        }
    }
    console.log(`Video:    ${describeVideo()}`);
    console.log(`Text:\n${indent(text)}\n`);
    if (!commit) {
        console.log('DRY-RUN — inget laddas upp eller publiceras. Kör om med --commit.');
        return;
    }

    await ensureIgUserId();
    const videoUrl = await resolveVideoUrl();
    const mediaId = await postReelToInstagram(text, videoUrl, { publishAt });
    console.log(`✅ Publicerat på Instagram ${formatStockholm(Date.now())}: ${mediaId}`);
}

async function main(): Promise<void> {
    if (lage === 'kolla') return runKolla();
    if (lage === 'fb') return runFb();
    if (lage === 'ig') return runIg();
    fail(`okänt --lage=${lage} (kolla | fb | ig)`);
}

main().catch(e => { console.error(`❌ ${(e as Error).message}`); process.exit(1); });
