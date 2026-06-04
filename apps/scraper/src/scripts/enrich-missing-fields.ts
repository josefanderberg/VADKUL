/**
 * Enrich-pass: besök varje event-URL och fyll saknade fält.
 *
 * För varje event i våra 14 nya Source-kommuner:
 *   1. Avgör vad som saknas (bild, beskrivning, koordinater)
 *   2. Hämta event-permalänken som HTML
 *   3. Extrahera saknade fält via:
 *      - <meta property="og:image">, og:description
 *      - JSON-LD Event-noder
 *      - Vanliga DOM-mönster (article > p, .description)
 *   4. Uppdatera Firestore + SQLite med funna fält
 *
 * Användning:
 *   npx ts-node src/scripts/enrich-missing-fields.ts                    # dry-run
 *   npx ts-node src/scripts/enrich-missing-fields.ts --apply
 *   npx ts-node src/scripts/enrich-missing-fields.ts --host=Alingsås
 *   npx ts-node src/scripts/enrich-missing-fields.ts --apply --field=description
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { SOURCES } from '../sources/registry';
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

const HOST_FILTER = args.host?.toLowerCase();
const FIELD_FILTER: string | null = args.field || null; // 'image' | 'description' | 'geo' | null=alla
const HOSTS = SOURCES.map((s) => s.hostName).filter((h) => !HOST_FILTER || h.toLowerCase().includes(HOST_FILTER));
const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0.0.0';
const PER_HOST_DELAY_MS = 600;

async function fetchHtml(url: string): Promise<string | null> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'sv-SE,sv' },
            redirect: 'follow', signal: ac.signal,
        });
        if (!res.ok) return null;
        return await res.text();
    } catch { return null; }
    finally { clearTimeout(t); }
}

function pickMeta(html: string, prop: string): string | undefined {
    // Hittar både <meta property="og:image"> och <meta name="...">
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop.replace(':', '\\:')}["'][^>]+content=["']([^"']+)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop.replace(':', '\\:')}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    return m?.[1];
}

function extractJsonLdEvent(html: string): any | null {
    const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const b of blocks) {
        const m = b.match(/>([\s\S]*?)<\/script>/);
        if (!m) continue;
        try {
            const data = JSON.parse(m[1].trim());
            const walk = (n: any): any | null => {
                if (!n) return null;
                if (Array.isArray(n)) { for (const x of n) { const r = walk(x); if (r) return r; } return null; }
                if (typeof n !== 'object') return null;
                const t = n['@type'];
                if (typeof t === 'string' && /Event/i.test(t)) return n;
                for (const v of Object.values(n)) { const r = walk(v); if (r) return r; }
                return null;
            };
            const ev = walk(data);
            if (ev) return ev;
        } catch { /* ignore */ }
    }
    return null;
}

function extractImage(html: string): string | undefined {
    return pickMeta(html, 'og:image') || pickMeta(html, 'twitter:image') || extractJsonLdEvent(html)?.image?.url || extractJsonLdEvent(html)?.image;
}

function extractDescription(html: string): string | undefined {
    // 1. JSON-LD description
    const jsonLd = extractJsonLdEvent(html);
    if (jsonLd?.description && typeof jsonLd.description === 'string') {
        const cleaned = jsonLd.description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 30) return cleaned.slice(0, 800);
    }
    // 2. og:description
    const og = pickMeta(html, 'og:description');
    if (og && og.length > 30) return og.slice(0, 800);
    // 3. meta description
    const meta = pickMeta(html, 'description');
    if (meta && meta.length > 30) return meta.slice(0, 800);
    // 4. Första significant <p> i article/main
    const articleMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i);
    const scope = articleMatch?.[1] || html;
    const ps = Array.from(scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi));
    for (const p of ps) {
        const text = p[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (text.length > 80 && !text.startsWith('Cookies') && !text.includes('javascript')) {
            return text.slice(0, 800);
        }
    }
    return undefined;
}

function extractAddress(html: string): string | undefined {
    // JSON-LD location/address
    const jsonLd = extractJsonLdEvent(html);
    if (jsonLd?.location) {
        const loc = Array.isArray(jsonLd.location) ? jsonLd.location[0] : jsonLd.location;
        if (typeof loc === 'string') return loc;
        if (loc?.name) return loc.name + (loc.address?.streetAddress ? `, ${loc.address.streetAddress}` : '');
        if (loc?.address?.streetAddress) return loc.address.streetAddress;
    }
    // Vanliga svenska kommunsajt-mönster: <dt>Plats</dt><dd>X</dd>, "Plats: X"
    const dt = html.match(/<dt[^>]*>\s*(?:plats|var|adress)\s*<\/dt>\s*<dd[^>]*>([^<]{3,100})/i);
    if (dt) return dt[1].trim();
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const inline = text.match(/(?:Plats|Adress)[:：]\s*([A-ZÅÄÖ][^.!?\n,]{3,80})/);
    if (inline) return inline[1].trim();
    return undefined;
}

