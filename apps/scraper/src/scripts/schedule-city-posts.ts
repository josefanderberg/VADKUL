/**
 * schedule-city-posts.ts — Schemalägg stadsinlägg på VADKUL-SIDAN i förväg.
 *
 * Idén: i stället för att komponera ett inlägg per facebookgrupp för hand
 * produceras ETT inlägg per ORT på Sidan, i förväg. Sedan delas det inlägget
 * manuellt in i ortens grupper (Dela → Dela i en grupp). Grupp-API:t är dött
 * sedan 2024-04-22 — delningen går INTE att automatisera — men förproduktionen
 * gör den, och två klick slår tio minuters skrivande.
 *
 * En post per ORT, inte per grupp: Ängelholm har fyra grupper och Göteborg
 * åtta. Samma sidinlägg delas in i allihop.
 *
 * Körning (från apps/scraper):
 *   npx ts-node src/scripts/schedule-city-posts.ts                    # dry-run, visar kön
 *   npx ts-node src/scripts/schedule-city-posts.ts --orter=Hudiksvall # bara en ort
 *   npx ts-node src/scripts/schedule-city-posts.ts --commit           # schemalägg på riktigt
 *
 * Flaggor:
 *   --orter=A,B      bara dessa orter (annars alla geokodade grupporter)
 *   --start=2026-08-20   första publiceringsdag (default: imorgon)
 *   --klockan=17:00  publiceringstid (default 17:00 — kvällar går bäst)
 *   --per-dag=2      antal orter per dag (default 2)
 *   --max=20         tak för antal inlägg i körningen
 *   --radie=25       km kring orten som eventen hämtas ur
 *   --commit         schemalägg (utan den: bara utskrift)
 *
 * ⚠️ FÄRSKVARUREGELN — läs innan du höjer --per-dag:
 * Daterade eventrader som schemaläggs långt i förväg publiceras inaktuella.
 * Därför växlar skriptet automatiskt till en TIDLÖS text utan datum och utan
 * siffror för allt som ligger mer än 7 dygn fram. Vill du ha konkreta
 * eventrader: håll dig inom en vecka och kör skriptet varje vecka i stället
 * för en gång i månaden.
 *
 * BILD: Facebook-inlägget schemaläggs som REN TEXT — ingen bild, och ingen
 * länkförhandsvisning (Graph API bygger bara preview-kort när `link`-param
 * skickas, vilket vi aldrig gör). Ägarbeslut 2026-08-23: genererade
 * kartbilder används enbart till Instagram. Kartbild-URL:en skrivs ändå ut i
 * dry-runnen, märkt IG, för manuell IG-publicering.
 *
 * ⚠️ ATTRIBUTION: alla grupper som får samma sidinlägg delar samma länk, så
 * klicken går inte att fördela per grupp. Vill du veta vilken grupp som drog
 * trafiken måste du posta eget inlägg med egen ?ref= (konsolens etapp 4).
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { db } from '../config/firebase';
import { postToFacebook, getFacebookPostPermalink, SCHEDULE_MAX_MS } from '../utils/socialPublish';
import { buildCityPostText, pickCityRows, type PickedRows } from '../utils/cityPostText';

// Hemligheter (FB_PAGE_ID/FB_PAGE_TOKEN) — samma mönster som publish-fb.ts.
// MacBooken saknar ~/.vadkul-secrets — där läses webbens .env.local/.env i
// stället, och FB_PAGE_ACCESS_TOKEN (webbens namn) mappas till FB_PAGE_TOKEN.
const secretSources = [
    path.join(process.env.HOME || '~', '.vadkul-secrets/env'),
    path.resolve(__dirname, '../../../web/.env.local'),
    path.resolve(__dirname, '../../../web/.env'),
];
for (const secretFile of secretSources) {
    if (!fs.existsSync(secretFile)) continue;
    for (const line of fs.readFileSync(secretFile, 'utf-8').split('\n')) {
        const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}
if (!process.env.FB_PAGE_TOKEN && process.env.FB_PAGE_ACCESS_TOKEN) {
    process.env.FB_PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
}

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

const SITE = 'https://vadkul.se';
const DAY_MS = 86_400_000;
/** Bortom detta blir texten tidlös — se färskvaruregeln i headern. */
const FRESH_DAYS = 7;

