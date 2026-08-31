/**
 * oneoff-alvkarleby-repair.ts — reparera alvkarleby.se-eventen (2026-08-30).
 *
 * Rotorsaken: sidorna saknar JSON-LD, och kommunsajtens sidhuvud har en
 * kontaktruta som ligger FÖRE mittenspalten. Cheerio-fallbacken tog därför
 *   - beskrivning = växelns öppettider ("Måndag - torsdag 8-12, 13-16…")
 *   - adress      = kommunhusets besöksadress (Centralgatan 3) → alla 23
 *                   event på samma punkt
 *   - plats       = defaultCity ("Älvkarleby") eftersom ingen venue hittades
 *   - titel       = kontaktrutans h1 när sidtiteln inte kunde matchas exakt
 * medan eventets egen faktatabell ("Tid / Plats: Rio Bio Gävlevägen 24 /
 * Pris / Arrangör") stod oläst. Motorn läser den nu (utils/factTable.ts).
 *
 * Det här skriptet kör om extraktionen mot de REDAN SPARADE URL:erna och
 * uppdaterar fälten på plats — inga rader raderas, inga nya event skapas.
 * Listsidan /evenemang/pagaende-evenemang.html döljs (den är en katalog).
 *
 *   npx ts-node src/scripts/oneoff-alvkarleby-repair.ts            # dry-run
 *   npx ts-node src/scripts/oneoff-alvkarleby-repair.ts --apply
 */

import { db } from '../config/firebase';
import { sqlite, setHidden, lookupVenueSmart } from '../utils/sqliteHelper';
import { extractFromHtml } from '../sources/engines/sitemap';
import { normalizeRawEvent } from '../utils/normalizeEvent';
import { classifyEvent } from '../utils/classify';
import { normalizeCategory } from '../utils/categoryNormalize';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { cleanLocationName } from '../utils/text';
import { stamped } from '../utils/firestoreStamp';
import { CATEGORY_EMOJI } from '../utils/llmAudit';

/**
 * Firestore-patch som tål att dokumentet är borta. SQLite-spegeln kan bära
 * ett firestoreId vars dokument städats bort (NOT_FOUND) — det ska inte
 * stoppa reparationen av resten.
 */
async function patchFirestore(id: string | null, patch: Record<string, unknown>): Promise<void> {
    if (!id) return;
    try {
        await db!.collection('linkEvents').doc(id).update(stamped(patch));
    } catch (err) {
        const code = (err as { code?: number }).code;
        if (code === 5) { console.log(`      ⚠️  Firestore-dok saknas (${id}) — bara SQLite uppdaterad`); return; }
        throw err;
    }
}

const APPLY = process.argv.includes('--apply');
const HOST = 'Älvkarleby Kommun';
const DEFAULT_CITY = 'Älvkarleby';
/** Katalogsidor som aldrig är event — döljs i stället för att repareras. */
const CATALOG = /\/pagaende-evenemang/i;
/** Kommunhusets öppettider — spåret efter den trasiga beskrivningsextraktionen. */
const CONTACT_JUNK = /m[åa]ndag\s*-\s*torsdag\s*8-12/i;

