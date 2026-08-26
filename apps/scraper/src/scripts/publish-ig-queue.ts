/**
 * publish-ig-queue.ts — publicerar stadsinläggens Instagram-tvillingar.
 *
 * BAKGRUNDEN: schedule-city-posts.ts schemalägger stadsinläggen på
 * Facebook-sidan med Graph API:s `scheduled_publish_time`. Instagrams
 * Content Publishing API kan inte schemalägga alls — bara "skapa container →
 * publicera nu". Därför läggs IG-tvillingen i en lokal kö (utils/igQueue.ts)
 * och det här skriptet, kört varje hel timme av launchd
 * (se.vadkul.ig-queue), publicerar det som förfallit.
 *
 * Körning (från apps/scraper):
 *   npx ts-node src/scripts/publish-ig-queue.ts                    # visa kön
 *   npx ts-node src/scripts/publish-ig-queue.ts --importera-fb-schema
 *   npx ts-node src/scripts/publish-ig-queue.ts --importera-fb-schema --commit
 *   npx ts-node src/scripts/publish-ig-queue.ts --provkör          # bild + IG-container, publicerar INTE
 *   npx ts-node src/scripts/publish-ig-queue.ts --kolla            # behörigheter + IG-koppling
 *   npx ts-node src/scripts/publish-ig-queue.ts --publicera        # skarpt (launchd-jobbets läge)
 *
 * `--importera-fb-schema` läser Sidans schemakö hos Meta och skapar en
 * IG-post per stadsinlägg som saknar en. Orten läses ur stadssidelänken i
 * texten (`vadkul.se/evenemang/<slug>`) — den finns i varje stadsinlägg och
 * överlever att texten kurerats för hand. Inlägg utan sådan länk är inte
 * stadsinlägg och hoppas över.
 *
 * `--provkör` bygger bilden och skapar en IG-container utan att publicera
 * (containern förfaller av sig själv). Det är vägen att verifiera att
 * behörigheter och bildformat sitter, utan att något hamnar i flödet.
 */

import {
    loadQueue, saveQueue, upsertQueueItem, dueItems, staleItems, replaceItem,
    queueId, QUEUE_PATH, type IgQueueItem,
} from '../utils/igQueue';
import { prepareInstagramImage } from '../utils/igImage';
import { cityNameForSlug, lookupCityPoint, cityAdImageUrl } from '../utils/cityLookup';
import { buildIgCaption } from '../utils/cityPostText';
import { postToInstagram, isInstagramConfigured, loadSocialSecrets } from '../utils/socialPublish';

const GRAPH = 'https://graph.facebook.com/v19.0';

const commit = process.argv.includes('--commit');
const doImport = process.argv.includes('--importera-fb-schema');
const doPublish = process.argv.includes('--publicera');
const doProbe = process.argv.includes('--provkör') || process.argv.includes('--provkor');
const doCheck = process.argv.includes('--kolla');

const sv = (ms: number) => new Date(ms).toLocaleString('sv-SE');

/* ── Import ur Facebooks schemakö ─────────────────────────────────────────── */

interface ScheduledPost {
    id: string;
    message?: string;
    scheduled_publish_time?: number;
}

