import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sätt config INNAN import — loadSocialSecrets skriver aldrig över befintliga env.
process.env.FB_PAGE_ID = 'PAGE';
process.env.FB_PAGE_TOKEN = 'TOKEN';
process.env.IG_USER_ID = 'IGUSER';

import { postToFacebook, postToInstagram } from './socialPublish';

/** Minimal Response-mock. */
const jsonRes = (obj: unknown) => ({ json: async () => obj });

type FetchCall = { url: string; body: any };
let calls: FetchCall[];

/**
 * Fejkad Graph API. Beteende styrs av:
 *   failUpload   — bild-URL:er vars FB-upload / IG-container-skapande avvisas
 *   failFinished — IG-container-IDs som får status ERROR i stället för FINISHED
 */
function installFetchMock(opts: { failUpload?: Set<string>; failFinished?: Set<string> } = {}) {
    const failUpload = opts.failUpload ?? new Set<string>();
    const failFinished = opts.failFinished ?? new Set<string>();
    let mediaN = 0;
    let containerN = 0;
    calls = [];

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
        const body = init?.body ? JSON.parse(init.body) : undefined;
        calls.push({ url, body });

        // IG: status-poll för container
        if (url.includes('fields=status_code')) {
            const id = url.split('/').pop()!.split('?')[0];
            return jsonRes(failFinished.has(id)
                ? { status_code: 'ERROR', status: 'bad image' }
                : { status_code: 'FINISHED' });
        }
        // IG: media_publish
        if (url.includes('/media_publish')) return jsonRes({ id: 'igpost' });
        // IG: skapa container (single, carousel-item eller wrapper)
        if (url.includes('/IGUSER/media')) {
            if (body?.media_type === 'CAROUSEL') return jsonRes({ id: 'wrap' });
            if (failUpload.has(body?.image_url)) {
                return jsonRes({ error: { code: 100, message: 'The aspect ratio is not supported.' } });
            }
            return jsonRes({ id: `c${containerN++}` });
        }
        // FB: foto-upload
        if (url.includes('/PAGE/photos')) {
            if (failUpload.has(body?.url)) {
                return jsonRes({ error: { code: 100, message: 'Invalid parameter' } });
            }
            return jsonRes({ id: `m${mediaN++}` });
        }
        // FB: feed-post
        if (url.includes('/PAGE/feed')) return jsonRes({ id: 'feedpost' });
        throw new Error(`Oväntad URL i test: ${url}`);
    }));
}

const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://img.example/u${i}.jpg`);
const u = (i: number) => `https://img.example/u${i}.jpg`;

beforeEach(() => {
    vi.unstubAllGlobals();
});

