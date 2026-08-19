// ENGÅNGS-DUMP (19/8): eventunderlag för handskrivna utkast — samma kö-logik
// och eventPicker som konsolen/draft-routen, men utan Anthropic-anrop.
// Väljer toppgrupperna ur mogna kön (score desc), max en per ort
// (stadskrock-regeln), och dumpar kandidatlistorna + senaste inläggstexterna
// ("skriv inte likadant"-underlaget) som JSON till scratchpaden.
//
// Körning (från apps/web, service-account läses ur ../scraper/):
//   PATH=... npx tsx scripts/dump-draft-underlag.ts <utfil.json>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildQueueResponse } from '../src/lib/outreach/repo';
import { pickEventsForContact } from '../src/lib/outreach/eventPicker';
import type { OutreachLogEntry } from '../src/types/outreach';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAX_GRUPPER = 10;

async function main() {
    const outFile = process.argv[2];
    if (!outFile) throw new Error('ange utfil: npx tsx scripts/dump-draft-underlag.ts <utfil.json>');

    const sa = JSON.parse(fs.readFileSync(path.resolve(here, '../../scraper/service-account.json'), 'utf8'));
    initializeApp({ credential: cert(sa) });
    const db = getFirestore();

    const data = await buildQueueResponse(db);

    // Toppgrupper ur mogna kön, en per ort, grupplänk eller namn krävs (allt har namn).
    const seenCities = new Set<string>();
    const chosen = [];
    for (const item of data.queue) {
        if (chosen.length >= MAX_GRUPPER) break;
        const c = item.contact;
        if (c.doNotPost) continue;
        const cityKey = c.city?.trim().toLowerCase() ?? `okänd-${c.id}`;
        if (seenCities.has(cityKey)) continue;
        seenCities.add(cityKey);
        chosen.push(item);
    }

    const grupper = [];
    for (const item of chosen) {
        const c = item.contact;
        const picked = await pickEventsForContact(db, c, c.postingMode);
        grupper.push({
            contactId: c.id,
            name: c.name,
            city: c.city ?? null,
            postingMode: c.postingMode,
            groupUrl: c.groupUrl ?? null,
            memberCount: c.memberCount ?? null,
            postCount: c.postCount ?? 0,
            lastPostedAt: c.lastPostedAt ?? null,
            lastOutcome: c.lastOutcome ?? null,
            groupRulesNote: c.groupRulesNote ?? null,
            usedVariants: c.usedVariants ?? [],
            linkTarget: c.hasCityPage && c.citySlug
                ? `https://vadkul.se/evenemang/${c.citySlug}` : 'https://vadkul.se',
            scoreExplanation: item.scoreExplanation,
            picked: picked ? {
                weekCount: picked.weekCount,
                nearCount: picked.nearCount,
                radiusKm: picked.radiusKm,
                windowStartISO: picked.windowStartISO,
                windowEndISO: picked.windowEndISO,
                dataUpdatedAt: picked.dataUpdatedAt,
                source: picked.source,
                candidates: picked.candidates.map(e => ({
                    title: e.title,
                    dag: `${e.weekday} ${e.date}`,
                    tid: e.clockTime ?? null,
                    plats: e.place,
                    distanceKm: e.distanceKm,
                    kategori: e.category ?? null,
                    emoji: e.emoji ?? null,
                })),
            } : null,
        });
    }

    // Senaste inläggstexterna — variationsunderlaget.
    const recentSnap = await db.collection('outreachLog')
        .orderBy('draftCreatedAt', 'desc').limit(15).get();
    const tidigareInlagg = recentSnap.docs
        .map(d => (d.data() as OutreachLogEntry).bodyText)
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .slice(0, 5)
        .map(t => t.slice(0, 700));

    fs.writeFileSync(outFile, JSON.stringify({
        generatedAt: Date.now(),
        antalKandidater: data.queue.length,
        grupper,
        tidigareInlagg,
    }, null, 2));
    console.log(`OK — ${grupper.length} grupper (av ${data.queue.length} mogna) → ${outFile}`);
    for (const g of grupper) {
        console.log(`  ${g.name} (${g.city ?? '?'}) — ${g.postingMode}, ${g.picked?.weekCount ?? 0} event, near ${g.picked?.nearCount ?? 0}, url: ${g.groupUrl ? 'ja' : 'NEJ'}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
