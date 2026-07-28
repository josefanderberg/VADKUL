/**
 * Bergmancenter Fårö — kalendern på bergmancenter.se (bio, guidade turer,
 * cykelsafari, samtal). Del av Gotland-maxningen 2026-07-27.
 *
 * Ej WP (custom CMS; tom sitemap, ingen wp-json). Listsidan är dock
 * server-renderad:
 *
 *   GET https://bergmancenter.se/kalender?dateRange=anytime
 *   → <article>-block med: kategori-span ("Bio —"), datum-span
 *     "2026.07.28 16:00-17:40", <a href="https://bergmancenter.se/evenemang/
 *     <slug>"> och <h3>-titel + <img>.
 *
 * Fällor (verifierade):
 *  - Detaljsidorna SAKNAR datum helt — allt måste ur listsidan.
 *  - /evenemang/<slug> är per PRODUKTION, inte per tillfälle — samma film
 *    flera datum ger samma URL ⇒ runnerns URL-dedup behåller första
 *    tillfället (samma serie-beteende som PRO/Nortic — medvetet).
 *  - h3 används även i sidfot/nav ("Kontakt", "Öppettider") — bara h3 inuti
 *    article-block med datum räknas.
 */

import { RawEvent, Engine } from '../sources/types';
import { decodeHtmlEntities } from '../utils/text';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_LIST = 'https://bergmancenter.se/kalender?dateRange=anytime';
// Bergmancenter, Fårö Dämba — fast venue, alla event är i/vid huset.
const COORDS: [number, number] = [57.9107, 19.0603];

export interface BergmancenterConfig {
    listUrl?: string;
}

/** Parsa listsidans HTML → RawEvents. Exporterad för test. */
export function parseBergmanList(html: string): RawEvent[] {
    const events: RawEvent[] = [];
    for (const block of html.split(/<article\b/).slice(1)) {
        const article = block.slice(0, block.indexOf('</article>'));
        const dateM = article.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})(?:-(\d{2}):(\d{2}))?/);
        const linkM = article.match(/href="(https:\/\/bergmancenter\.se\/evenemang\/[^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/);
        if (!dateM || !linkM) continue;

        const [, y, mo, da, hh, mi, eh, em] = dateM;
        const startDate = new Date(+y, +mo - 1, +da, +hh, +mi);
        if (isNaN(startDate.getTime())) continue;
        const endDate = eh ? new Date(+y, +mo - 1, +da, +eh, +em) : undefined;

        const title = decodeHtmlEntities(linkM[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        if (!title) continue;

        const catM = article.match(/text-bc-red">\s*([^<]+?)\s*(?:—|<)/);
        const imgM = article.match(/<img[^>]+src="(https:\/\/bergmancenter\.se\/[^"]+)"/)
            || article.match(/srcset="(https:\/\/bergmancenter\.se\/[^\s",]+)/);

        events.push({
            title,
            startDate,
            endDate: endDate && endDate > startDate ? endDate : undefined,
            url: linkM[1],
            venueName: 'Bergmancenter',
            city: 'Fårö',
            coords: COORDS,
            imageUrl: imgM?.[1],
            category: catM?.[1]?.trim().toLowerCase() || undefined,
            hasSpecificTime: true,
        });
    }
    return events;
}

export const bergmancenterEngine: Engine = async (config: BergmancenterConfig, ctx) => {
    const res = await fetch(config.listUrl || DEFAULT_LIST, {
        headers: { 'User-Agent': UA },
        signal: ctx.signal ?? AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`listsida HTTP ${res.status}`);
    const events = parseBergmanList(await res.text());
    ctx.log(`${events.length} tillfällen på listsidan`);
    return events;
};