interface EventRow {
    url: string; title: string; firestoreId: string; hostName: string;
    coverImage: string | null; description: string | null;
    lat: number; lng: number; locationName: string;
}

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    console.log(args.apply ? '🔧 APPLY mode' : '🔍 DRY-RUN');
    console.log(`Hostar: ${HOSTS.length}, fältfilter: ${FIELD_FILTER || 'alla'}\n`);

    const rows: EventRow[] = sqliteDb.prepare(`
        SELECT url, title, firestoreId, hostName, coverImage, description, lat, lng, locationName
        FROM link_events
        WHERE hostName IN (${HOSTS.map(() => '?').join(',')})
          AND firestoreId IS NOT NULL
          AND hidden = 0
        ORDER BY hostName
    `).all(...HOSTS) as EventRow[];

    const stats: Record<string, { img: number; desc: number; geo: number; failed: number; checked: number }> = {};
    let totalImgFound = 0, totalDescFound = 0, totalGeoFound = 0;

    let prevHost = '';
    for (const r of rows) {
        stats[r.hostName] ??= { img: 0, desc: 0, geo: 0, failed: 0, checked: 0 };
        stats[r.hostName].checked++;

        const needImg = (!r.coverImage || r.coverImage === '') && (!FIELD_FILTER || FIELD_FILTER === 'image');
        const needDesc = (!r.description || r.description.length < 11) && (!FIELD_FILTER || FIELD_FILTER === 'description');
        const needGeo = (r.lat === 0 && r.lng === 0) && (!FIELD_FILTER || FIELD_FILTER === 'geo');
        if (!needImg && !needDesc && !needGeo) continue;

        if (prevHost !== r.hostName) {
            console.log(`\n=== ${r.hostName} ===`);
            prevHost = r.hostName;
        }

        const html = await fetchHtml(r.url);
        if (!html) {
            stats[r.hostName].failed++;
            console.log(`  ⚠️  ${r.title.slice(0, 50)} — fetch failed`);
            continue;
        }

        const updates: Record<string, any> = {};
        const found: string[] = [];

        if (needImg) {
            const img = extractImage(html);
            if (img && typeof img === 'string' && img.startsWith('http')) {
                updates.coverImage = img;
                stats[r.hostName].img++;
                totalImgFound++;
                found.push('img');
            }
        }
        if (needDesc) {
            const desc = extractDescription(html);
            if (desc) {
                updates.description = desc;
                stats[r.hostName].desc++;
                totalDescFound++;
                found.push('desc');
            }
        }
        if (needGeo) {
            const addr = extractAddress(html);
            if (addr) {
                const cityHint = r.locationName && r.locationName !== 'Sverige' ? r.locationName : '';
                const q = `${addr}, ${cityHint || r.hostName.replace(/[^A-ZÅÄÖa-zåäö ]/g, '').trim()}`;
                const coords = await geocodeVenueSweden(q);
                if (coords) {
                    updates.lat = coords[0];
                    updates.lng = coords[1];
                    updates.isLocationVerified = true;
                    stats[r.hostName].geo++;
                    totalGeoFound++;
                    found.push('geo');
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            console.log(`  ✅ [${found.join(',').padEnd(12)}] ${r.title.slice(0, 60)}`);
            if (args.apply) {
                try {
                    await db.collection('linkEvents').doc(r.firestoreId).update(updates);
                } catch (e) {
                    console.error(`    ERR: ${(e as Error).message}`);
                    stats[r.hostName].failed++;
                }
            }
        }
        await new Promise((res) => setTimeout(res, PER_HOST_DELAY_MS));
    }

    sqliteDb.close();

    console.log('\n=== Sammanfattning ===');
    for (const [host, s] of Object.entries(stats)) {
        console.log(`  ${host.padEnd(28)} checked=${String(s.checked).padStart(4)}  +img=${String(s.img).padStart(3)}  +desc=${String(s.desc).padStart(3)}  +geo=${String(s.geo).padStart(3)}  failed=${s.failed}`);
    }
    console.log(`TOTAL nya: img=${totalImgFound} desc=${totalDescFound} geo=${totalGeoFound}  ${args.apply ? '(applicerade)' : '(dry-run)'}`);
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
