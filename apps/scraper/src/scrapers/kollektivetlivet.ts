/**
 * Kollektivet Livet — klubb/scen vid Slussen/Söder, Stockholm.
 *
 * Strategi:
 *   Listsidan /evenemang/ är JS-renderad och visar bara KOMMANDE events som
 *   rena kort (div.event[data-event-slug]). Varje kort har maskinläsbart
 *   <time datetime="YYYY-MM-DD HH:MM:SS"> + ren titel (h3 a) + scen (.location)
 *   + typ (.event-type-label: KLUBB/KONSERT) + omslagsbild + Tickster-länk.
 *
 *   Vi läser datum DIREKT ur listkortens <time> — detaljsidorna är opålitliga
 *   (saknar JSON-LD/og:title och blandar in relaterade/passerade datum, så
 *   first-date-in-text daterar fel). Allt vi behöver finns på listan.
 *
 *   Tickster täcker bara enstaka av husets events (vi hade 2 i DB:n); denna
 *   källa ger hela programmet och fyller en Stockholm-nattlivslucka.
 *
 * Fönster: kommande 30 dagar (matchar pipelinens SCRAPE_WINDOW_DAYS).
 */

import puppeteer from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';
import { geocodeVenue } from '../utils/venueCoordinates';

const LIST_URL = 'https://kollektivetlivet.se/evenemang/';
const WINDOW_DAYS = parseInt(process.env.SCRAPE_WINDOW_DAYS || '30', 10);

interface RawCard {
    title: string;
    datetime: string;   // "2026-06-12 20:00:00" (lokal Stockholmstid)
    typeLabel: string;  // "KLUBB," / "KONSERT,"
    location: string;   // scen, t.ex. "Stora Scen"
    url: string;
    img: string;
    ticketUrl: string;
}

/** KLUBB/KONSERT → vår taxonomi; annars titel-klassning. */
function categoryFor(typeLabel: string, title: string): string {
    const t = typeLabel.toLowerCase();
    if (t.includes('klubb')) return 'party';
    if (t.includes('konsert') || t.includes('live')) return 'music';
    return classifyEvent(title, typeLabel);
}

export async function scrapeKollektivetLivet(): Promise<number> {
    console.log(`[Kollektivet Livet] Startar — ${LIST_URL}`);
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    let saved = 0;

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh) Chrome/124.0.0.0 Safari/537.36');
        await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise((r) => setTimeout(r, 3500)); // låt korten rendera klart

        const cards: RawCard[] = await page.evaluate(() => {
            const out: RawCard[] = [];
            const seen = new Set<string>();
            document.querySelectorAll('div.event[data-event-slug]').forEach((el) => {
                const card = el as HTMLElement;
                const time = card.querySelector('time[datetime]');
                const datetime = time?.getAttribute('datetime') || '';
                const titleEl = card.querySelector('h3 a, h3');
                const title = (titleEl?.textContent || '').trim();
                const linkEl = card.querySelector('a.event-link, a.read-more, a[href*="/event/"]') as HTMLAnchorElement | null;
                const url = linkEl?.href || '';
                if (!title || !datetime || !url || seen.has(url)) return;
                seen.add(url);
                out.push({
                    title,
                    datetime,
                    typeLabel: (card.querySelector('.event-type-label')?.textContent || '').replace(/,/g, '').trim(),
                    location: (card.querySelector('.location')?.textContent || '').trim(),
                    url,
                    img: card.querySelector('img')?.getAttribute('src') || '',
                    ticketUrl: (card.querySelector('a.buy-ticket') as HTMLAnchorElement | null)?.href || '',
                });
            });
            return out;
        });

        console.log(`[Kollektivet Livet] ${cards.length} kort på listsidan`);

        // Fast venue-koordinat (en enda lokal) — geocoda en gång, återanvänd.
        // Faller tillbaka på Slussen/Söder om Nominatim inte hittar venyn.
        const coords = await geocodeVenue('Kollektivet Livet, Stockholm');
        const lat = coords ? coords[0] : 59.3198;
        const lng = coords ? coords[1] : 18.0712;

        const now = Date.now();
        const windowEnd = now + WINDOW_DAYS * 24 * 60 * 60 * 1000;

        for (const c of cards) {
            try {
                // "2026-06-12 20:00:00" tolkas som lokal tid (maskinen står i Sverige),
                // vilket är rätt för en Stockholmsscen — samma konvention som övriga scrapers.
                const when = new Date(c.datetime.replace(' ', 'T'));
                if (isNaN(when.getTime())) { console.log(`  [skip] ogiltigt datum: ${c.title}`); continue; }
                if (when.getTime() < now - 12 * 60 * 60 * 1000) continue;   // passerat
                if (when.getTime() > windowEnd) continue;                   // bortom fönstret

                if (await eventExistsInDb(c.url)) continue;

                const stage = c.location && !/kollektivet/i.test(c.location) ? c.location : '';
                const locationName = [stage, 'Kollektivet Livet'].filter(Boolean).join(', ');

                await addEventToDb({
                    title: c.title,
                    url: c.url,
                    time: when,
                    hasSpecificTime: true,
                    locationName,
                    lat,
                    lng,
                    hostName: 'Kollektivet Livet',
                    category: categoryFor(c.typeLabel, c.title),
                    createdAt: new Date(),
                    coverImage: c.img || null,
                    price: '',
                    description: [c.typeLabel, stage].filter(Boolean).join(' · '),
                    isLocationVerified: !!coords,
                });
                saved++;
                console.log(`  ✅ ${when.toISOString().slice(0, 16)} | ${c.title} (${c.typeLabel || '?'})`);
            } catch (err) {
                console.error(`  [Kollektivet Livet] fel på "${c.title}":`, (err as Error).message);
            }
        }
    } catch (err) {
        console.error('[Kollektivet Livet] Fel vid hämtning:', (err as Error).message);
    } finally {
        await browser.close();
    }

    console.log(`[Kollektivet Livet] Klar — ${saved} nya events sparade.`);
    return saved;
}