interface Row {
    url: string; firestoreId: string | null; title: string; time: string;
    locationName: string; extractedAddress: string | null; description: string | null;
    category: string | null; emoji: string | null; price: string | null;
    lat: number | null; lng: number | null;
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, time, locationName, extractedAddress, description,
               category, emoji, price, lat, lng
        FROM link_events
        WHERE hidden = 0 AND url LIKE '%alvkarleby.se%'
        ORDER BY time
    `).all() as Row[];
    console.log(`${rows.length} event från alvkarleby.se\n`);

    const upd = sqlite.prepare(`
        UPDATE link_events
        SET title = ?, description = ?, locationName = ?, extractedAddress = ?,
            category = ?, emoji = ?, price = ?, lat = ?, lng = ?, geocodedQuery = ?,
            geoPrecision = ?, isLocationVerified = ?, updatedAt = ?
        WHERE url = ?
    `);

    let fixed = 0, hiddenCount = 0, misses = 0;

    for (const r of rows) {
        if (CATALOG.test(r.url)) {
            console.log(`  🙈 katalogsida döljs: ${r.title}`);
            if (APPLY) {
                setHidden(r.url, true);
                await patchFirestore(r.firestoreId, { hidden: true });
            }
            hiddenCount++;
            continue;
        }

        const res = await fetch(r.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) {
            // Borttagen sida + kvarvarande skräpbeskrivning = event vi varken
            // kan reparera eller verifiera. Dölj i stället för att låta
            // kontaktrutans öppettider ligga kvar publikt.
            if (CONTACT_JUNK.test(r.description || '')) {
                console.log(`  🙈 HTTP ${res.status} + oreparerbart — döljs: ${r.title.slice(0, 40)}`);
                if (APPLY) {
                    setHidden(r.url, true);
                    await patchFirestore(r.firestoreId, { hidden: true });
                }
                hiddenCount++;
            } else {
                console.log(`  ⚠️  HTTP ${res.status} — ${r.url.slice(-50)}`);
            }
            misses++;
            continue;
        }
        const ev = extractFromHtml(await res.text(), r.url, DEFAULT_CITY);
        if (!ev) { console.log(`  ⚠️  ingen extraktion — ${r.url.slice(-50)}`); misses++; continue; }
        normalizeRawEvent(ev, HOST);

        const locationName = cleanLocationName(ev.venueName || ev.city || 'Sverige') || 'Sverige';
        const address = ev.address || '';
        const description = ev.description || '';
        const category = normalizeCategory(ev.category || classifyEvent(ev.title, description));
        // Emoji bara när kategorin faktiskt flyttar sig — annars skulle vi
        // slå ut LLM-auditens finare val (✍️ för skrivcafé) mot kategori-default.
        const emoji = category !== r.category
            ? (CATEGORY_EMOJI[category as keyof typeof CATEGORY_EMOJI] ?? r.emoji)
            : r.emoji;
        const price = ev.price || r.price || null;

        // Geokoda om på den nya adressen/venuen — de gamla koordinaterna pekar
        // på kommunhuset. nearCity håller träffen inom kommunen.
        let lat = r.lat ?? 0, lng = r.lng ?? 0;
        let query = '', precision: string | null = null;
        const city = ev.city || DEFAULT_CITY;
        // known_venues FÖRE adressfrågan: Nominatim matchar "Gävlevägen 24"
        // mot fel segment av gatan (Harnäs, 2 km från Rio Bio) eftersom
        // husnumret saknas i OSM. Kuraterad punkt slår gissad gatumitt.
        const known = ev.venueName ? lookupVenueSmart(ev.venueName) : null;
        if (known && APPLY) { lat = known[0]; lng = known[1]; query = ev.venueName!; precision = 'poi'; }
        if (!query) {
            for (const q of [address ? `${address}, ${city}` : '', ev.venueName ? `${ev.venueName}, ${city}` : '']) {
                if (!q) continue;
                const hit = APPLY ? await geocodeVenueSweden(q, { nearCity: city }) : null;
                if (hit) { lat = hit[0]; lng = hit[1]; query = q; precision = hit[2] ?? null; break; }
            }
        }

        const changes = [
            r.title !== ev.title ? `titel: "${r.title}" → "${ev.title}"` : '',
            r.locationName !== locationName ? `plats: "${r.locationName}" → "${locationName}"` : '',
            (r.extractedAddress || '') !== address ? `adress: "${r.extractedAddress}" → "${address}"` : '',
            (r.description || '').slice(0, 30) !== description.slice(0, 30) ? `beskrivning: "${(r.description || '').slice(0, 34)}…" → "${description.slice(0, 34)}…"` : '',
            r.category !== category ? `kategori: ${r.category} → ${category}` : '',
            query ? `koords: ${lat.toFixed(4)},${lng.toFixed(4)} (${query})` : '',
        ].filter(Boolean);
        if (!changes.length) continue;

        console.log(`  ▸ ${ev.title.slice(0, 46)}`);
        changes.forEach((c) => console.log(`      ${c}`));

        if (APPLY) {
            upd.run(ev.title, description, locationName, address, category, emoji, price,
                lat, lng, query || null, precision, lat !== 0 || lng !== 0 ? 1 : 0,
                new Date().toISOString(), r.url);
            await patchFirestore(r.firestoreId, {
                title: ev.title, description, locationName, extractedAddress: address,
                category, emoji, price,
                ...(query ? { lat, lng, geocodedQuery: query, geoPrecision: precision, isLocationVerified: lat !== 0 || lng !== 0 } : {}),
            });
        }
        fixed++;
    }

    console.log(`\n${APPLY ? '✅' : 'Skulle'} uppdatera ${fixed} event, dölja ${hiddenCount} katalogsida(or), ${misses} missar`);
    if (!APPLY) console.log('Kör med --apply för att skriva.');
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