describe('postToFacebook — kö med påfyllnad', () => {
    it('fyller på från kön tills target nås och bygger texten från de bilder som kom med', async () => {
        installFetchMock({ failUpload: new Set([u(1), u(3)]) });
        let kept: number[] = [];
        const id = await postToFacebook(k => { kept = k; return `caption:${k.join(',')}`; }, urls(12), 10);

        expect(id).toBe('feedpost');
        // u1 + u3 avvisas → de 10 som kommer med är 0,2,4..11
        expect(kept).toEqual([0, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
        const feed = calls.find(c => c.url.includes('/PAGE/feed'))!;
        expect(feed.body.attached_media).toHaveLength(10);
        expect(feed.body.message).toBe('caption:0,2,4,5,6,7,8,9,10,11');
    });

    it('laddar inte upp fler än target när allt lyckas', async () => {
        installFetchMock();
        await postToFacebook(() => 'x', urls(15), 10);
        const uploads = calls.filter(c => c.url.includes('/PAGE/photos'));
        expect(uploads).toHaveLength(10);
    });

    it('faller tillbaka på textinlägg (med target-listan) när alla uploads fallerar', async () => {
        installFetchMock({ failUpload: new Set(urls(3)) });
        let kept: number[] = [];
        const id = await postToFacebook(k => { kept = k; return 'text-only'; }, urls(3), 10);
        expect(id).toBe('feedpost');
        expect(kept).toEqual([0, 1, 2]);
        const feed = calls.find(c => c.url.includes('/PAGE/feed'))!;
        expect(feed.body.attached_media).toBeUndefined();
    });

    it('är bakåtkompatibel med vanlig sträng-caption', async () => {
        installFetchMock();
        const id = await postToFacebook('hej', urls(3));
        expect(id).toBe('feedpost');
        const feed = calls.find(c => c.url.includes('/PAGE/feed'))!;
        expect(feed.body.message).toBe('hej');
        expect(feed.body.attached_media).toHaveLength(3);
    });

    it('en enda giltig bild → /photos med caption byggd från rätt index', async () => {
        installFetchMock();
        const id = await postToFacebook(k => `single:${k.join(',')}`, ['', u(7)]);
        expect(id).toBe('m0');
        const photo = calls.find(c => c.url.includes('/PAGE/photos'))!;
        expect(photo.body.caption).toBe('single:1');
        expect(photo.body.url).toBe(u(7));
    });
});

describe('postToFacebook — schemaläggning', () => {
    const inDays = (d: number) => Date.now() + d * 86_400_000;

    it('skickar published:false + scheduled_publish_time i SEKUNDER', async () => {
        installFetchMock();
        const when = inDays(3);
        await postToFacebook('text', [], 10, { scheduledFor: when });
        const feed = calls.find(c => c.url.includes('/PAGE/feed'))!;
        expect(feed.body.published).toBe(false);
        expect(feed.body.scheduled_publish_time).toBe(Math.floor(when / 1000));
    });

    it('schemalägger EN bild via /photos och gör aldrig multi-photo', async () => {
        installFetchMock();
        const when = inDays(3);
        // Fem bilder i kön, men schemalagt ⇒ bara den första ska laddas upp
        // och ingen feed-post med attached_media får skickas.
        const id = await postToFacebook('text', urls(5), 10, { scheduledFor: when });
        const photos = calls.filter(c => c.url.includes('/PAGE/photos'));
        expect(photos).toHaveLength(1);
        expect(photos[0].body.published).toBe(false);
        expect(photos[0].body.scheduled_publish_time).toBe(Math.floor(when / 1000));
        expect(calls.some(c => c.url.includes('/PAGE/feed'))).toBe(false);
        expect(id).toBe('m0');
    });

    it('tar nästa bild ur kön när Meta avvisar den första', async () => {
        installFetchMock({ failUpload: new Set([u(0)]) });
        await postToFacebook('text', urls(3), 10, { scheduledFor: inDays(2) });
        const photos = calls.filter(c => c.url.includes('/PAGE/photos'));
        expect(photos).toHaveLength(2);
        expect(photos[1].body.url).toBe(u(1));
    });

    it('faller tillbaka på schemalagt textinlägg när ingen bild går igenom', async () => {
        installFetchMock({ failUpload: new Set(urls(3)) });
        const when = inDays(2);
        const id = await postToFacebook('text', urls(3), 10, { scheduledFor: when });
        expect(id).toBe('feedpost');
        const feed = calls.find(c => c.url.includes('/PAGE/feed'))!;
        expect(feed.body.published).toBe(false);
        expect(feed.body.scheduled_publish_time).toBe(Math.floor(when / 1000));
    });

    it('använder post_id (story) före photo-id när Meta ger båda', async () => {
        installFetchMock();
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ id: 'photo123', post_id: 'PAGE_story456' })));
        const id = await postToFacebook('text', [u(0)], 10, { scheduledFor: inDays(1) });
        expect(id).toBe('PAGE_story456');
    });

    it('vägrar tider utanför fönstret 10 min – 30 dygn', async () => {
        installFetchMock();
        await expect(postToFacebook('t', [], 10, { scheduledFor: Date.now() + 60_000 }))
            .rejects.toThrow(/minst 10 min/);
        await expect(postToFacebook('t', [], 10, { scheduledFor: inDays(31) }))
            .rejects.toThrow(/inom 30 dygn/);
        // Inget nätanrop får ha gjorts för de avvisade tiderna.
        expect(calls).toHaveLength(0);
    });

    it('postar direkt (utan schemafält) när scheduledFor utelämnas', async () => {
        installFetchMock();
        await postToFacebook('text', [], 10);
        const feed = calls.find(c => c.url.includes('/PAGE/feed'))!;
        expect(feed.body.published).toBeUndefined();
        expect(feed.body.scheduled_publish_time).toBeUndefined();
    });
});