/* ── Argument ─────────────────────────────────────────────────────────────── */

const arg = (name: string): string | undefined =>
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const commit = process.argv.includes('--commit');
const onlyCities = arg('orter')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const perDay = Math.max(1, Number(arg('per-dag')) || 2);
const maxPosts = Number(arg('max')) || 40;
const radiusKm = Number(arg('radie')) || 25;
const [startHour, startMin] = (arg('klockan') ?? '17:00').split(':').map(Number);

function firstSlot(): Date {
    const iso = arg('start');
    const d = iso ? new Date(`${iso}T00:00:00`) : new Date(Date.now() + DAY_MS);
    d.setHours(startHour || 17, startMin || 0, 0, 0);
    return d;
}

/* ── Typer ────────────────────────────────────────────────────────────────── */

interface Contact {
    id: string;
    name: string;
    city?: string;
    citySlug?: string | null;
    lat?: number;
    lng?: number;
    doNotPost?: boolean;
    kind?: string;
}

/** En ort = en post, med alla grupper som ska få dela den. */
interface Town {
    key: string;
    name: string;
    citySlug: string | null;
    lat: number;
    lng: number;
    groups: Contact[];
}

interface EventRow {
    url: string;
    title: string;
    time: string;
    locationName: string;
    category: string;
    lat: number;
    lng: number;
}

/* ── Geo ──────────────────────────────────────────────────────────────────── */

