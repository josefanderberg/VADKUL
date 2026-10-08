/**
 * vastbosportdans - Västbo Sportdansklubbs danskvällar (vastbosportdansklubb.se).
 *
 * Klubben i Gislaved ordnar socialdans (bugg/FOX till levande dansband) i
 * Smålandsstenar, Värnamo och Gislaved. Tipsat av en användare 2026-09-28.
 *
 * Sajten är byggd i one.com:s sajtbyggare: ingen JSON-LD, ingen sitemap med
 * event, inga detaljsidor. Kvällarna står som handskrivna rubriker på sidan
 * "Kurser & Evenemang", under h2:an "Evenemang <år>":
 *
 *   <h3>fredag 2 oktober</h3><h3>Dans till PHs</h3>
 *   <p>Socialdans i Bugg, FOX ... <br>Plats: Torghuset Smålandsstenar</p>
 *   <p>kl. 19:00-23:00</p>
 *
 * Sidan /socialdans har samma kvällar men UTAN veckodag - därför läses
 * kurssidan: veckodagen avgör året (parseSwedishDateWeekdayChecked), och
 * passerade kvällar (våren står kvar hela hösten) faller bort av sig själva.
 *
 * Kurserna (bugg/linedance-terminer) ligger i dans.se/CogWork och tas
 * MEDVETET inte in - veckopass i klubblokalen är inte event.
 *
 * Ingen egen eventsida → url = /socialdans#<datum> (samma mönster som fhp/turid).
 */

import * as cheerio from 'cheerio';
import { Engine, RawEvent } from '../sources/types';
import { parseSwedishDateWeekdayChecked } from '../utils/swedishDate';
import { decodeHtmlEntities } from '../utils/text';
import { domainLimiter } from '../sources/rateLimiter';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const BASE = 'https://vastbosportdansklubb.se';

const WEEKDAY = '(?:måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)';
const MONTH = '(?:jan(?:uari)?|feb(?:ruari)?|mars?|apr(?:il)?|maj|juni?|juli?|aug(?:usti)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_RE = new RegExp(`^(${WEEKDAY})\\s+(\\d{1,2})\\s+(${MONTH})\\.?$`, 'i');

/**
 * Kurssidans HTML → danskvällar. Exporterad för test.
 * `now` styr årsinferensen (veckodagskontrollerad, bara framåt).
 */
export function parseVastboEvents(html: string, now = new Date()): RawEvent[] {
    const $ = cheerio.load(html);

    // Sidan som platt radlista: rubriker och stycken blir egna rader, <br> radbryter.
    $('br').replaceWith('\n');
    $('script, style').remove();
    const lines: string[] = [];
    $('h1, h2, h3, h4, p').each((_i, el) => {
        for (const raw of $(el).text().split('\n')) {
            const line = decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim();
            if (line) lines.push(line);
        }
    });

    // Bilderna ligger absolutpositionerade och i fel ordning mot texten, men
    // filnamnet bär bandets namn (".../Dansband Socialdans/PHs-press_logga.png").
    const images: string[] = [];
    $('img[src*="Socialdans"]').each((_i, el) => {
        const src = $(el).attr('src');
        // Utan query = originalbilden i stället för sajtens beskurna miniatyr.
        if (src) images.push(src.split('?')[0]);
    });

    const events: RawEvent[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        const dm = lines[i].match(DATE_RE);
        if (!dm) continue;
        const title = lines[i + 1];
        if (!title || DATE_RE.test(title)) continue;

        // Blocket = raderna till och med klockslaget ("kl. 19:00-23:00"), max 6.
        // Sista kvällen följs direkt av köpvillkoren - utan stoppet läcker de in.
        const block: string[] = [];
        for (let j = i + 2; j < Math.min(lines.length, i + 8); j++) {
            if (DATE_RE.test(lines[j])) break;
            block.push(lines[j]);
            if (/^kl\.?\s*\d/i.test(lines[j])) break;
        }
        const text = block.join('\n');
        const time = text.match(/kl\.?\s*(\d{1,2})[:.](\d{2})(?:\s*[-–]\s*(\d{1,2})[:.](\d{2}))?/i);
        const start = parseSwedishDateWeekdayChecked(
            `${dm[1]} ${dm[2]} ${dm[3]}${time ? ` ${time[1]}:${time[2]}` : ''}`, now);
        if (!start) continue;   // passerad kväll eller veckodag som inte går ihop

        let end: Date | undefined;
        if (time?.[3]) {
            end = new Date(start);
            end.setHours(parseInt(time[3], 10), parseInt(time[4], 10), 0, 0);
            if (end <= start) end.setDate(end.getDate() + 1);   // efter midnatt
        }

        // "Plats: Torghuset Smålandsstenar" → lokal + ort (sista ordet).
        const place = text.match(/Plats:\s*([^\n]+)/i)?.[1].trim();
        let venueName: string | undefined;
        let city: string | undefined;
        if (place) {
            const words = place.split(' ');
            city = words.length > 1 ? words.pop() : undefined;
            venueName = words.join(' ');
        }

        const description = block
            .filter(l => !/^(Plats:|kl\.|Läs mer)/i.test(l))
            .join(' ')
            .trim() || undefined;

        // Bandnamnet = det som står efter "till" i titeln ("Dans till PHs").
        const band = title.match(/\btill\s+(.+)$/i)?.[1].trim().toLowerCase();
        const imageUrl = band
            ? images.find(src => decodeURIComponent(src).toLowerCase().includes(band))
            : undefined;

        const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        const url = `${BASE}/socialdans#${iso}`;
        if (seen.has(url)) continue;   // sidan kan rendera blocket två gånger (mobil/desktop)
        seen.add(url);

        events.push({
            title,
            startDate: start,
            endDate: end,
            url,
            venueName,
            city,
            geocodeCandidates: place && city ? [`${venueName}, ${city}`, city] : undefined,
            description,
            imageUrl,
            organizer: 'Västbo Sportdansklubb',
            classifyHints: 'socialdans dans dansband bugg fox',
            hasSpecificTime: !!time,
        });
    }
    return events;
}

export const vastbosportdansEngine: Engine = async (_config, ctx) => {
    const url = `${BASE}/kurser-evenemang`;
    await domainLimiter.wait(url);
    const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.1' },
        signal: ctx.signal ?? AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`vastbosportdans: HTTP ${res.status}`);
    const events = parseVastboEvents(await res.text());
    ctx.log(`vastbosportdans: ${events.length} kommande danskvällar`);
    return events;
};
