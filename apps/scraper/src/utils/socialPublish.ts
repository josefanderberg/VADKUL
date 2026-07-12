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

/**
 * Bildtext för ett inlägg (FB eller IG). Antingen en färdig sträng, eller en
 * byggare som anropas med indexen (in i den inskickade `imageUrls`-arrayen)
 * för de bilder som FAKTISKT gick igenom plattformens validering och blir
 * bilder/slides i inlägget. Byggaren låter anroparen renumrera texten så den
 * matchar bilderna 1:1 — Meta avvisar bilder (otillåten aspect ratio, fel
 * filtyp, död URL) vid uppladdning, så en text som bakas i förväg riskerar
 * att lista fler event än det finns bilder.
 */
export type IgCaption = string | ((keptIndices: number[]) => string);

function resolveCaption(caption: IgCaption, keptIndices: number[]): string {
    return typeof caption === 'function' ? caption(keptIndices) : caption;
}

/** Para ihop varje URL med sitt ursprungsindex och släng ogiltiga. */
function validImagePairs(urls: string[]): { url: string; idx: number }[] {
    return urls
        .map((url, idx) => ({ url, idx }))
        .filter((p) => !!p.url && p.url.startsWith('http'));
}

// ── Facebook ──────────────────────────────────────────────────────────────────

/**
 * Publicera till Facebook-sidan.
 *   0 bilder → feed-inlägg · 1 bild → /photos · 2+ → multi-photo feed.
 *
 * `imageUrls` behandlas som en KÖ: de första `target` som Facebook accepterar
 * blir inläggets bilder, resten är reserver. Skicka alltså med fler URL:er än
 * `target` så fylls det på när en uppladdning avvisas. `message` kan vara en
 * byggar-funktion (IgCaption) som får indexen för de bilder som faktiskt kom med.
 */
export async function postToFacebook(message: IgCaption, imageUrls: string[], target = 10): Promise<string> {
    const FB_PAGE_ID = fbPageId(), FB_PAGE_TOKEN = fbPageToken();
    const validPairs = validImagePairs(imageUrls);

    const postFeed = async (msg: string, mediaIds: string[]): Promise<string> => {
        const body: Record<string, unknown> = { message: msg, access_token: FB_PAGE_TOKEN };
        if (mediaIds.length > 0) body.attached_media = mediaIds.map((id) => ({ media_fbid: id }));
        const res = await fetch(`${GRAPH}/${FB_PAGE_ID}/feed`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json() as any;
        if (data.error) throw new Error(`FB API ${data.error.code}: ${data.error.message}`);
        return data.id as string;
    };

    if (validPairs.length === 0) return postFeed(resolveCaption(message, []), []);

    if (validPairs.length === 1) {
        const { url, idx } = validPairs[0];
        const res = await fetch(`${GRAPH}/${FB_PAGE_ID}/photos`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption: resolveCaption(message, [idx]), url, access_token: FB_PAGE_TOKEN }),
        });
        const data = await res.json() as any;
        if (data.error) {
            console.warn(`[FB] Bildpost misslyckades (${data.error.message}) — postar utan bild`);
            return postFeed(resolveCaption(message, [idx]), []);
        }
        return data.id as string;
    }

    // Multi-photo: gå igenom kön och ladda upp (unpublished) tills vi har
    // `target` accepterade bilder eller kön är slut → feed med attached_media.
    const kept: number[] = [];
    const mediaIds: string[] = [];
    for (const { url, idx } of validPairs) {
        if (mediaIds.length >= target) break;
        const res = await fetch(`${GRAPH}/${FB_PAGE_ID}/photos`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, published: false, access_token: FB_PAGE_TOKEN }),
        });
        const data = await res.json() as any;
        if (data.error) { console.warn(`[FB] Upload misslyckades (${data.error.message}) — tar nästa i kön`); continue; }
        mediaIds.push(data.id as string);
        kept.push(idx);
    }
    if (mediaIds.length === 0) {
        console.warn('[FB] Inga bilder gick att ladda upp — postar utan');
        return postFeed(resolveCaption(message, validPairs.slice(0, target).map((p) => p.idx)), []);
    }

    const postId = await postFeed(resolveCaption(message, kept), mediaIds);
    console.log(`[FB] Multi-photo post med ${mediaIds.length} bilder`);
    return postId;
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
 * Publicera till Instagram. 1 bild = single post, 2–10 = karusell.
 * Kräver att bilderna är publika https-URL:er (Meta hämtar dem serverside).
 *
 * `imageUrls` behandlas som en KÖ (som i postToFacebook): de första `target`
 * som passerar IG:s validering blir slides, resten är reserver som fyller på
 * när IG avvisar en bild. `caption` kan vara en byggar-funktion (se IgCaption)
 * som renumrerar texten efter de bilder som faktiskt blev slides.
 */
export async function postToInstagram(caption: IgCaption, imageUrls: string[], target = 10): Promise<string> {
    const IG_USER_ID = igUserId(), FB_PAGE_TOKEN = fbPageToken();
    const igTarget = Math.min(target, 10); // IG-karusell är max 10 slides
    // Behåll ursprungsindex så en caption-byggare kan mappa tillbaka till event.
    const validPairs = validImagePairs(imageUrls);
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
    // exakt vilka bilder som blir slides. Avvisade bilder (creation- eller
    // FINISHED-fel) ersätts från resten av kön tills vi når `igTarget`.
    const createItem = async (url: string): Promise<string | null> => {
        const cRes = await fetch(`${GRAPH}/${IG_USER_ID}/media`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: FB_PAGE_TOKEN }),
        });
        const cData = await cRes.json() as any;
        if (cData.error) { console.warn(`[IG] Carousel-item misslyckades (${cData.error.message}) — tar nästa i kön`); return null; }
        return cData.id as string;
    };
    const awaitReady = async (childId: string): Promise<boolean> => {
        try { await waitForIgContainerReady(childId); return true; }
        catch (e) { console.warn(`[IG] Carousel-item ${childId} blev inte klart (${(e as Error).message}) — tar nästa i kön`); return false; }
    };

    // Svep 1: skapa containers tills vi har `igTarget` (creation-fel äter kö
    // direkt), invänta sedan alla — Metas processning löper parallellt.
    let qi = 0;
    const created: { childId: string; idx: number }[] = [];
    while (created.length < igTarget && qi < validPairs.length) {
        const p = validPairs[qi++];
        const childId = await createItem(p.url);
        if (childId) created.push({ childId, idx: p.idx });
    }
    console.log(`[IG] ${created.length} carousel-items skapade, väntar på FINISHED…`);
    const ready: { childId: string; idx: number }[] = [];
    for (const c of created) {
        if (await awaitReady(c.childId)) ready.push(c);
    }
    // Svep 2: fyll på seriellt från kön för items som föll på FINISHED.
    while (ready.length < igTarget && qi < validPairs.length) {
        const p = validPairs[qi++];
        const childId = await createItem(p.url);
        if (childId && await awaitReady(childId)) ready.push({ childId, idx: p.idx });
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
