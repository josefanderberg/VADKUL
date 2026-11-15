/**
 * Nationsguiden — Uppsalas tretton studentnationer i en kalender
 * (nationsguiden.se). Upptäckt 15/11 2026 i jämförelsen mot Happymap: den
 * förklarade större delen av Uppsalagapet (deras 945 event mot våra 336 i
 * förvalet). Pubar, klubbar, gasker, brunch, kultur och sport.
 *
 * Sajten är WordPress med ett eget temaanrop (robots.txt tillåter
 * admin-ajax.php):
 *
 *   POST https://www.nationsguiden.se/wp-admin/admin-ajax.php
 *        action=di_filter_events&nonce=<N>&selected_date=ÅÅÅÅ-MM-DD&only_load_dates=false
 *   → { event_categories: "<JSON-sträng>", dates: "<JSON-sträng>" }
 *
 * event_categories är en lista med kategorier, var och en med sina event för
 * DEN dagen: { title, permalink, image (<img>-HTML), schedule, organiser }.
 * Samma event står i flera kategorier. Nonce:n står i startsidans
 * `DI_FILTER_EVENTS` och hämtas en gång per körning.
 *
 * schedule är text: "Idag 10:00-14:00" för dagens, "fre 20/11 17:00-23:59"
 * för övriga. Ett pass över midnatt ("lör 14/11 23:00-04:00") visas även
 * dagen efter — det explicita datumet vinner, och url-nyckeln
 * (permalink + "#ÅÅÅÅ-MM-DD") gör att det bara blir en rad.
 *
 * Kategorier som inte är event hoppas: studieplatser, mottagningstider,
 * inskrivning, och de dagliga luncherna och frukostarna (en nations
 * lunchservering varje vardag skulle dränka allt annat).
 */

import { Engine, RawEvent } from '../sources/types';
import { domainLimiter } from '../sources/rateLimiter';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { decodeHtmlEntities } from '../utils/text';

const ORIGIN = 'https://www.nationsguiden.se';
const UA = 'VadKul/1.0 (+https://vadkul.se)';

/** Kategorier som inte är event (se filhuvudet). Jämförs i gemener. */
const SKIP_CATEGORIES = new Set(['studieplatser', 'mottagningstider', 'inskrivning', 'lunch', 'frukost']);

export interface NationsguidenEvent {
    title?: string;
    permalink?: string;
    image?: string;
    schedule?: string;
    organiser?: { title?: string; permalink?: string | false };
}

export interface NationsguidenCategory { title?: string; events?: NationsguidenEvent[] }

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * schedule-texten → start (och slut) i lokal tid. `day` är den dag svaret
 * gällde (ÅÅÅÅ-MM-DD); den används när texten säger "Idag" eller saknar datum.
 * Ett slut före starten ligger dagen efter (23:00-04:00). null utan klockslag.
 */
