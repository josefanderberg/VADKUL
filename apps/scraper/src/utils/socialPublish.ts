/**
 * socialPublish.ts — delad Facebook- + Instagram-publicering via Meta Graph API.
 *
 * EN implementation, använd av både publish-fb.ts (daglig auto-post, 3 event)
 * och publish-digest.ts (/list10, 10-event-karusell). Tidigare bodde IG/FB-
 * koden bara i publish-fb; nu delas den så vi inte underhåller två kopior.
 *
 * Hemligheter (~/.vadkul-secrets/env, laddas av loadSocialSecrets):
 *   FB_PAGE_ID     — Facebook-sidans ID
 *   FB_PAGE_TOKEN  — Page Access Token med pages_manage_posts +
 *                    instagram_basic + instagram_content_publish
 *   IG_USER_ID     — Instagram Business/Creator-konto-ID kopplat till sidan
 *
 * Instagram-krav (Meta): bilderna MÅSTE vara publika https-URL:er som Metas
 * servrar kan hämta (vår Firebase Storage funkar). Karusell = 2–10 bilder.
 */

import fs from 'fs';
import path from 'path';

const GRAPH = 'https://graph.facebook.com/v19.0';

let secretsLoaded = false;

/**
 * Ladda ~/.vadkul-secrets/env in i process.env. Idempotent + självförsörjande:
 * alla publik-funktioner nedan kallar denna först, så modulen fungerar oavsett
 * om anroparen råkat ladda hemligheterna (tidigare bugg-risk: importera och
 * anropa utan att FB_PAGE_TOKEN/IG_USER_ID fanns i env → tyst "ej konfigurerat").
 */
export function loadSocialSecrets(): void {
    if (secretsLoaded) return;
    secretsLoaded = true;
    const secretFile = path.join(process.env.HOME || '~', '.vadkul-secrets/env');
    if (!fs.existsSync(secretFile)) return;
    for (const line of fs.readFileSync(secretFile, 'utf-8').split('\n')) {
        const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}

// Läs config vid anrop (inte vid import), och säkra att hemligheterna laddats.
const fbPageId    = () => { loadSocialSecrets(); return process.env.FB_PAGE_ID    ?? ''; };
const fbPageToken = () => { loadSocialSecrets(); return process.env.FB_PAGE_TOKEN ?? ''; };
const igUserId    = () => { loadSocialSecrets(); return process.env.IG_USER_ID    ?? ''; };

/** Facebook-sidan konfigurerad (id + token)? */
export function isFacebookConfigured(): boolean {
    return !!fbPageId() && !!fbPageToken();
}

/** Instagram konfigurerat (utöver Facebook krävs IG_USER_ID)? */
export function isInstagramConfigured(): boolean {
    return isFacebookConfigured() && !!igUserId();
}

function validImageUrls(urls: string[]): string[] {
    return urls.filter((u) => !!u && u.startsWith('http'));
}

// ── Facebook ──────────────────────────────────────────────────────────────────

/**
 * Publicera till Facebook-sidan.
 *   0 bilder → feed-inlägg · 1 bild → /photos · 2+ → multi-photo feed.
 */
export async function postToFacebook(message: string, imageUrls: string[]): Promise<string> {
    const FB_PAGE_ID = fbPageId(), FB_PAGE_TOKEN = fbPageToken();
    const validImages = validImageUrls(imageUrls);

    if (validImages.length === 0) {
        const res = await fetch(`${GRAPH}/${FB_PAGE_ID}/feed`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, access_token: FB_PAGE_TOKEN }),
        });
        const data = await res.json() as any;
        if (data.error) throw new Error(`FB API ${data.error.code}: ${data.error.message}`);
        return data.id as string;
    }

    if (validImages.length === 1) {
        const res = await fetch(`${GRAPH}/${FB_PAGE_ID}/photos`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption: message, url: validImages[0], access_token: FB_PAGE_TOKEN }),
        });
        const data = await res.json() as any;
        if (data.error) {
            console.warn(`[FB] Bildpost misslyckades (${data.error.message}) — försöker utan bild`);
            return postToFacebook(message, []);
        }
        return data.id as string;
    }

    // Multi-photo: ladda upp varje som unpublished → feed-post med attached_media
    const mediaIds: string[] = [];
    for (const url of validImages) {
        const res = await fetch(`${GRAPH}/${FB_PAGE_ID}/photos`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, published: false, access_token: FB_PAGE_TOKEN }),
        });
        const data = await res.json() as any;
        if (data.error) { console.warn(`[FB] Upload misslyckades (${data.error.message}) — skippar`); continue; }
        mediaIds.push(data.id as string);
    }
    if (mediaIds.length === 0) { console.warn('[FB] Inga bilder gick att ladda upp — postar utan'); return postToFacebook(message, []); }

    const feedRes = await fetch(`${GRAPH}/${FB_PAGE_ID}/feed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, attached_media: mediaIds.map((id) => ({ media_fbid: id })), access_token: FB_PAGE_TOKEN }),
    });
    const feedData = await feedRes.json() as any;
    if (feedData.error) throw new Error(`FB feed: ${feedData.error.message}`);
    console.log(`[FB] Multi-photo post med ${mediaIds.length} bilder`);
    return feedData.id as string;
}

// ── Instagram ─────────────────────────────────────────────────────────────────

/** Vänta tills en IG-container är FINISHED (Meta processar bilden 5–30 s). */
async function waitForIgContainerReady(containerId: string, maxSec = 60): Promise<void> {
    const FB_PAGE_TOKEN = fbPageToken();
    const start = Date.now();
    while ((Date.now() - start) / 1000 < maxSec) {
        const res = await fetch(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${FB_PAGE_TOKEN}`);
        const data = await res.json() as any;
        if (data.status_code === 'FINISHED') return;
        if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
            throw new Error(`IG container ${containerId} status=${data.status_code}: ${data.status || ''}`);
        }
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`IG container ${containerId} timeout efter ${maxSec}s`);
}

