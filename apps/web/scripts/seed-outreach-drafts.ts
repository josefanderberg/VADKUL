// ENGÅNGS-SEED (19/8): skriver handförfattade utkast till outreachDrafts —
// samma payload-form som draft-routen sparar, så konsolens DraftStore/dock
// plockar upp dem via GET utan att Anthropic-API:t rörs.
//
// Körning (från apps/web):
//   PATH=... npx tsx scripts/seed-outreach-drafts.ts <utkastfil.json>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));

interface Utkast {
    contactId: string; contactName: string;
    postingMode: 'approval' | 'direct' | 'unknown';
    linkTarget: string;
    weekCount: number; nearCount: number; radiusKm: number;
    dataUpdatedAt: string; source: 'live' | 'snapshot';
    angle: string;
    mentionedEvents: { title: string; day: string; place: string; emoji: string }[];
    v1: string; v2Post: string; v2FirstComment: string;
}

async function main() {
    const inFile = process.argv[2];
    if (!inFile) throw new Error('ange utkastfil: npx tsx scripts/seed-outreach-drafts.ts <fil.json>');
    const { utkast } = JSON.parse(fs.readFileSync(inFile, 'utf8')) as { utkast: Utkast[] };

    const sa = JSON.parse(fs.readFileSync(path.resolve(here, '../../scraper/service-account.json'), 'utf8'));
    initializeApp({ credential: cert(sa) });
    const db = getFirestore();

    const now = Date.now();
    for (const u of utkast) {
        // Sanity: kontakten måste finnas — ett utkast till fel id syns aldrig i konsolen.
        const contactSnap = await db.collection('outreachContacts').doc(u.contactId).get();
        if (!contactSnap.exists) throw new Error(`kontakt saknas: ${u.contactId}`);

        const payload = {
            drafts: { v1: u.v1, v2Post: u.v2Post, v2FirstComment: u.v2FirstComment },
            mentionedEvents: u.mentionedEvents,
            angle: u.angle,
            meta: {
                contactId: u.contactId,
                contactName: u.contactName,
                postingMode: u.postingMode,
                linkTarget: u.linkTarget,
                weekCount: u.weekCount,
                nearCount: u.nearCount,
                radiusKm: u.radiusKm,
                dataUpdatedAt: u.dataUpdatedAt,
                source: u.source,
                model: 'handskrivet (Claude Code, utan API)',
                generatedAt: now,
            },
        };
        await db.collection('outreachDrafts').doc(u.contactId).set({
            contactId: u.contactId,
            contactName: u.contactName,
            payload,
            generatedAt: now,
        });
        console.log(`✓ ${u.contactName} (${u.contactId})`);
    }
    console.log(`Klart — ${utkast.length} utkast seedade.`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
