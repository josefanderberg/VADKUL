#!/usr/bin/env ts-node
/**
 * Fixar trasiga/saknade adresser i linkEvents.
 *
 * Hård policy (efter att tidigare versioner råkade skriva tillbaka FB-chrome):
 *   1. Dynamisk chrome-blacklist — varje extractedAddress som upprepas på ≥3
 *      olika event räknas som FB-UI-läckage och får aldrig användas.
 *   2. En kandidat räknas som "fixad" endast om den geokodas till en koord
 *      inom Sveriges bbox (lat 55–69.5, lng 10–24.5) och inte är 0/0.
 *   3. Pipeline-ordning: description → title → pin-row → fb-search.
 *      Pin-row sist eftersom det är där chrome läcker in.
 *   4. Uppenbart utländska event (Magdeburg, Paris, "RG71UL", "Australia"…)
 *      skippas helt — vi försöker inte påtvinga svensk geokod.
 *   5. Vi rör Firestore endast om vi har en giltig, ny svensk koord. Inga
 *      "uppdateringar" som bara skriver tillbaka samma trasiga rad.
 *
 * Användning:
 *   ts-node src/scripts/fix-broken-addresses.ts            # Kör fixet (Firestore)
 *   ts-node src/scripts/fix-broken-addresses.ts --list     # Lista lokalt JSON
 */

import puppeteer, { Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { db } from '../config/firebase';
import { LocationInstrument } from '../scrapers/facebook/location';
import { extractEventDetails } from '../scrapers/facebook/extractor';
import { geocodeVenueSweden, cleanVenueName } from '../utils/venueCoordinates';

// ─── Konstanter ───────────────────────────────────────────────────────────────

const SWEDISH_CITIES = [
    'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping',
    'Örebro', 'Helsingborg', 'Norrköping', 'Jönköping', 'Umeå',
    'Lund', 'Västerås', 'Sundsvall', 'Karlstad', 'Växjö', 'Gävle',
    'Borås', 'Eskilstuna', 'Halmstad', 'Östersund', 'Kalmar',
    'Trollhättan', 'Luleå', 'Skellefteå', 'Kristianstad', 'Falun',
    'Ronneby', 'Karlskrona', 'Karlshamn', 'Hovmantorp',
];

// Sverige-bbox (grov men tight nog för att kasta utländska träffar).
const SE_BBOX = { latMin: 55.0, latMax: 69.5, lngMin: 10.0, lngMax: 24.5 };

// Hårdkodade kända falska adresser (förstärks dynamiskt vid runtime).
const STATIC_BAD_ADDRESS_PATTERNS: RegExp[] = [
    /Hovmantorp/i,
    /365\s*42/,
    /Parkgatan\s*1\b/i,
];

// Markörer för utländska event — om något av fälten matchar skippar vi helt.
const FOREIGN_MARKERS: RegExp[] = [
    // UK-postnummer t.ex. "RG7 1UL"
    /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/,
    // Tydliga icke-svenska land- och stadsnamn
    /\b(Germany|Deutschland|France|England|Wales|Scotland|Ireland|Spain|España|Italy|Italia|Portugal|Netherlands|Nederland|Belgium|Belgien|Greece|Hellas|Poland|Polska|Czech|Hungary|Romania|Bulgaria|Croatia|Serbia|USA|United\s*States|Canada|UK|United\s*Kingdom|Denmark|Danmark|Norway|Norge|Finland|Suomi|Estonia|Latvia|Lithuania|Iceland|Island|Brazil|Argentina|Mexico|Japan|China|India|Australia|Western\s*Australia)\b/i,
    /\b(Berlin|Hamburg|München|Munich|Köln|Cologne|Frankfurt|Düsseldorf|Leipzig|Dresden|Magdeburg|Bremen|Stuttgart)\b/i,
    /\b(Paris|Lyon|Marseille|Toulouse|Bordeaux|Nantes|Nice)\b/i,
    /\b(London|Manchester|Liverpool|Birmingham|Glasgow|Edinburgh|Bristol|Leeds|Sheffield|Berkshire|Scarborough)\b/i,
    /\b(Copenhagen|København|Aarhus|Odense|Helsingør|Frederiksberg|Humlebæk|Islands\s*Brygge)\b/i,
    /\b(Oslo|Bergen|Trondheim|Stavanger|Grünerløkka|Drammen|Tromsø)\b/i,
    /\b(Helsinki|Helsingfors|Tampere|Turku|Espoo|Vantaa|Kuparilyhty)\b/i,
    /\b(New\s*York|Los\s*Angeles|Chicago|Boston|Austin|Seattle|Brooklyn|Manhattan|Cabarrus|Portland|Atlanta)\b/i,
    /\b(Sydney|Melbourne|Brisbane|Perth|Adelaide)\b/i,
];

// ─── Hjälpare ─────────────────────────────────────────────────────────────────

const isStaticallyBroken = (addr: string | undefined | null): boolean => {
    if (!addr || addr.trim() === '') return true;
    return STATIC_BAD_ADDRESS_PATTERNS.some(p => p.test(addr));
};

const isValidSwedishCoord = (lat: number, lng: number): boolean => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    return (
        lat >= SE_BBOX.latMin && lat <= SE_BBOX.latMax &&
        lng >= SE_BBOX.lngMin && lng <= SE_BBOX.lngMax
    );
};

