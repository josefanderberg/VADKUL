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
