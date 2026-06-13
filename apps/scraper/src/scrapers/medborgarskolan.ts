/**
 * Medborgarskolan (studieförbund) — publika arrangemang via öppet Wagtail-API.
 *
 * Recon 2026-06-12 (verifierat):
 *   GET https://www.medborgarskolan.se/wt/api/v2/eventsearch/?type=<ids>&sort=date&p=N
 *
 * type-id:n skiljer ARRANGEMANG från kurskatalogen (4 676 totalt → ~404):
 *   10000 Föreläsning, 10090 Konsert, 10020 Workshop, 30150 Prova på,
 *   10060 Utställning, 10030 Föreställning
 *
 * Fält: meta[] är typade textfält (location/start/time/price), datum som
 * "30 Sep 2025" (svensk/engelsk månadsblandning — mappas), tid "10:00-15:00".
 * Ingen gatuadress/koordinater — bara ort (geokodas stad-nivå; detaljsidan
 * har inte mer). ld_entity.image.url ger bild.
 */

import { RawEvent, Engine } from '../sources/types';

const API = 'https://www.medborgarskolan.se/wt/api/v2/eventsearch/';
const SITE = 'https://www.medborgarskolan.se';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const EVENT_TYPE_IDS = '10000,10090,10020,30150,10060,10030';
const MAX_PAGES = 60;

const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, maj: 5, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12,
};

/** "30 Sep 2025" + "10:00-15:00" → Date (lokal svensk tid). Exporterad för test. */
export function parseMbskDate(startText: string | undefined, timeText: string | undefined): { date: Date; hasClock: boolean } | null {
    if (!startText) return null;
    const m = startText.trim().match(/^(\d{1,2})\s+([A-Za-zåäö]{3,})\.?\s+(\d{4})$/);
    if (!m) return null;
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!month) return null;
    const day = parseInt(m[1], 10);
    const year = parseInt(m[3], 10);

    let hh = 0, mm = 0, hasClock = false;
    const t = (timeText || '').match(/^(\d{1,2})[:.](\d{2})/);
    if (t) { hh = parseInt(t[1], 10); mm = parseInt(t[2], 10); hasClock = true; }

    const date = new Date(year, month - 1, day, hh, mm, 0, 0);
    return isNaN(date.getTime()) ? null : { date, hasClock };
}

/** Mappa ett sök-item → RawEvent. Exporterad för test. */
export function mapMbskItem(item: any): RawEvent | null {
    const title = (item?.title || '').trim();
    const href = item?.link?.href;
    if (!title || !href) return null;

    const metaOf = (type: string) => (item.meta || []).find((x: any) => x?.type === type)?.text as string | undefined;
    const parsed = parseMbskDate(metaOf('start'), metaOf('time'));
    if (!parsed) return null;

    const city = metaOf('location')?.trim();
    const price = metaOf('price')?.trim();

    return {
        externalId: String(item.id ?? ''),
        title,
        startDate: parsed.date,
        url: href.startsWith('http') ? href : `${SITE}${href}`,
        city: city || undefined,
        venueName: city || undefined,
        imageUrl: item?.ld_entity?.image?.url || undefined,
        description: (item?.ld_entity?.description || '').trim().slice(0, 600)
            || `${item?.type ? item.type + ' med ' : ''}Medborgarskolan${city ? ` i ${city}` : ''}.`,
        price: price || null as any,
        hostName: 'Medborgarskolan',
        hasSpecificTime: parsed.hasClock,
    };
}

export const medborgarskolanEngine: Engine = async (_config, ctx) => {
    const all: RawEvent[] = [];
    let page = 1;
    let numPages = 1;
    let pastWindow = 0;
    while (page <= numPages && page <= MAX_PAGES) {
        try {
            const res = await fetch(`${API}?type=${EVENT_TYPE_IDS}&sort=date&p=${page}`, {
                headers: { 'User-Agent': UA, 'Accept': 'application/json' },
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`HTTP ${res.status} på sida ${page}`); break; }
            const data: any = await res.json();
            numPages = data?.list?.paginate?.numPages ?? page;
            const items: any[] = data?.list?.items ?? [];
            if (items.length === 0) break;
            for (const it of items) {
                const ev = mapMbskItem(it);
                if (!ev) continue;
                all.push(ev);
                // sort=date är stigande — när vi passerat fönstrets slut är
                // resten ännu längre fram; två hela sidor bortom → klipp.
                if (ev.startDate > ctx.windowEnd) pastWindow++;
            }
            if (pastWindow > 20) { ctx.log(`klipper paginering på sida ${page} (bortom fönstret)`); break; }
        } catch (err) {
            ctx.log(`sida ${page}: ${(err as Error).message}`);
            break;
        }
        page++;
    }
    ctx.log(`${all.length} arrangemang skannade`);
    return all;
};