async function fetchScheduledFbPosts(): Promise<ScheduledPost[]> {
    loadSocialSecrets();
    const pageId = process.env.FB_PAGE_ID ?? '';
    const token = process.env.FB_PAGE_TOKEN ?? '';
    if (!pageId || !token) throw new Error('FB_PAGE_ID / FB_PAGE_TOKEN saknas');

    const url = `${GRAPH}/${pageId}/scheduled_posts`
        + `?fields=id,message,scheduled_publish_time&limit=100&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json() as { data?: ScheduledPost[]; error?: { message: string } };
    if (data.error) throw new Error(`FB API: ${data.error.message}`);
    return data.data ?? [];
}

/** Stadsinläggets ort — läst ur stadssidelänken i texten. */
export function townFromPostText(message: string): { name: string; lat: number; lng: number } | null {
    const slug = message.match(/vadkul\.se\/evenemang\/([a-z0-9-]+)/i)?.[1];
    if (!slug) return null;
    const name = cityNameForSlug(slug);
    if (!name) return null;
    const point = lookupCityPoint(name);
    return point ? { name: point.name, lat: point.lat, lng: point.lng } : null;
}

async function runImport(): Promise<void> {
    const posts = await fetchScheduledFbPosts();
    console.log(`${posts.length} schemalagda FB-inlägg hos Meta.\n`);

    let queue = loadQueue();
    const before = queue.length;
    const added: IgQueueItem[] = [];
    let skipped = 0;

    for (const p of posts) {
        if (!p.message || !p.scheduled_publish_time) { skipped++; continue; }
        const town = townFromPostText(p.message);
        if (!town) { skipped++; continue; }

        const publishAt = p.scheduled_publish_time * 1000;
        const item: IgQueueItem = {
            id: queueId(town.name, publishAt),
            town: town.name,
            caption: buildIgCaption(p.message, town.name),
            imageUrl: cityAdImageUrl(town),
            publishAt,
            status: 'väntar',
            fbPostId: p.id,
        };
        const existing = queue.find(x => x.id === item.id);
        if (existing && existing.status === 'publicerad') { skipped++; continue; }
        queue = upsertQueueItem(queue, item);
        added.push(item);
    }

    for (const item of added.sort((a, b) => a.publishAt - b.publishAt)) {
        console.log(`  ${sv(item.publishAt)}  ${item.town.padEnd(14)} ${item.id}`);
    }
    if (skipped > 0) console.log(`\n  (${skipped} inlägg hoppades över — inget stadsinlägg, eller redan publicerat på IG)`);

    if (!commit) {
        console.log(`\nDRY-RUN — inget skrevs. Kör om med --commit för att lägga ${added.length} poster i kön.`);
        return;
    }
    saveQueue(queue);
    console.log(`\n✅ Kön: ${before} → ${queue.length} poster  (${QUEUE_PATH})`);
}

/* ── Publicering ──────────────────────────────────────────────────────────── */

/** Bild + IG-container utan media_publish — verifierar behörighet och format. */
async function runProbe(): Promise<void> {
    const queue = loadQueue();
    const next = [...queue].filter(x => x.status === 'väntar').sort((a, b) => a.publishAt - b.publishAt)[0];
    if (!next) { console.log('Inget väntande i kön att provköra.'); return; }

    console.log(`Provkör ${next.town} (${sv(next.publishAt)}) — publicerar INTE.\n`);
    const imageUrl = await prepareInstagramImage(next.imageUrl, next.id);
    if (!imageUrl) { console.error('❌ Bilden gick inte att förbereda.'); process.exitCode = 1; return; }
    console.log(`✅ Bild klar: ${imageUrl}`);

    loadSocialSecrets();
    const res = await fetch(`${GRAPH}/${process.env.IG_USER_ID}/media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption: next.caption, access_token: process.env.FB_PAGE_TOKEN }),
    });
    const data = await res.json() as any;
    if (data.error) {
        console.error(`❌ IG avvisade containern: ${data.error.message}`);
        process.exitCode = 1;
        return;
    }
    console.log(`✅ IG-container skapad: ${data.id} — publicerades INTE (den förfaller av sig själv om 24 h).`);
}

async function runPublish(): Promise<void> {
    let queue = loadQueue();
    const now = Date.now();

    for (const old of staleItems(queue, now)) {
        console.warn(`⏭  ${old.town} (${sv(old.publishAt)}) är för gammal — markeras förfallen i stället för att postas.`);
        queue = replaceItem(queue, old.id, { status: 'förfallen' });
    }

    const due = dueItems(queue, now);
    if (due.length === 0) {
        saveQueue(queue);
        console.log('Inget att publicera just nu.');
        return;
    }
    if (!isInstagramConfigured()) {
        console.error('❌ IG_USER_ID / FB_PAGE_TOKEN saknas — kan inte publicera. Kön rörs inte.');
        process.exitCode = 1;
        return;
    }

    for (const item of due) {
        console.log(`\n📲 ${item.town} — schemalagt ${sv(item.publishAt)}`);
        const attempts = (item.attempts ?? 0) + 1;
        try {
            const imageUrl = await prepareInstagramImage(item.imageUrl, item.id);
            if (!imageUrl) throw new Error('bilden gick inte att förbereda');
            const mediaId = await postToInstagram(item.caption, [imageUrl], 1);
            queue = replaceItem(queue, item.id, {
                status: 'publicerad', igMediaId: mediaId, publishedAt: Date.now(), attempts,
            });
            console.log(`✅ Publicerat på Instagram: ${mediaId}`);
        } catch (e) {
            const msg = (e as Error).message;
            queue = replaceItem(queue, item.id, { attempts, lastError: msg });
            console.error(`❌ ${item.town}: ${msg}`);
            // Kvar som "väntar" — nästa timkörning försöker igen tills posten
            // blir för gammal (STALE_MS) och markeras förfallen.
        }
        saveQueue(queue);
    }
}

