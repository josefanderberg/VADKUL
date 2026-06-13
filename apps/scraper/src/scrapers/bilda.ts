/**
 * Bilda (studieförbund) — publika kulturprogram via öppen WP REST.
 *
 * Recon 2026-06-12 (verifierat): CPT `arr`, taxonomin arr-type=674 =
 * "Kulturprogram" (studieförbundens officiella verksamhetsform för publika
 * kulturarrangemang — skiljer event från studiecirklar/kurser).
 *
 *   GET https://www.bilda.nu/wp-json/wp/v2/arr?arr-type=674&per_page=100&page=N&_embed
 *
 * Guldkornet: meta["arr-meta-data"] är en JSON-STRÄNG med Bildas kompletta
 * interna post (Gustav-systemet): starttid/sluttid med klockslag (ISO),
 * lokal + lokaladress + lokalpostnr + lokalort (EXAKT gatuadress → perfekt
 * geokodning), deltagaravgift, webbingress/webbtext.
 *
 * Fallgropar: longitud/latitud i posten är AVRUNDADE heltal eller 0 —
 * använd aldrig; geokoda adressen. lokalort är VERSALER. robots.txt
 * disallow:ar /wp-json/ (Yoast-standard) men endpointen är öppen och cachad.
 */

import { RawEvent, Engine } from '../sources/types';

const API = 'https://www.bilda.nu/wp-json/wp/v2/arr';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const KULTURPROGRAM = 674;

function titleCase(s: string): string {
    return s.toLowerCase().replace(/(^|[\s-])([a-zåäö])/g, (m) => m.toUpperCase());
}

function stripHtml(html: string | undefined): string {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** Mappa en arr-post → RawEvent. Exporterad för test. */
export function mapBildaArr(post: any): RawEvent | null {
    let meta: any;
    try {
        meta = JSON.parse(post?.meta?.['arr-meta-data'] ?? 'null');
    } catch { meta = null; }
    if (!meta) return null;

    const title = (meta.webbrubrik || meta.namn || stripHtml(post?.title?.rendered) || '').trim();
    if (!title) return null;

    // starttid har klockslag; startdatum är 00:00. Båda är lokal svensk tid.
    const startIso: string | undefined = meta.starttid || meta.startdatum;
    if (!startIso) return null;
    const startDate = new Date(startIso);   // ISO utan Z → lokal tolkning (rätt)
    if (isNaN(startDate.getTime())) return null;
    const hasClock = !!meta.starttid && !/T00:00:00/.test(meta.starttid);

    const city = meta.lokalort ? titleCase(String(meta.lokalort).trim()) : undefined;
    const address = [meta.lokaladress, [meta.lokalpostnr, city].filter(Boolean).join(' ')]
        .filter(Boolean).join(', ') || undefined;
    const avgift = Number(meta.deltagaravgift ?? NaN);

    const media = post?._embedded?.['wp:featuredmedia']?.[0]?.source_url;

    return {
        externalId: String(meta.nummer ?? post?.id ?? ''),
        title,
        startDate,
        endDate: meta.sluttid ? new Date(meta.sluttid) : undefined,
        url: post?.link,
        venueName: meta.lokal?.trim() || undefined,
        address: meta.lokaladress?.trim() || address,
        city,
        imageUrl: media || undefined,
        description: stripHtml(meta.webbingress || meta.webbtext).slice(0, 600),
        price: Number.isFinite(avgift) ? (avgift === 0 ? 'Gratis' : `${avgift} kr`) : null as any,
        category: 'culture',
        hostName: 'Bilda',
        hasSpecificTime: hasClock,
    };
}

export const bildaEngine: Engine = async (_config, ctx) => {
    const all: RawEvent[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && page <= 20) {
        try {
            const res = await fetch(`${API}?arr-type=${KULTURPROGRAM}&per_page=100&page=${page}&_embed`, {
                headers: { 'User-Agent': UA, 'Accept': 'application/json' },
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`HTTP ${res.status} på sida ${page}`); break; }
            totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
            const posts: any[] = await res.json();
            if (!Array.isArray(posts) || posts.length === 0) break;
            for (const p of posts) {
                const ev = mapBildaArr(p);
                if (ev) all.push(ev);
            }
        } catch (err) {
            ctx.log(`sida ${page}: ${(err as Error).message}`);
            break;
        }
        page++;
    }
    ctx.log(`${all.length} kulturprogram (arr-type=${KULTURPROGRAM})`);
    return all;
};
