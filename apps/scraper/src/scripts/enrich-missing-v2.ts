/**
 * Enrich v2 — andra pass med bättre extraktorer för kvarvarande luckor.
 *
 * Förbättringar vs v1:
 *   - Image: faller tillbaka till första rimliga `wp-content/uploads/` om
 *     og:image saknas (Tribe-sajter typ Norsjö)
 *   - Description: leta efter `<article>`-text och rensa bort nav-prefix
 *     ("Du är här:", "Hem > Evenemang"); strippar också datum/title
 *   - Address: rensa "Plats", "Var", "Visa på karta", "Arrangör" + dedupar
 *     upprepningar ("Stora torg Stora torg 241 30 Eslöv" → "Stora torg, Eslöv")
 *
 * Användning: identiskt med v1 men med dessa bättre extraktorer.
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

const HOSTS = SOURCES.map((s) => s.hostName).filter((h) => !args.host || h.toLowerCase().includes(args.host.toLowerCase()));
const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0.0.0';

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
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop.replace(':', '\\:')}["'][^>]+content=["']([^"']+)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop.replace(':', '\\:')}["']`, 'i');
    return (html.match(re1) || html.match(re2))?.[1];
}

/**
 * v2 IMAGE: prova og:image → twitter:image → första `wp-content/uploads/`-bild
 *   (filtrerar logos, ikoner, loaders).
 */
function extractImage(html: string): string | undefined {
    const og = pickMeta(html, 'og:image') || pickMeta(html, 'twitter:image');
    if (og && og.startsWith('http')) return og;

    const imgs = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1]);
    for (const src of imgs) {
        if (!src.startsWith('http')) continue;
        const lower = src.toLowerCase();
        // OBS: lqip = "low quality image placeholder" — vissa WP-teman lagrar
        // bara den varianten i HTML och full version finns via filnamnsbyte.
        // Vi behåller lqip-bilder; försöker byta till full version nedan.
        if (/logo|icon|loading|placeholder|spinner|\bbgr?\b|favicon/.test(lower)) continue;
        if (!lower.includes('wp-content/uploads/') && !lower.includes('media/')) continue;
        if (/\.svg(\?|$)/.test(lower)) continue;
        // Många "lqip" (low-quality image placeholder) thumbnails — föredra full version
        return src.replace(/-lqip\./, '.').replace(/-\d+x\d+\./, '.');
    }
    return undefined;
}

function jsonLdEvent(html: string): any | null {
    const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const b of blocks) {
        const inner = b.replace(/^[\s\S]*?>([\s\S]*?)<\/script>$/, '$1').trim();
        try {
            const d = JSON.parse(inner);
            const walk = (n: any): any | null => {
                if (!n) return null;
                if (Array.isArray(n)) { for (const x of n) { const r = walk(x); if (r) return r; } return null; }
                if (typeof n !== 'object') return null;
                if (typeof n['@type'] === 'string' && /Event/i.test(n['@type'])) return n;
                for (const v of Object.values(n)) { const r = walk(v); if (r) return r; }
                return null;
            };
            const ev = walk(d);
            if (ev) return ev;
        } catch { /* ignore */ }
    }
    return null;
}

/**
 * v2 DESCRIPTION: använd article/main-text men strip nav-prefix + titel + datum.
 * Behåll de paragraf-liknande satser som följer.
 */
function extractDescription(html: string, title?: string): string | undefined {
    const jsonLd = jsonLdEvent(html);
    if (jsonLd?.description && typeof jsonLd.description === 'string') {
        const cleaned = jsonLd.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 30) return cleaned.slice(0, 800);
    }
    const og = pickMeta(html, 'og:description');
    if (og && og.length > 30) return og.slice(0, 800);

    // article/main
    const scopeMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i);
    if (scopeMatch) {
        let text = scopeMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

        // Strippa breadcrumb-prefix ("Du är här: Hem ... > X >")
        text = text.replace(/^Du\s+är\s+här:[^>]+?(?:>|»)\s*/i, '');
        text = text.replace(/^(?:Hem|Start)\s*[›»>]\s*.*?[›»>]\s*/, '');
        // Strippa upprepad titel (Alingsås-mönster: "Macken – tv-serien... Macken – tv-serien...")
        if (title && title.length > 8) {
            const t = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(new RegExp(`(?:${t}\\s*){2,}`, 'i'), title + ' ');
            text = text.replace(new RegExp(`^.{0,100}?${t}`, 'i'), '');
        }
        // Strippa datum-prefix "6 juli 2026, 10:00 till 19 juli 2026, 16:00"
        text = text.replace(/^\s*\d{1,2}\s+\w+\s+\d{4}[^a-zåäöA-ZÅÄÖ]+(?:till\s+\d{1,2}\s+\w+\s+\d{4}[^a-zåäöA-ZÅÄÖ]+)?\s*/, '');
        // Strippa "jun 6 Macken" mönster
        text = text.replace(/^\s*\w{3}\s+\d{1,2}\s+/, '');
        text = text.trim();

        if (text.length > 40) return text.slice(0, 800);
    }

    // Sista utvägen: första significant <p>
    const ps = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi));
    for (const p of ps) {
        const t = p[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (t.length > 80 && !/cookies|javascript|stäng/i.test(t)) return t.slice(0, 800);
    }
    return undefined;
}

/**
 * v2 ADDRESS: extrahera, dedupa upprepningar, strippa "Visa på karta", "Arrangör...".
 */