/**
 * Bildtext för ett IG-inlägg. Antingen en färdig sträng, eller en byggare som
 * anropas med indexen (in i den inskickade `imageUrls`-arrayen) för de bilder
 * som FAKTISKT gick igenom IG:s validering och blir slides. Byggaren låter
 * anroparen renumrera texten så den matchar slidesen 1:1 — IG avvisar bilder
 * (otillåten aspect ratio, fel filtyp) vid container-skapandet, så en text som
 * bakas i förväg riskerar att lista fler event än det finns slides.
 */
export type IgCaption = string | ((keptIndices: number[]) => string);

function resolveCaption(caption: IgCaption, keptIndices: number[]): string {
    return typeof caption === 'function' ? caption(keptIndices) : caption;
}

/**
 * Publicera till Instagram. 1 bild = single post, 2–10 = karusell.
 * Kräver att bilderna är publika https-URL:er (Meta hämtar dem serverside).
 *
 * `caption` kan vara en byggar-funktion (se IgCaption) för att renumrera texten
 * efter att vi vet vilka bilder som passerade IG:s validering.
 */
export async function postToInstagram(caption: IgCaption, imageUrls: string[]): Promise<string> {
    const IG_USER_ID = igUserId(), FB_PAGE_TOKEN = fbPageToken();
    // Behåll ursprungsindex så en caption-byggare kan mappa tillbaka till event.
    const validPairs = imageUrls
        .map((url, idx) => ({ url, idx }))
        .filter((p) => !!p.url && p.url.startsWith('http'));
    if (validPairs.length === 0) throw new Error('IG: ingen bild att posta');

    if (validPairs.length === 1) {
        const { url, idx } = validPairs[0];
        const cRes = await fetch(`${GRAPH}/${IG_USER_ID}/media`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: url, caption: resolveCaption(caption, [idx]), access_token: FB_PAGE_TOKEN }),
        });
        const cData = await cRes.json() as any;
        if (cData.error) throw new Error(`IG container: ${cData.error.message}`);
        console.log(`[IG] Container skapad: ${cData.id}, väntar på FINISHED…`);
        await waitForIgContainerReady(cData.id);
        const pRes = await fetch(`${GRAPH}/${IG_USER_ID}/media_publish`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: cData.id, access_token: FB_PAGE_TOKEN }),
        });
        const pData = await pRes.json() as any;
        if (pData.error) throw new Error(`IG publish: ${pData.error.message}`);
        return pData.id as string;
    }

    // Karusell: skapa item-containers → vänta på FINISHED per styck → wrapper.
    // Vi spårar ursprungsindex hela vägen och bygger bildtexten FÖRST när vi vet
    // exakt vilka bilder som blir slides (skippar både creation- och FINISHED-fel).
    const created: { childId: string; idx: number }[] = [];
    for (const { url, idx } of validPairs.slice(0, 10)) {
        const cRes = await fetch(`${GRAPH}/${IG_USER_ID}/media`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: FB_PAGE_TOKEN }),
        });
        const cData = await cRes.json() as any;
        if (cData.error) { console.warn(`[IG] Carousel-item misslyckades (${cData.error.message}) — skippar`); continue; }
        created.push({ childId: cData.id as string, idx });
    }
    if (created.length < 2) throw new Error('IG carousel kräver minst 2 giltiga bilder');
    console.log(`[IG] ${created.length} carousel-items skapade, väntar på FINISHED…`);

    const ready: { childId: string; idx: number }[] = [];
    for (const c of created) {
        try { await waitForIgContainerReady(c.childId); ready.push(c); }
        catch (e) { console.warn(`[IG] Carousel-item ${c.childId} blev inte klart (${(e as Error).message}) — skippar`); }
    }
    if (ready.length < 2) throw new Error('IG carousel kräver minst 2 giltiga bilder');
    console.log(`[IG] ${ready.length} items klara — skapar carousel-wrapper…`);

    const childIds = ready.map((r) => r.childId);
    const finalCaption = resolveCaption(caption, ready.map((r) => r.idx));

    const wrapperRes = await fetch(`${GRAPH}/${IG_USER_ID}/media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds.join(','), caption: finalCaption, access_token: FB_PAGE_TOKEN }),
    });
    const wrapperData = await wrapperRes.json() as any;
    if (wrapperData.error) throw new Error(`IG carousel container: ${wrapperData.error.message}`);
    console.log(`[IG] Wrapper skapad: ${wrapperData.id}, väntar på FINISHED…`);
    await waitForIgContainerReady(wrapperData.id);

    const pRes = await fetch(`${GRAPH}/${IG_USER_ID}/media_publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: wrapperData.id, access_token: FB_PAGE_TOKEN }),
    });
    const pData = await pRes.json() as any;
    if (pData.error) throw new Error(`IG carousel publish: ${pData.error.message}`);
    return pData.id as string;
}