/* ── Behörighetskoll ──────────────────────────────────────────────────────── */

/**
 * Vad Meta faktiskt släpper in oss på. Första felsökningssteget när IG svarar
 * `(#10) Application does not have permission` — då saknar Page-token
 * `instagram_basic` / `instagram_content_publish`, och det syns här.
 * Se docs/outreach/instagram-behorigheter.md.
 */
async function runCheck(): Promise<void> {
    loadSocialSecrets();
    const token = process.env.FB_PAGE_TOKEN ?? '';
    const pageId = process.env.FB_PAGE_ID ?? '';
    const igUserId = process.env.IG_USER_ID ?? '';
    if (!token || !pageId) { console.error('❌ FB_PAGE_ID / FB_PAGE_TOKEN saknas i ~/.vadkul-secrets/env'); process.exitCode = 1; return; }

    const dbg = await fetch(`${GRAPH}/debug_token?input_token=${token}&access_token=${token}`)
        .then(r => r.json()) as any;
    const scopes: string[] = dbg.data?.scopes ?? [];
    console.log(`Token: typ=${dbg.data?.type} giltig=${dbg.data?.is_valid} går ut=${dbg.data?.expires_at ? new Date(dbg.data.expires_at * 1000).toISOString() : 'aldrig'}`);
    console.log(`Scopes: ${scopes.join(', ') || '(inga)'}`);

    const need = ['instagram_basic', 'instagram_content_publish'];
    const missing = need.filter(s => !scopes.includes(s));
    if (missing.length > 0) {
        console.error(`\n❌ Saknade behörigheter: ${missing.join(', ')}`);
        console.error('   → Instagram-publicering kommer att avvisas med (#10).');
        console.error('   → Så här förnyas token: docs/outreach/instagram-behorigheter.md');
        process.exitCode = 1;
    } else {
        console.log('\n✅ Behörigheterna för IG-publicering finns.');
    }

    const page = await fetch(`${GRAPH}/${pageId}?fields=name,instagram_business_account&access_token=${token}`)
        .then(r => r.json()) as any;
    const linkedIg = page.instagram_business_account?.id;
    console.log(`\nSida: ${page.name ?? '?'} (${pageId})`);
    console.log(`Kopplat IG-konto enligt Meta: ${linkedIg ?? '(syns inte — kräver instagram_basic)'}`);
    console.log(`IG_USER_ID i env:            ${igUserId || '(saknas)'}`);
    if (linkedIg && igUserId && linkedIg !== igUserId) {
        console.error('⚠️  De skiljer sig — env pekar på fel konto.');
        process.exitCode = 1;
    }
}

/* ── Lista ────────────────────────────────────────────────────────────────── */

function runList(): void {
    const queue = loadQueue();
    if (queue.length === 0) {
        console.log(`Kön är tom (${QUEUE_PATH}).`);
        console.log('Fyll den med:  npx ts-node src/scripts/publish-ig-queue.ts --importera-fb-schema --commit');
        return;
    }
    console.log(`${queue.length} poster i ${QUEUE_PATH}\n`);
    for (const x of queue) {
        const mark = x.status === 'publicerad' ? '✅' : x.status === 'förfallen' ? '⏭' : x.lastError ? '⚠️' : '⏳';
        console.log(`${mark} ${sv(x.publishAt)}  ${x.town.padEnd(14)} ${x.status}${x.lastError ? `  (${x.lastError})` : ''}`);
    }
}

async function main() {
    if (doCheck) return runCheck();
    if (doImport) return runImport();
    if (doProbe) return runProbe();
    if (doPublish) return runPublish();
    runList();
}

main().catch(e => { console.error(e); process.exit(1); });