/** Samma guard som import-outreach-md.ts — utan service-account är allt lönlöst. */
function requireDb() {
    if (!db) throw new Error('Ingen DB-anslutning (service-account.json saknas?)');
    return db;
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/* ── 1. Orterna ur Firestore ──────────────────────────────────────────────── */

async function loadTowns(): Promise<Town[]> {
    const snap = await requireDb().collection('outreachContacts').where('kind', '==', 'fb-grupp').get();
    const byTown = new Map<string, Town>();
    let missingCoord = 0;

    for (const doc of snap.docs) {
        const c = { id: doc.id, ...doc.data() } as Contact;
        if (c.doNotPost) continue;
        if (typeof c.lat !== 'number' || typeof c.lng !== 'number') { missingCoord++; continue; }

        const name = c.city ?? c.name;
        const key = (c.citySlug ?? name).toLowerCase();
        if (onlyCities && !onlyCities.some(o => key.includes(o) || name.toLowerCase().includes(o))) continue;

        const existing = byTown.get(key);
        if (existing) { existing.groups.push(c); continue; }
        byTown.set(key, {
            key,
            name,
            citySlug: c.citySlug ?? null,
            lat: c.lat,
            lng: c.lng,
            groups: [c],
        });
    }

    if (missingCoord > 0) {
        console.warn(
            `⚠️  ${missingCoord} grupper saknar koordinat och hoppas över. ` +
            'Kör geokodningen först (Karta-fliken i /admin/outreach → "Geokoda grupper").',
        );
    }

    // --orter som inte matchade någon grupp: slå upp i webbens CITY_POINTS
    // (291 orter) så en ort utan registrerad grupp ändå kan få ett sidinlägg
    // (t.ex. Sollefteå 20/8 — gruppen fanns men var inte inlagd än). Ingen
    // grupp ⇒ inga loggrader, bara sidinlägget.
    for (const wanted of onlyCities ?? []) {
        if ([...byTown.values()].some(t => t.key.includes(wanted) || t.name.toLowerCase().includes(wanted))) continue;
        const cp = lookupCityPoint(wanted);
        if (!cp) { console.warn(`⚠️  "${wanted}" finns varken bland grupperna eller i cityPoints — hoppas över.`); continue; }
        byTown.set(cp.name.toLowerCase(), {
            key: cp.name.toLowerCase(), name: cp.name,
            citySlug: citySlugFor(cp.name), lat: cp.lat, lng: cp.lng, groups: [],
        });
    }

    // Flest grupper först — den orten ger störst utdelning per schemalagt inlägg.
    return [...byTown.values()].sort((a, b) => b.groups.length - a.groups.length);
}

/** Webbens ortlistor, regex-lästa (uniforma objektliteraler — ingen TS-import
 *  över paketgränsen). cityPoints = koordinater, cityData.CITIES = stadssidor. */
function lookupCityPoint(query: string): { name: string; lat: number; lng: number } | null {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../web/src/utils/cityPoints.ts'), 'utf-8');
    const q = query.toLowerCase();
    for (const m of src.matchAll(/\{ name: '([^']+)', lat: ([\d.]+), lng: ([\d.]+)/g)) {
        if (m[1].toLowerCase().includes(q)) return { name: m[1], lat: Number(m[2]), lng: Number(m[3]) };
    }
    return null;
}

function citySlugFor(name: string): string | null {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../web/src/app/(v1)/evenemang/cityData.ts'), 'utf-8');
    for (const m of src.matchAll(/\{ name: '([^']+)', slug: '([a-z-]+)'/g)) {
        if (m[1].toLowerCase() === name.toLowerCase()) return m[2];
    }
    return null;
}

/* ── 2. Eventen per ort ───────────────────────────────────────────────────── */

function eventsForTown(sqlite: Database.Database, town: Town, from: Date, to: Date): EventRow[] {
    // Grov ruta i SQL (billigt, indexerbart), exakt radie i JS efteråt.
    const latSpan = radiusKm / 111.32;
    const lngSpan = radiusKm / (111.32 * Math.cos((town.lat * Math.PI) / 180));

    const rows = sqlite.prepare(`
        SELECT url, title, time, locationName, category, lat, lng
        FROM link_events
        WHERE datetime(time) >= datetime(?)
          AND datetime(time) <= datetime(?)
          AND (hidden IS NULL OR hidden = 0)
          AND isLocationVerified = 1
          AND lat BETWEEN ? AND ?
          AND lng BETWEEN ? AND ?
        ORDER BY time ASC
    `).all(
        from.toISOString(), to.toISOString(),
        town.lat - latSpan, town.lat + latSpan,
        town.lng - lngSpan, town.lng + lngSpan,
    ) as EventRow[];

    return rows.filter(r => distKm(town.lat, town.lng, r.lat, r.lng) <= radiusKm);
}

/* ── 3. Texten — bygget bor i utils/cityPostText (ägarens täta tvåsektions-
 *    format 20/8), här väljs bara mellan det och den tidlösa varianten. ── */

function linkFor(town: Town): string {
    return town.citySlug ? `${SITE}/evenemang/${town.citySlug}` : SITE;
}

/** Tidlös text för inlägg >7 dygn fram — inga daterade rader (färskvaruregeln). */
function timelessText(town: Town): string {
    return [
        `Vad händer i ${town.name}? 👀`,
        '',
        'Konserter, loppisar, barnaktiviteter, föreläsningar — vi samlar allt',
        'som händer på en karta. Gratis, och utan konto.',
        '',
        `Kolla ${town.name}: ${linkFor(town)}`,
        '',
        'Saknas något? Tipsa oss så lägger vi in det 👇',
    ].join('\n');
}

function imageFor(town: Town, timeless: boolean): string {
    const p = new URLSearchParams({
        lat: town.lat.toFixed(4),
        lng: town.lng.toFixed(4),
        namn: town.name,
        radie: String(radiusKm),
        // Sidan ÄR öppet avsändaren, så den brandade stilen hör hemma här.
        // (Till gruppinlägg används stil=karta — se ad-plats-routens header.)
        stil: 'annons',
    });
    // Tidlösa inlägg publiceras långt fram — en 7-dagarsbild vore tom då.
    // 30-dagarsfönstret håller sig rimligt mycket längre.
    if (timeless) p.set('dagar', '30');
    return `${SITE}/api/marketing/ad-plats?${p.toString()}`;
}

/* ── 4. Körningen ─────────────────────────────────────────────────────────── */

async function main() {
    const towns = await loadTowns();
    if (towns.length === 0) {
        console.log('Inga orter att schemalägga (kolla --orter och att grupperna är geokodade).');
        return;
    }

    const sqlite = new Database(DB_PATH, { readonly: true });
    const slot0 = firstSlot();
    const planned: {
        town: Town; when: Date; text: string; image: string; timeless: boolean; rows: EventRow[];
    }[] = [];

    towns.slice(0, maxPosts).forEach((town, i) => {
        const when = new Date(slot0.getTime() + Math.floor(i / perDay) * DAY_MS);
        // Flera orter samma dag sprids en timme isär så flödet inte spammas.
        when.setHours(when.getHours() + (i % perDay));

        const daysAhead = (when.getTime() - Date.now()) / DAY_MS;
        if (when.getTime() - Date.now() > SCHEDULE_MAX_MS) {
            console.warn(`⏭  ${town.name}: ${Math.round(daysAhead)} dygn fram — utanför 30-dygnsfönstret, hoppas över.`);
            return;
        }
        const timeless = daysAhead > FRESH_DAYS;

        // Tidlösa inlägg listar inga event alls, så hämta dem bara när de används.
        // 14 dygn från publiceringen: sektion 1 (t.o.m. söndag) + "Och nästa vecka:".
        const picked: PickedRows = timeless
            ? { thisWeek: [], nextWeek: [] }
            : pickCityRows(
                eventsForTown(sqlite, town, when, new Date(when.getTime() + 14 * DAY_MS)),
                when.getTime());
        const rows = [...picked.thisWeek, ...picked.nextWeek];
        const text = timeless || rows.length === 0
            ? timelessText(town)
            : buildCityPostText(town.name, linkFor(town), picked, when.getTime());
        planned.push({ town, when, text, image: imageFor(town, timeless), timeless, rows });
    });

    sqlite.close();

    /* ── Utskrift ── */
    console.log(`\n${planned.length} inlägg${commit ? '' : ' (DRY-RUN — inget schemaläggs)'}\n`);
    for (const p of planned) {
        const gruppnamn = p.town.groups.map(g => g.name).join(', ');
        console.log('─'.repeat(72));
        console.log(`📍 ${p.town.name}  ·  ${p.when.toLocaleString('sv-SE')}  ·  ${p.timeless ? 'TIDLÖS (>7 dygn fram)' : `${p.rows.length} eventrader`}`);
        console.log(`   ${p.town.groups.length} grupp(er) att dela in i: ${gruppnamn}`);
        console.log(`   IG-bild (FB schemaläggs UTAN bild): ${p.image}`);
        console.log();
        console.log(p.text.split('\n').map(l => `   │ ${l}`).join('\n'));
        console.log();
    }

    if (!commit) {
        console.log('─'.repeat(72));
        console.log('Kör om med --commit för att schemalägga på Sidan.');
        return;
    }

    /* ── Schemaläggning ── */
    for (const p of planned) {
        try {
            // Ren text till FB — bilden är enbart för IG (se filhuvudet).
            const postId = await postToFacebook(p.text, [], 1, { scheduledFor: p.when.getTime() });
            const permalink = await getFacebookPostPermalink(postId);

            // Loggrad per GRUPP: varje grupp ska kunna kvitteras separat när
            // inlägget delats dit, och karensen räknas per grupp.
            const store = requireDb();
            const batch = store.batch();
            for (const g of p.town.groups) {
                const logId = `sida-${p.town.key}-${p.when.toISOString().slice(0, 10)}-${g.id}`;
                batch.set(store.collection('outreachLog').doc(logId), {
                    id: logId,
                    contactId: g.id,
                    contactName: g.name,
                    channel: 'fb-sida',
                    method: 'delat-sidinlägg',
                    identity: 'sida',
                    draftCreatedAt: Date.now(),
                    plannedFor: p.when.getTime(),
                    recheckAt: p.when.getTime() - 7 * DAY_MS,
                    confirmedByOwner: false,          // sätts när Josef delat in det
                    status: 'utkast',
                    outcome: 'okänt',
                    bodyText: p.text,
                    linkUrl: linkFor(p.town),
                    linkPlacement: 'i-inlägget',
                    pagePostId: postId,
                    pagePostUrl: permalink,
                    mentionedEvents: p.rows.map(e => ({ eventId: e.url, title: e.title, timeISO: e.time })),
                    eventsDataFetchedAt: Date.now(),
                }, { merge: true });
            }
            await batch.commit();

            console.log(`✅ ${p.town.name} → ${p.when.toLocaleString('sv-SE')}  ${permalink}`);
        } catch (e) {
            console.error(`❌ ${p.town.name}: ${(e as Error).message}`);
        }
    }

    console.log('\nKlart. Inläggen ligger i Meta Business Suite → Planner tills de publiceras.');
    console.log('Efter publicering: öppna permalinken, Dela → Dela i en grupp.');
}

main().catch(e => { console.error(e); process.exit(1); });