export function parseSchedule(schedule: string, day: string): { start: Date; end?: Date } | null {
    const [y, m, d] = day.split('-').map(Number);
    if (!y || !m || !d) return null;
    let year = y; let month = m; let date = d;
    const explicit = schedule.match(/(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/);
    if (explicit) {
        date = Number(explicit[1]); month = Number(explicit[2]);
        // Svaret för 2 januari kan visa ett pass från 31/12 — året innan.
        if (month > m + 6) year -= 1;
        else if (month < m - 6) year += 1;
    } else if (/imorgon/i.test(schedule)) {
        const t = new Date(y, m - 1, d + 1);
        year = t.getFullYear(); month = t.getMonth() + 1; date = t.getDate();
    }
    const times = [...schedule.matchAll(/(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)/g)].map((x) => [Number(x[1]), Number(x[2])]);
    if (times.length === 0) return null;
    const [sh, sm] = times[0];
    if (sh > 23 || sm > 59) return null;
    const start = new Date(year, month - 1, date, sh, sm);
    if (start.getMonth() !== month - 1 || start.getDate() !== date) return null;
    let end: Date | undefined;
    if (times[1] && times[1][0] <= 23 && times[1][1] <= 59) {
        end = new Date(year, month - 1, date, times[1][0], times[1][1]);
        if (end <= start) end = new Date(end.getTime() + 86_400_000);
    }
    return { start, end };
}

/** Bildens src ur <img>-HTML:en. */
function imageSrc(html: string | undefined): string | undefined {
    const src = html?.match(/\ssrc=['"]([^'"]+)['"]/)?.[1];
    return src && /^https?:\/\//.test(src) ? src.replace(/\\\//g, '/') : undefined;
}

/**
 * En dags svar → RawEvents. Ett event räknas om det står i minst en kategori
 * som inte hoppas; kategorierna blir klassificeringsledtrådar. Exporterad för test.
 */
export function mapNationsguidenDay(categories: NationsguidenCategory[], day: string): RawEvent[] {
    const byLink = new Map<string, { e: NationsguidenEvent; cats: string[] }>();
    for (const c of categories) {
        const cat = (c.title ?? '').trim();
        if (!cat || SKIP_CATEGORIES.has(cat.toLowerCase())) continue;
        for (const e of c.events ?? []) {
            if (!e.permalink) continue;
            const hit = byLink.get(e.permalink) ?? { e, cats: [] };
            if (!hit.cats.includes(cat)) hit.cats.push(cat);
            byLink.set(e.permalink, hit);
        }
    }
    const out: RawEvent[] = [];
    for (const [link, { e, cats }] of byLink) {
        const title = decodeHtmlEntities(e.title ?? '').replace(/\s+/g, ' ').trim();
        const when = parseSchedule(e.schedule ?? '', day);
        if (!title || !when) continue;
        const organiser = decodeHtmlEntities(e.organiser?.title ?? '').trim() || undefined;
        const stamp = `${when.start.getFullYear()}-${pad(when.start.getMonth() + 1)}-${pad(when.start.getDate())}`;
        out.push({
            title,
            startDate: when.start,
            endDate: when.end,
            hasSpecificTime: true,
            url: `${link.replace(/#.*$/, '')}#${stamp}`,
            // Nationens hus är platsen. "Studentidrott" och liknande saknar hus
            // — geokodningen faller då på Uppsala.
            venueName: organiser,
            city: 'Uppsala',
            hostName: organiser,
            imageUrl: imageSrc(e.image),
            classifyHints: cats.join(' '),
        });
    }
    return out;
}

/** Startsidans nonce för temaanropet (DI_FILTER_EVENTS). */
export function nonceFromHome(html: string): string | null {
    return html.match(/DI_FILTER_EVENTS\s*=\s*\{[^}]*"nonce"\s*:\s*"([^"]+)"/)?.[1] ?? null;
}

const headers = { 'User-Agent': UA, 'Accept-Language': 'sv-SE,sv;q=0.9' };

export const nationsguidenEngine: Engine = async (_config, ctx) => {
    await domainLimiter.wait(ORIGIN);
    const home = await fetchWithRetry(`${ORIGIN}/`, { headers }, { signal: ctx.signal, timeoutPerAttemptMs: 20_000, label: 'nationsguiden' });
    if (!home.ok) { ctx.log(`nationsguiden: startsidan svarade ${home.status}`); return []; }
    const nonce = nonceFromHome(await home.text());
    if (!nonce) { ctx.log('nationsguiden: hittade ingen nonce på startsidan'); return []; }

    const out: RawEvent[] = [];
    const seen = new Set<string>();
    for (let t = new Date(ctx.windowStart); t < ctx.windowEnd; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) {
        const day = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
        await domainLimiter.wait(ORIGIN);
        let data: { event_categories?: string };
        try {
            const res = await fetchWithRetry(`${ORIGIN}/wp-admin/admin-ajax.php`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
                body: new URLSearchParams({ action: 'di_filter_events', nonce, selected_date: day, only_load_dates: 'false' }).toString(),
            }, { signal: ctx.signal, timeoutPerAttemptMs: 20_000, label: `nationsguiden ${day}` });
            if (!res.ok) { ctx.log(`nationsguiden: ${day} svarade ${res.status}`); continue; }
            data = await res.json();
        } catch (e) {
            ctx.log(`nationsguiden: ${day} gick inte att läsa (${(e as Error).message})`);
            continue;
        }
        let categories: NationsguidenCategory[] = [];
        try { categories = JSON.parse(data.event_categories ?? '[]'); } catch { continue; }
        for (const ev of mapNationsguidenDay(categories, day)) {
            if (seen.has(ev.url)) continue;
            seen.add(ev.url);
            out.push(ev);
        }
    }
    ctx.log(`nationsguiden: ${out.length} event`);
    return out;
};