const looksForeign = (...fields: (string | undefined | null)[]): boolean => {
    const blob = fields.filter(Boolean).join(' | ');
    return FOREIGN_MARKERS.some(re => re.test(blob));
};

const isEventBroken = (d: any): boolean => {
    if (isStaticallyBroken(d.extractedAddress)) return true;
    if (!d.locationName || d.locationName.trim() === '') return true;
    const lat = d.lat ?? 0;
    const lng = d.lng ?? 0;
    if (!isValidSwedishCoord(lat, lng)) return true;
    return false;
};

interface BrokenEvent {
    id: string;            // tom sträng om vi läser lokalt (inget Firestore-id)
    title: string;
    url: string;
    locationName: string;
    extractedAddress: string;
    lat: number;
    lng: number;
    description?: string;
}

/**
 * Bygger en dynamisk blacklist av adresser som dyker upp på ≥3 olika event.
 * Det fångar varje rotation av FB:s UI-chrome (Hovmantorp → Universitetsplatsen
 * → Ronneby Brunnspark → …) utan att vi behöver hårdkoda varje variant.
 */
function buildChromeBlacklist(events: BrokenEvent[]): Set<string> {
    const counts: Map<string, number> = new Map();
    for (const e of events) {
        const a = (e.extractedAddress || '').trim();
        if (!a) continue;
        counts.set(a, (counts.get(a) || 0) + 1);
    }
    const blacklist = new Set<string>();
    for (const [a, n] of counts) {
        if (n >= 3) blacklist.add(a);
    }
    return blacklist;
}

const isBlacklisted = (addr: string | null | undefined, blacklist: Set<string>): boolean => {
    if (!addr) return false;
    if (blacklist.has(addr.trim())) return true;
    return isStaticallyBroken(addr);
};

// ─── Källor (Firestore för fix, lokal JSON för list) ──────────────────────────

async function findBrokenInFirestore(): Promise<BrokenEvent[]> {
    if (!db) throw new Error('Firestore not initialized');
    const snap = await db.collection('linkEvents').get();
    const broken: BrokenEvent[] = [];
    for (const doc of snap.docs) {
        const d = doc.data();
        if (isEventBroken(d)) {
            broken.push({
                id: doc.id,
                title: d.title || '(utan titel)',
                url: d.url || '',
                locationName: d.locationName || '',
                extractedAddress: d.extractedAddress || '',
                lat: d.lat ?? 0,
                lng: d.lng ?? 0,
                description: d.description || '',
            });
        }
    }
    return broken;
}