function extractAddress(html: string): string | undefined {
    // JSON-LD location
    const jl = jsonLdEvent(html);
    if (jl?.location) {
        const loc = Array.isArray(jl.location) ? jl.location[0] : jl.location;
        if (typeof loc === 'string') return loc;
        if (loc?.address?.streetAddress) {
            const street = loc.address.streetAddress;
            const city = loc.address.addressLocality;
            return city ? `${street}, ${city}` : street;
        }
        if (loc?.name) return loc.name;
    }

    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    // Sök efter "Plats" / "Adress" / "Var" / "Lokal" + text efter
    const patterns = [
        /\bPlats\s*[:：]?\s+([^.\n]{3,150}?)(?:\s*(?:Visa på karta|Arrangör|Pris|Tid|Datum|Kategori|$))/i,
        /\bAdress\s*[:：]?\s+([^.\n]{3,150}?)(?:\s*(?:Visa på karta|Arrangör|$))/i,
        /\bVar\s*[:：]\s+([A-ZÅÄÖ][^.\n]{2,100}?)(?:\s*(?:Visa på karta|Arrangör|$))/i,
        /\bLokal\s*[:：]?\s+([A-ZÅÄÖ][^.\n]{2,100}?)(?:\s*(?:Visa på karta|Arrangör|$))/i,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (!m) continue;
        let raw = m[1].trim();
        // Strippa duplikat: "Stora torg Stora torg" → "Stora torg"
        const words = raw.split(/\s+/);
        const seen = new Set<string>();
        const dedupe: string[] = [];
        for (const w of words) {
            const k = w.toLowerCase().replace(/[.,]/g, '');
            if (seen.has(k) && k.length > 2) continue;
            seen.add(k);
            dedupe.push(w);
        }
        raw = dedupe.join(' ');
        // Ta bort upprepad city efter postnummer
        raw = raw.replace(/(\d{3}\s*\d{2})\s+([A-ZÅÄÖ][a-zåäö]+)\s+\2/i, '$1 $2');
        // Begränsa
        if (raw.length > 80) raw = raw.slice(0, 80);
        return raw.trim();
    }
    return undefined;
}

interface Row {
    url: string; title: string; firestoreId: string; hostName: string;
    coverImage: string | null; description: string | null;
    lat: number; lng: number; locationName: string;
}

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    console.log(args.apply ? '🔧 APPLY' : '🔍 DRY-RUN');

    const rows: Row[] = sqliteDb.prepare(`
        SELECT url, title, firestoreId, hostName, coverImage, description, lat, lng, locationName
        FROM link_events
        WHERE hostName IN (${HOSTS.map(() => '?').join(',')})
          AND firestoreId IS NOT NULL
          AND hidden = 0
          AND ((coverImage IS NULL OR coverImage = '')
               OR length(coalesce(description,'')) < 11
               OR (lat = 0 AND lng = 0))
        ORDER BY hostName
    `).all(...HOSTS) as Row[];

    console.log(`Events med kvarvarande luckor: ${rows.length}\n`);

    const stats: Record<string, { img: number; desc: number; geo: number; failed: number }> = {};
    let totalImg = 0, totalDesc = 0, totalGeo = 0;

    let prevHost = '';
    for (const r of rows) {
        stats[r.hostName] ??= { img: 0, desc: 0, geo: 0, failed: 0 };
        if (prevHost !== r.hostName) { console.log(`\n=== ${r.hostName} ===`); prevHost = r.hostName; }

        const html = await fetchHtml(r.url);
        if (!html) { stats[r.hostName].failed++; continue; }

        const updates: Record<string, any> = {};
        const found: string[] = [];

        if (!r.coverImage || r.coverImage === '') {
            const img = extractImage(html);
            if (img) { updates.coverImage = img; stats[r.hostName].img++; totalImg++; found.push('img'); }
        }
        if (!r.description || r.description.length < 11) {
            const desc = extractDescription(html, r.title);
            if (desc) { updates.description = desc; stats[r.hostName].desc++; totalDesc++; found.push('desc'); }
        }
        if (r.lat === 0 && r.lng === 0) {
            const addr = extractAddress(html);
            if (addr) {
                const hostCity = r.hostName.replace(/s? Kommun$|^Visit |^Destination /i, '').replace(/ &.*/, '').trim();
                const q = addr.toLowerCase().includes(hostCity.toLowerCase()) ? addr : `${addr}, ${hostCity}`;
                const coords = await geocodeVenueSweden(q);
                if (coords) {
                    updates.lat = coords[0]; updates.lng = coords[1];
                    updates.isLocationVerified = true;
                    stats[r.hostName].geo++; totalGeo++; found.push('geo');
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            console.log(`  ✅ [${found.join(',').padEnd(12)}] ${r.title.slice(0, 55)}`);
            if (args.apply) {
                try { await db.collection('linkEvents').doc(r.firestoreId).update(updates); }
                catch (e) { console.error(`    ERR: ${(e as Error).message}`); }
            }
        }
        await new Promise((res) => setTimeout(res, 500));
    }

    sqliteDb.close();
    console.log('\n=== Sammanfattning ===');
    for (const [h, s] of Object.entries(stats)) {
        console.log(`  ${h.padEnd(28)} +img=${String(s.img).padStart(3)}  +desc=${String(s.desc).padStart(3)}  +geo=${String(s.geo).padStart(3)}  failed=${s.failed}`);
    }
    console.log(`TOTAL: img=${totalImg} desc=${totalDesc} geo=${totalGeo}  ${args.apply ? '(applicerade)' : '(dry-run)'}`);
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
