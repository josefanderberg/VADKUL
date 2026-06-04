/**
 * Re-scrape Tickster-events med osäker plats och korrigera location.
 *
 * Tidigare bug: när JSON-LD/microdata sa en stad (arrangörens) men venue
 * sa en annan stad (riktiga platsen) tog vi fel. Nu fixat i scrapen — men
 * gamla rader i DB är fortfarande felaktiga.
 *
 * Strategi:
 *   1. Hitta Tickster-events där isLocationVerified=0 eller locationName
 *      bara är en stad (utan venue-namn)
 *   2. Hämta event-sidan, plocka venue + adress med ny logik
 *   3. Geocoda om → uppdatera DB
 *
 * Användning:
 *   npx ts-node src/scripts/fix-tickster-locations.ts                 # dry-run
 *   npx ts-node src/scripts/fix-tickster-locations.ts --apply
 *   npx ts-node src/scripts/fix-tickster-locations.ts --apply --limit=20
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        if (a === '--apply') out.apply = true;
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
})();

const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124';

// OBS: JS `\b` fungerar inte runt å/ä/ö. Använder lookbehind/lookahead för att
// säkerställa att vi inte matchar mitt i ett ord (Lundström ≠ Lund).
const CITY_NAMES = 'Stockholm|Göteborg|Malmö|Uppsala|Västerås|Örebro|Linköping|Helsingborg|Jönköping|Norrköping|Lund|Umeå|Gävle|Borås|Eskilstuna|Södertälje|Karlstad|Täby|Sundsvall|Luleå|Östersund|Växjö|Kalmar|Halmstad|Falun|Skellefteå|Kristianstad|Trollhättan|Botkyrka|Solna|Lidingö|Sundbyberg|Sigtuna|Nynäshamn|Värmdö|Nacka|Huddinge|Sollentuna|Mölndal|Kungsbacka|Varberg|Falkenberg|Ängelholm|Trelleborg|Ystad|Landskrona|Hässleholm|Eslöv|Höör|Hörby|Klippan|Båstad|Simrishamn|Sjöbo|Skurup|Staffanstorp|Svalöv|Svedala|Tomelilla|Vellinge|Åstorp|Burlöv|Lomma|Höganäs|Bjuv|Perstorp|Osby|Bromölla|Ljungby|Alvesta|Lessebo|Markaryd|Tingsryd|Uppvidinge|Älmhult|Vetlanda|Värnamo|Nässjö|Tranås|Eksjö|Sävsjö|Vimmerby|Västervik|Nybro|Oskarshamn|Mönsterås|Borgholm|Mörbylånga|Hultsfred|Karlshamn|Karlskrona|Ronneby|Olofström|Sölvesborg|Visby|Mariestad|Skövde|Lidköping|Vänersborg|Uddevalla|Strömstad|Tanum|Munkedal|Lysekil|Sotenäs|Orust|Tjörn|Stenungsund|Kungälv|Öckerö|Ale|Lerum|Härryda|Partille|Alingsås|Vårgårda|Herrljunga|Bollebygd|Mark|Svenljunga|Tranemo|Ulricehamn|Falköping|Tidaholm|Hjo|Tibro|Karlsborg|Töreboda|Götene|Bengtsfors|Dals-Ed|Färgelanda|Mellerud|Åmål|Vara|Grästorp|Essunga|Skara|Gullspång|Hallsberg|Hallstahammar|Heby|Härnösand|Hudiksvall|Sandviken|Söderhamn|Bollnäs|Ljusdal|Mora|Leksand|Rättvik|Orsa|Vansbro|Malung-Sälen|Älvdalen|Borlänge|Ludvika|Smedjebacken|Avesta|Hedemora|Säter|Gagnef|Köping|Arboga|Surahammar|Sala|Kungsör|Norberg|Fagersta|Skinnskatteberg|Karlskoga|Degerfors|Kumla|Askersund|Laxå|Nora|Lindesberg|Hällefors|Ljusnarsberg|Lekeberg|Arvika|Eda|Filipstad|Forshaga|Grums|Hagfors|Hammarö|Kil|Kristinehamn|Munkfors|Storfors|Sunne|Säffle|Torsby|Årjäng|Timrå|Sollefteå|Ånge|Kramfors|Örnsköldsvik|Berg|Bräcke|Härjedalen|Krokom|Ragunda|Strömsund|Åre|Bjurholm|Dorotea|Lycksele|Malå|Nordmaling|Norsjö|Robertsfors|Sorsele|Storuman|Vilhelmina|Vindeln|Vännäs|Åsele|Arjeplog|Arvidsjaur|Boden|Gällivare|Haparanda|Jokkmokk|Kalix|Kiruna|Pajala|Piteå|Älvsbyn|Överkalix|Övertorneå|Upplands Väsby|Upplands-Bro|Vaxholm|Österåker|Vallentuna|Salem|Ekerö|Haninge|Tyresö|Nykvarn|Norrtälje|Knivsta|Tierp|Östhammar|Älvkarleby|Enköping|Håbo|Flen|Gnesta|Katrineholm|Nyköping|Oxelösund|Strängnäs|Trosa|Vingåker|Boxholm|Finspång|Kinda|Mjölby|Motala|Söderköping|Vadstena|Valdemarsvik|Ydre|Åtvidaberg|Ödeshög|Aneby|Gislaved|Gnosjö|Habo|Mullsjö|Vaggeryd|Hylte|Laholm|Gotland|Östra Göinge';
const CITY_RE = new RegExp(`(?<![A-ZÅÄÖa-zåäö-])(${CITY_NAMES})(?![A-ZÅÄÖa-zåäö-])`);

interface Row {
    url: string;
    title: string;
    firestoreId: string;
    locationName: string;
    lat: number;
    lng: number;
}

async function fetchHtml(url: string): Promise<string | null> {
    try {
        const r = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'text/html' },
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) return null;
        return await r.text();
    } catch { return null; }
}

/** Plocka ut korrekt venue + stad från Tickster-sidan. */
function extractTicksterLocation(html: string): { venue: string; city: string } | null {
    const decoded = html
        .replace(/&#246;/g, 'ö').replace(/&#228;/g, 'ä').replace(/&#229;/g, 'å')
        .replace(/&#214;/g, 'Ö').replace(/&#196;/g, 'Ä').replace(/&#197;/g, 'Å')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    const text = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // Plocka venue: "Salong/Lokal/Bio X..." men STOPPA vid Tickster's UI-text
    // (Köp biljett, Startar, Arrangör, eller ord-gräns "i [City]")
    let venue = '';
    let city = '';
    const venueMatch = text.match(/((?:Salong|Lokal|Sal|Bio|Kino|Hall|Aula|Teater|Hus|Park)\b[^|]{2,80}?)\s+(?:Köp biljett|Startar|Arrang|Pris|Mer info|Boka)/i);
    if (venueMatch) {
        venue = venueMatch[1].trim();
        // Trimma — om venue slutar med "i [City]", behåll det men plocka även ut city
        const venueCityMatch = venue.match(/\bi\s+([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ-]+)\s*$/);
        if (venueCityMatch && CITY_RE.test(venueCityMatch[1])) {
            city = venueCityMatch[1];
        } else {
            const cityInVenue = venue.match(CITY_RE);
            if (cityInVenue) city = cityInVenue[1];
        }
    }

    // Försök 2: leta efter "i [City]" eller stad i body-text om venue ej hade stad
    if (!city) {
        // Föredra "i [City]"-mönster (mer specifikt)
        // OBS: trailing \b funkar inte runt å/ä/ö (Växjö, Malmö, Umeå)
        const inCity = text.match(/(?<![A-ZÅÄÖa-zåäö-])i\s+([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ-]{2,20})(?![A-ZÅÄÖa-zåäö-])/);
        if (inCity && CITY_RE.test(inCity[1])) {
            city = inCity[1];
        } else {
            const m = text.match(CITY_RE);
            if (m) city = m[1];
        }
    }

    if (!venue && !city) return null;
    return { venue, city };
}

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    console.log(args.apply ? '🔧 APPLY mode' : '🔍 DRY-RUN');

    const limit = args.limit ? parseInt(args.limit, 10) : 999999;

    const rows: Row[] = sqliteDb.prepare(`
        SELECT url, title, firestoreId, locationName, lat, lng FROM link_events
        WHERE hidden = 0
          AND hostName = 'Tickster'
          AND firestoreId IS NOT NULL
          AND datetime(time) >= datetime('now')
          AND (
            -- bara stadsnamn (saknar venue)
            locationName IN ('Stockholm','Göteborg','Malmö','Uppsala','Lund','Växjö','Linköping','Norrköping','Sverige','')
            OR isLocationVerified = 0
          )
        ORDER BY time ASC
        LIMIT ?
    `).all(limit) as Row[];

    console.log(`Hittade ${rows.length} kandidater att re-checka\n`);

    let fixed = 0;
    let unchanged = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const html = await fetchHtml(r.url);
        if (!html) {
            failed++;
            console.log(`  ${i + 1}/${rows.length} ❌ fetch failed — ${r.title.slice(0, 40)}`);
            continue;
        }

        const loc = extractTicksterLocation(html);
        if (!loc || (!loc.venue && !loc.city)) {
            unchanged++;
            console.log(`  ${i + 1}/${rows.length} ? ingen plats funnen — ${r.title.slice(0, 40)}`);
            continue;
        }

        // SKIP-regel: om vi inte har en NY stad (eller staden är samma), uppdatera inte —
        // existing locationName är förmodligen mer detaljerad än vad vi kan generera.
        const oldCity = r.locationName.match(CITY_RE)?.[1] || '';
        const newCity = loc.city;
        const cityChanged = oldCity && newCity && oldCity.toLowerCase() !== newCity.toLowerCase();
        // Också uppdatera om gamla locationName är "bara stad" och vi hittat venue
        const oldIsBareCity = r.locationName.trim() === oldCity;
        const newHasVenue = !!loc.venue;

        if (!cityChanged && !(oldIsBareCity && newHasVenue)) {
            unchanged++;
            continue; // Inget värde att uppdatera
        }

        // Bygg locationName + geocode-query
        const newLocationName = loc.venue
            ? loc.venue + (loc.city && !loc.venue.includes(loc.city) ? `, ${loc.city}` : '')
            : loc.city;

        const geocodeQuery = loc.venue && loc.city ? `${loc.venue}, ${loc.city}` : (loc.venue || loc.city);
        const coords = await geocodeVenueSweden(geocodeQuery);

        const banner = cityChanged ? '🔁 STADSBYTE' : '✏️';
        console.log(`  ${i + 1}/${rows.length} ${banner}  "${r.locationName}" → "${newLocationName}"  — ${r.title.slice(0, 40)}`);

        if (args.apply) {
            const updates: any = { locationName: newLocationName };
            if (coords) {
                updates.lat = coords[0];
                updates.lng = coords[1];
                updates.isLocationVerified = true;
            }
            try {
                await db.collection('linkEvents').doc(r.firestoreId).update(updates);
                fixed++;
            } catch (e) {
                failed++;
                console.error(`     ❌ DB write: ${(e as Error).message}`);
            }
        }
        await new Promise(r => setTimeout(r, 400));
    }

    sqliteDb.close();
    console.log(`\n=== Sammanfattning ===`);
    console.log(`Checked: ${rows.length}`);
    console.log(`Fixed:   ${fixed}`);
    console.log(`Oförändrat: ${unchanged}`);
    console.log(`Failed:  ${failed}`);
    console.log(args.apply ? '' : '\n(dry-run — kör med --apply)');
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