function findBrokenInLocal(): BrokenEvent[] {
    const filePath = path.resolve(__dirname, '../../../scraped_events.json');
    if (!fs.existsSync(filePath)) {
        throw new Error(`Lokal JSON saknas: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const events: any[] = JSON.parse(raw);
    const broken: BrokenEvent[] = [];
    for (const d of events) {
        if (isEventBroken(d)) {
            broken.push({
                id: '',
                title: d.title || '(utan titel)',
                url: d.url || '',
                locationName: d.locationName || '',
                extractedAddress: d.extractedAddress || '',
                lat: d.lat ?? 0,
                lng: d.lng ?? 0,
                description: d.description || '',
            });
        }
    }
    return broken;
}

// ─── Adress-extraktion från fri text ──────────────────────────────────────────

function extractAddressFromDescription(desc: string): string | null {
    if (!desc) return null;
    const cleaned = desc.replace(/\s+/g, ' ');

    // Mönster 1: Gatunamn + nr + postnr + stad
    const m1 = cleaned.match(
        /([A-ZÅÄÖ][A-Za-zÅÄÖåäö.\-]+(?:gatan|vägen|allén|allé|plan|torget|torg|gränd|backen|stigen)\s+\d+[A-Za-z]?(?:\s*,)?\s*\d{3}\s?\d{2}\s+[A-ZÅÄÖ][A-ZÅÄÖa-zåäö-]+)/
    );
    if (m1) return m1[1].trim();

    // Mönster 2: Bara postnr + stad
    const m2 = cleaned.match(/(\d{3}\s?\d{2}\s+[A-ZÅÄÖ][A-ZÅÄÖa-zåäö-]+)/);
    if (m2) return m2[1].trim();

    return null;
}

/**
 * Hämtar adress från titel. Kollar både "Gata nr, Stad"-mönster och
 * "Venue, City" / "Venue - City" / svensk stad ensam.
 */
function extractAddressFromTitle(title: string): string | null {
    if (!title) return null;
    const cleaned = title.replace(/\s+/g, ' ');

    // Gata + nr + ev. distrikt + svensk stad — fångar "Bärnstensv 12, Bomhus, Gävle"
    const cityAlt = SWEDISH_CITIES.join('|');
    const streetMatch = cleaned.match(
        new RegExp(
            `([A-ZÅÄÖ][A-Za-zÅÄÖåäö.\\-]+(?:gatan|vägen|v|allén|allé|plan|torget|torg|gränd|backen|stigen)\\.?\\s*\\d+[A-Za-z]?(?:\\s*,\\s*[A-ZÅÄÖ][A-Za-zÅÄÖåäö.\\-]+)?\\s*,?\\s*(?:${cityAlt})\\b)`,
            'i'
        )
    );
    if (streetMatch) return streetMatch[1].trim();

    // Venue, City (t.ex. "Arbis, Norrköping")
    for (const city of SWEDISH_CITIES) {
        const cityRe = new RegExp(`\\b${city}\\b`, 'i');
        if (!cityRe.test(cleaned)) continue;

        const venueCity = cleaned.match(
            new RegExp(`([A-ZÅÄÖ][A-Za-zÅÄÖåäö .'&-]{2,40})[,\\-–|]\\s*${city}\\b`, 'i')
        );
        if (venueCity) {
            const venue = venueCity[1].trim();
            if (venue.length > 2 && /[A-Za-zÅÄÖåäö]/.test(venue)) {
                return `${venue}, ${city}`;
            }
        }
        return city;
    }
    return null;
}

/**
 * Söker eventets titel på FB events. Identisk logik som tidigare — sista fallback.
 */
async function searchFbForLocation(page: Page, evt: BrokenEvent): Promise<string | null> {
    const idMatch = evt.url.match(/\/events\/(\d+)/);
    if (!idMatch) return null;
    const eventId = idMatch[1];

    const firstSegment = evt.title.split(/[|\-–@]/)[0].trim().slice(0, 60);
    const queries = Array.from(new Set([
        evt.title.slice(0, 80),
        firstSegment,
    ])).filter(q => q.length >= 3);

    for (const q of queries) {
        const searchUrl = `https://www.facebook.com/events/search/?q=${encodeURIComponent(q)}`;
        try {
            await page.goto(searchUrl, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 2500));

            const locText = await page.evaluate((id, cityList) => {
                const links = Array.from(document.querySelectorAll(`a[href*="/events/${id}"]`));
                for (const link of links) {
                    let container: HTMLElement | null = link as HTMLElement;
                    for (let i = 0; i < 8 && container; i++) {
                        container = container.parentElement;
                    }
                    if (!container) continue;

                    const texts = Array.from(container.querySelectorAll('span, div'))
                        .filter(el => el.children.length === 0 && el.textContent?.trim())
                        .map(el => el.textContent!.trim())
                        .filter(t => t.length >= 3 && t.length < 120);

                    for (const t of texts) {
                        if (/\d{3}\s?\d{2}\s+[A-ZÅÄÖ]/.test(t)) return t;
                    }
                    for (const t of texts) {
                        const lower = t.toLowerCase();
                        if (t.includes(',') && cityList.some((c: string) => lower.includes(c.toLowerCase()))) {
                            return t;
                        }
                    }
                    for (const t of texts) {
                        const lower = t.toLowerCase();
                        for (const c of cityList) {
                            if (lower === c.toLowerCase() || lower.endsWith(c.toLowerCase())) {
                                return t;
                            }
                        }
                    }
                }
                return null;
            }, eventId, SWEDISH_CITIES);

            if (locText && !isStaticallyBroken(locText)) return locText;
        } catch {
            // Hoppa till nästa sökvariant
        }
    }
    return null;
}

// ─── List-läge (lokal JSON, ingen DB) ─────────────────────────────────────────

async function listOnly() {
    console.log('🔍 Letar trasiga/saknade adresser i lokal scraped_events.json...\n');
    const broken = findBrokenInLocal();
    const chromeBlacklist = buildChromeBlacklist(broken);

    console.log(`📋 Hittade ${broken.length} event med trasig/saknad adress.`);
    if (chromeBlacklist.size > 0) {
        console.log(`🚫 Auto-detekterad chrome (≥3 förekomster): ${chromeBlacklist.size} st`);
        for (const a of chromeBlacklist) console.log(`     • "${a}"`);
    }
    console.log('');
    if (broken.length === 0) return;

    const byReason: Record<string, BrokenEvent[]> = {
        'Utländsk (skippas av fix-läget)': [],
        'Chrome (auto-detekterad)': [],
        'Statiskt känd falsk (Hovmantorp/Parkgatan)': [],
        'Tom locationName': [],
        'Ogiltig koord (0/0 eller utanför Sverige)': [],
    };

    for (const e of broken) {
        if (looksForeign(e.title, e.locationName, e.extractedAddress)) {
            byReason['Utländsk (skippas av fix-läget)'].push(e);
        } else if (chromeBlacklist.has(e.extractedAddress)) {
            byReason['Chrome (auto-detekterad)'].push(e);
        } else if (isStaticallyBroken(e.extractedAddress)) {
            byReason['Statiskt känd falsk (Hovmantorp/Parkgatan)'].push(e);
        } else if (!e.locationName) {
            byReason['Tom locationName'].push(e);
        } else {
            byReason['Ogiltig koord (0/0 eller utanför Sverige)'].push(e);
        }
    }

    for (const [reason, list] of Object.entries(byReason)) {
        if (list.length === 0) continue;
        console.log(`── ${reason} (${list.length}) ${'─'.repeat(40)}`);
        list.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.title.slice(0, 60)}`);
            console.log(`     loc="${e.locationName.slice(0, 40)}" addr="${e.extractedAddress.slice(0, 60)}" lat,lng=${e.lat.toFixed(3)},${e.lng.toFixed(3)}`);
        });
        console.log('');
    }
}

// ─── Fix-läge ─────────────────────────────────────────────────────────────────

interface SummaryItem {
    id: string;
    title: string;
    before: string;
    after: string | null;
    method: string;       // description|title|pin-row|fb-search|none
    status: string;       // fixed|foreign-skipped|no-candidate|invalid-coord|unchanged|error
}

async function fixAll() {
    console.log('🔧 Letar trasiga adresser i Firestore...');
    const broken = await findBrokenInFirestore();
    console.log(`📋 Hittade ${broken.length} event med trasig/saknad adress.`);

    const chromeBlacklist = buildChromeBlacklist(broken);
    if (chromeBlacklist.size > 0) {
        console.log(`🚫 Auto-detekterad chrome (≥3 förekomster), kommer aldrig användas:`);
        for (const a of chromeBlacklist) console.log(`     • "${a}"`);
    }
    console.log('');

    if (broken.length === 0) {
        console.log('✅ Inga event att fixa!');
        return;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-notifications', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    let fixed = 0;
    let foreignSkipped = 0;
    let noCandidate = 0;
    let invalidCoord = 0;
    let unchanged = 0;
    let errors = 0;
    const summary: SummaryItem[] = [];

    for (let i = 0; i < broken.length; i++) {
        const evt = broken[i];
        const prefix = `[${i + 1}/${broken.length}]`;
        console.log(`\n${prefix} ${evt.title}`);
        console.log(`   Innan: loc="${evt.locationName}" addr="${evt.extractedAddress}" lat,lng=${evt.lat.toFixed(3)},${evt.lng.toFixed(3)}`);

        // ── Tidigt skip: utländska event ──────────────────────────────────────
        if (looksForeign(evt.title, evt.locationName, evt.extractedAddress)) {
            console.log('   🌍 Utländskt event — skippas (vi försöker inte påtvinga svensk geokod).');
            foreignSkipped++;
            summary.push({ id: evt.id, title: evt.title, before: evt.extractedAddress, after: null, method: 'none', status: 'foreign-skipped' });
            continue;
        }

        try {
            await page.goto(evt.url, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 3000));

            // Expandera "visa mer"-knappar för full beskrivning
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
                for (const btn of buttons) {
                    const txt = btn.textContent?.trim().toLowerCase() || '';
                    if (txt === 'visa mer' || txt === 'see more') (btn as HTMLElement).click();
                }
            }).catch(() => {});
            await new Promise(r => setTimeout(r, 1000));

            const details = await extractEventDetails(page);
            const loc = await LocationInstrument.extractInfo(page, details.title);

            // ── Kandidat-pipeline: description → title → pin-row → fb-search ─
            let candidateAddr: string | null = null;
            let candidateName: string | null = null;
            let method: string = 'none';

            const fromDesc = extractAddressFromDescription(details.description || evt.description || '');
            if (fromDesc && !isBlacklisted(fromDesc, chromeBlacklist)) {
                candidateAddr = fromDesc;
                method = 'description';
                console.log(`   📖 Beskrivning: "${fromDesc}"`);
            }

            if (!candidateAddr) {
                const fromTitle = extractAddressFromTitle(evt.title);
                if (fromTitle && !isBlacklisted(fromTitle, chromeBlacklist)) {
                    candidateAddr = fromTitle;
                    method = 'title';
                    console.log(`   🏷️  Titel: "${fromTitle}"`);
                }
            }

            if (!candidateAddr && loc.fullAddress && !isBlacklisted(loc.fullAddress, chromeBlacklist)) {
                candidateAddr = loc.fullAddress;
                candidateName = loc.name || null;
                method = 'pin-row';
                console.log(`   📍 Pin-row: "${loc.fullAddress}"`);
            }

            if (!candidateAddr) {
                console.log('   🔎 Söker på FB events efter titeln...');
                const fromSearch = await searchFbForLocation(page, evt);
                if (fromSearch && !isBlacklisted(fromSearch, chromeBlacklist)) {
                    candidateAddr = fromSearch;
                    method = 'fb-search';
                    console.log(`   🔎 FB-sök: "${fromSearch}"`);
                }
            }

            if (!candidateAddr) {
                console.log('   ⏭️  Ingen kandidat hittades — rör inte raden.');
                noCandidate++;
                summary.push({ id: evt.id, title: evt.title, before: evt.extractedAddress, after: null, method: 'none', status: 'no-candidate' });
                continue;
            }

            // ── Geokoda och validera ─────────────────────────────────────────
            const geo = await geocodeVenueSweden(candidateAddr);
            if (!geo || !isValidSwedishCoord(geo[0], geo[1])) {
                console.log(`   ❌ Kandidat "${candidateAddr}" gav ogiltig svensk koord — rör inte raden.`);
                invalidCoord++;
                summary.push({ id: evt.id, title: evt.title, before: evt.extractedAddress, after: candidateAddr, method, status: 'invalid-coord' });
                continue;
            }

            const [newLat, newLng] = geo;

            // ── Skippa om inget faktiskt förändras ──────────────────────────
            const sameAddr = candidateAddr === evt.extractedAddress;
            const sameCoord = Math.abs(newLat - evt.lat) < 1e-5 && Math.abs(newLng - evt.lng) < 1e-5;
            if (sameAddr && sameCoord) {
                console.log('   ⏭️  Kandidaten matchar befintlig data — ingen update behövs.');
                unchanged++;
                summary.push({ id: evt.id, title: evt.title, before: evt.extractedAddress, after: candidateAddr, method, status: 'unchanged' });
                continue;
            }

            // ── Skriv till Firestore ─────────────────────────────────────────
            const updateData: Record<string, unknown> = {
                extractedAddress: candidateAddr,
                geocodedQuery: cleanVenueName(candidateAddr),
                lat: newLat,
                lng: newLng,
                isLocationVerified: true,
            };
            if (candidateName) updateData.locationName = candidateName;

            await db!.collection('linkEvents').doc(evt.id).update(updateData);
            fixed++;
            console.log(`   ✅ FIXAD (${method}) → addr="${candidateAddr}" lat,lng=${newLat.toFixed(4)},${newLng.toFixed(4)}`);
            summary.push({ id: evt.id, title: evt.title, before: evt.extractedAddress, after: candidateAddr, method, status: 'fixed' });
        } catch (e: any) {
            console.log(`   ⚠️  Fel: ${e?.message || e}`);
            errors++;
            summary.push({ id: evt.id, title: evt.title, before: evt.extractedAddress, after: null, method: 'none', status: 'error' });
        }
    }

    await browser.close();

    console.log('\n==========================================');
    console.log(`📊 KLAR av ${broken.length} event:`);
    console.log(`     ✅ fixade            ${fixed}`);
    console.log(`     🌍 utländsk-skip     ${foreignSkipped}`);
    console.log(`     ⏭️  ingen kandidat    ${noCandidate}`);
    console.log(`     ❌ ogiltig koord     ${invalidCoord}`);
    console.log(`     ➖ oförändrade       ${unchanged}`);
    console.log(`     ⚠️  fel              ${errors}`);
    console.log('==========================================');

    const reportPath = path.resolve(__dirname, '../../../fix_addresses_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        runAt: new Date().toISOString(),
        total: broken.length,
        fixed,
        foreignSkipped,
        noCandidate,
        invalidCoord,
        unchanged,
        errors,
        chromeBlacklist: Array.from(chromeBlacklist),
        items: summary,
    }, null, 2), 'utf-8');
    console.log(`💾 Rapport sparad: ${reportPath}`);
}

async function main() {
    const listMode = process.argv.includes('--list');
    if (listMode) {
        await listOnly();
    } else {
        await fixAll();
    }
}

if (require.main === module) {
    main()
        .catch(err => {
            console.error('❌ Skriptet kraschade:', err);
            process.exitCode = 1;
        })
        .finally(() => {
            process.exit(process.exitCode || 0);
        });
}