describe('postToInstagram — karusell med påfyllnad', () => {
    it('ersätter avvisade bilder (creation + FINISHED) från kön tills target nås', async () => {
        // u0 avvisas vid skapandet; u1→c0, u2→c1, u3→c2 skapas (svep 1, target 3).
        // c1 (u2) fallerar FINISHED → svep 2 tar u4→c3 som blir klar.
        installFetchMock({ failUpload: new Set([u(0)]), failFinished: new Set(['c1']) });
        let kept: number[] = [];
        const id = await postToInstagram(k => { kept = k; return `ig:${k.join(',')}`; }, urls(6), 3);

        expect(id).toBe('igpost');
        expect(kept).toEqual([1, 3, 4]);
        const wrapper = calls.find(c => c.body?.media_type === 'CAROUSEL')!;
        expect(wrapper.body.children.split(',')).toHaveLength(3);
        expect(wrapper.body.caption).toBe('ig:1,3,4');
    });

    it('kastar när kön inte räcker till minst 2 slides', async () => {
        installFetchMock({ failUpload: new Set(urls(3).slice(1)) });
        await expect(postToInstagram('x', urls(3), 10)).rejects.toThrow('minst 2');
    });
});

/* ── Video: FB /videos + IG reel ─────────────────────────────────────────── */

import {
    postVideoToFacebook, postReelToInstagram, lookupInstagramUserId, getTokenScopes, facebookVideoPermalink,
} from './socialPublish';

/**
 * Fejkat Graph API för videovägarna. `igStatuses` spelas upp i ordning vid
 * status-pollarna (sista värdet upprepas); `fbError` får /videos att svara fel.
 */
function installVideoMock(opts: { igStatuses?: string[]; fbError?: string; igLinked?: boolean } = {}) {
    const statuses = [...(opts.igStatuses ?? ['FINISHED'])];
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
        const body = init?.body ? JSON.parse(init.body) : undefined;
        calls.push({ url, body });
        if (url.includes('/PAGE/videos')) {
            return jsonRes(opts.fbError ? { error: { code: 200, message: opts.fbError } } : { id: 'vid1' });
        }
        if (url.includes('fields=status_code')) {
            const s = statuses.length > 1 ? statuses.shift()! : statuses[0];
            return jsonRes({ status_code: s, status: s });
        }
        if (url.includes('/media_publish')) return jsonRes({ id: 'reel1' });
        if (url.includes('/IGUSER/media')) return jsonRes({ id: 'rc1' });
        if (url.includes('/PAGE?fields=instagram_business_account')) {
            return jsonRes(opts.igLinked === false ? { id: 'PAGE' } : { instagram_business_account: { id: 'IG-FOUND' } });
        }
        if (url.includes('/debug_token')) {
            return jsonRes({ data: { is_valid: true, scopes: ['pages_manage_posts', 'publish_video'], expires_at: 1800000000 } });
        }
        throw new Error(`Oväntad URL i test: ${url}`);
    }));
}

const VIDEO = 'https://storage.googleapis.com/b/marketing-videos/klipp.mp4';

describe('postVideoToFacebook', () => {
    it('schemalägger via /videos med file_url, published:false och sekunder', async () => {
        installVideoMock();
        const when = Date.now() + 3 * 86_400_000;
        const id = await postVideoToFacebook(VIDEO, 'texten', { title: 'Titeln', scheduledFor: when });
        expect(id).toBe('vid1');
        expect(calls).toHaveLength(1);
        const v = calls[0];
        expect(v.url).toContain('/PAGE/videos');
        expect(v.body).toMatchObject({
            file_url: VIDEO, description: 'texten', title: 'Titeln',
            published: false, scheduled_publish_time: Math.floor(when / 1000), access_token: 'TOKEN',
        });
    });

    it('publicerar direkt utan schemafält när scheduledFor saknas', async () => {
        installVideoMock();
        await postVideoToFacebook(VIDEO, 'texten');
        expect(calls[0].body.published).toBeUndefined();
        expect(calls[0].body.scheduled_publish_time).toBeUndefined();
        expect(calls[0].body.title).toBeUndefined();
    });

    it('vägrar schemalägga utanför fönstret (10 min – 30 dygn)', async () => {
        installVideoMock();
        await expect(postVideoToFacebook(VIDEO, 'x', { scheduledFor: Date.now() + 60_000 })).rejects.toThrow(/minst 10 min/);
        await expect(postVideoToFacebook(VIDEO, 'x', { scheduledFor: Date.now() + 31 * 86_400_000 })).rejects.toThrow(/30 dygn/);
        expect(calls).toHaveLength(0);
    });

    it('kräver en publik https-URL och lyfter Metas fel som det är', async () => {
        installVideoMock({ fbError: '(#200) Requires publish_video permission' });
        await expect(postVideoToFacebook('/tmp/klipp.mp4', 'x')).rejects.toThrow(/https/);
        expect(calls).toHaveLength(0);
        await expect(postVideoToFacebook(VIDEO, 'x')).rejects.toThrow(/FB API 200: .*publish_video/);
    });

    it('bygger permalinken ur sid-id + video-id', () => {
        expect(facebookVideoPermalink('PAGE', 'vid1')).toBe('https://www.facebook.com/PAGE/videos/vid1');
    });
});

