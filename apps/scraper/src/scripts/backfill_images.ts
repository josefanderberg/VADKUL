/**
 * Backfill-script: hittar alla events i Firestore som saknar bild eller har en
 * trasig coverImage-URL och försöker hämta en fallback-bild från Google Images.
 *
 * Kör med:  npx ts-node src/scripts/backfill_images.ts
 *           npx ts-node src/scripts/backfill_images.ts --dry-run
 */

import puppeteer, { Page } from 'puppeteer';
import { db } from '../config/firebase';
import { searchGoogleImage } from '../utils/imageSearch';

const DRY_RUN = process.argv.includes('--dry-run');

const GENERIC_IMAGE_PATTERNS = [
    'facebook.com/images/',
    'fbcdn.net/rsrc.php',
    'static.xx.fbcdn.net'
];

function isObviouslyGeneric(url: string | undefined | null): boolean {
    if (!url || url.trim().length === 0) return true;
    return GENERIC_IMAGE_PATTERNS.some(p => url.includes(p));
}

/**
 * HEAD-check: verifiera att en bild-URL faktiskt returnerar en bild.
 * Lookaside-URL:er kan vara satta men returnera 0 bytes eller fel content-type.
 */
async function urlServesRealImage(url: string): Promise<boolean> {
    try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        if (!res.ok) return false;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) return false;
        const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
        // Tomma/placeholder-bilder är ofta <1 KB
        if (contentLength > 0 && contentLength < 1024) return false;
        return true;
    } catch {
        return false;
    }
}

async function main() {
    if (!db) {
        console.error('❌ Firebase Admin är inte initierad (service-account.json saknas?).');
        process.exit(1);
    }

    console.log(`🔎 Läser alla linkEvents från Firestore...${DRY_RUN ? '  (DRY RUN)' : ''}`);
    const snap = await db.collection('linkEvents').get();
    console.log(`📦 Hittade ${snap.size} events totalt.`);

    const needFallback: { id: string; title: string; coverImage: string }[] = [];

    for (const doc of snap.docs) {
        const data = doc.data();
        const cover = data.coverImage as string | undefined;
        if (isObviouslyGeneric(cover)) {
            needFallback.push({ id: doc.id, title: data.title || '', coverImage: cover || '' });
            continue;
        }
        // Lookaside / okända domäner: HEAD-kolla att de faktiskt levererar en bild
        const works = await urlServesRealImage(cover!);
        if (!works) {
            needFallback.push({ id: doc.id, title: data.title || '', coverImage: cover || '' });
        }
    }

    console.log(`\n🎯 ${needFallback.length} events behöver fallback-bild.`);
    if (needFallback.length === 0) {
        console.log('✅ Inget att göra.');
        return;
    }

    if (DRY_RUN) {
        for (const ev of needFallback) {
            console.log(`  - [${ev.id}] "${ev.title}"  (cover: ${ev.coverImage.slice(0, 60) || '<tom>'})`);
        }
        console.log('\n💡 Kör utan --dry-run för att faktiskt hämta bilder.');
        return;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-notifications', '--disable-setuid-sandbox']
    });
    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    let updated = 0;
    let failed = 0;

    for (const ev of needFallback) {
        if (!ev.title || ev.title.trim().length === 0) {
            console.log(`  ⏩ Hoppar över ${ev.id} (saknar titel).`);
            continue;
        }
        console.log(`\n🔍 [${ev.id}] "${ev.title}"`);
        const img = await searchGoogleImage(page, ev.title);
        if (img) {
            try {
                await db.collection('linkEvents').doc(ev.id).update({ coverImage: img });
                console.log(`    ✅ Uppdaterad med: ${img.slice(0, 80)}...`);
                updated++;
            } catch (e) {
                console.log(`    ❌ Kunde inte uppdatera Firestore:`, (e as Error).message);
                failed++;
            }
        } else {
            console.log(`    ⚠️ Ingen Google-bild hittades.`);
            failed++;
        }
        // Liten paus så vi inte spammar Google
        await new Promise(r => setTimeout(r, 1500));
    }

    await browser.close();
    console.log(`\n🎉 Klar! Uppdaterade ${updated}, misslyckades med ${failed}.`);
}

main().catch(e => {
    console.error('💥 Backfill kraschade:', e);
    process.exit(1);
});