describe('postReelToInstagram', () => {
    it('container (REELS + video_url) → FINISHED → media_publish', async () => {
        installVideoMock();
        const id = await postReelToInstagram('bildtext', VIDEO, { pollMs: 1 });
        expect(id).toBe('reel1');
        const create = calls.find(c => c.url.endsWith('/IGUSER/media'))!;
        expect(create.body).toMatchObject({ media_type: 'REELS', video_url: VIDEO, caption: 'bildtext', share_to_feed: true });
        const publish = calls.find(c => c.url.includes('/media_publish'))!;
        expect(publish.body.creation_id).toBe('rc1');
        // Ordningen: skapa → polla → publicera
        expect(calls.map(c => c.url.includes('/media_publish') ? 'publish' : c.url.includes('status_code') ? 'poll' : 'create'))
            .toEqual(['create', 'poll', 'publish']);
    });

    it('pollar tills Meta bearbetat videon', async () => {
        installVideoMock({ igStatuses: ['IN_PROGRESS', 'IN_PROGRESS', 'FINISHED'] });
        await postReelToInstagram('x', VIDEO, { pollMs: 1 });
        expect(calls.filter(c => c.url.includes('status_code'))).toHaveLength(3);
    });

    it('ger upp när containern får ERROR — ingen publicering', async () => {
        installVideoMock({ igStatuses: ['ERROR'] });
        await expect(postReelToInstagram('x', VIDEO, { pollMs: 1 })).rejects.toThrow(/status=ERROR/);
        expect(calls.some(c => c.url.includes('/media_publish'))).toBe(false);
    });

    it('väntar med media_publish till publishAt', async () => {
        installVideoMock();
        const publishAt = Date.now() + 250;
        let publishedAt = 0;
        const orig = fetch as unknown as (u: string, i?: any) => Promise<any>;
        vi.stubGlobal('fetch', vi.fn(async (url: string, init?: any) => {
            if (url.includes('/media_publish')) publishedAt = Date.now();
            return orig(url, init);
        }));
        await postReelToInstagram('x', VIDEO, { pollMs: 1, publishAt });
        expect(publishedAt).toBeGreaterThanOrEqual(publishAt);
    });

    it('publicerar direkt när publishAt redan passerat', async () => {
        installVideoMock();
        const t0 = Date.now();
        await postReelToInstagram('x', VIDEO, { pollMs: 1, publishAt: t0 - 60_000 });
        expect(Date.now() - t0).toBeLessThan(1000);
    });

    it('kräver https-URL', async () => {
        installVideoMock();
        await expect(postReelToInstagram('x', 'http://osäker/klipp.mp4')).rejects.toThrow(/https/);
        expect(calls).toHaveLength(0);
    });
});

describe('lookupInstagramUserId / getTokenScopes', () => {
    it('hittar sidans kopplade IG-konto, eller null', async () => {
        installVideoMock();
        expect(await lookupInstagramUserId()).toBe('IG-FOUND');
        installVideoMock({ igLinked: false });
        expect(await lookupInstagramUserId()).toBeNull();
    });

    it('läser scopes och utgång ur debug_token', async () => {
        installVideoMock();
        expect(await getTokenScopes()).toEqual({
            valid: true, scopes: ['pages_manage_posts', 'publish_video'], expiresAt: 1800000000 * 1000,
        });
    });
});
