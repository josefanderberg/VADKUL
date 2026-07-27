/**
 * import-outreach-md.ts — ENGÅNGSIMPORT av outreach-markdown → Firestore.
 *
 * Källor:
 *   docs/outreach/facebook-grupplista.md  → 83 outreachContacts (fb-grupp)
 *                                           + outreachLog-rader ur Postat-kolumnen
 *   docs/outreach/facebook-grupper.md     → bodyText-berikning (blockquote-avsnitten)
 *                                           + Byske-engagemanget (borttagna inlägget)
 *   docs/outreach/arrangorer.md           → 120 outreachContacts (arrangor)
 *                                           + email-loggrader för de skickade
 *   docs/outreach/medlemsmejl.md          → 1 kontakt (medlemslistan, aggregat — ingen PII)
 *
 * Körning (från apps/scraper):
 *   npx ts-node src/scripts/import-outreach-md.ts --dry-run   # bara parsa + facit
 *   npx ts-node src/scripts/import-outreach-md.ts --verify    # parsa + asserta facit
 *   npx ts-node src/scripts/import-outreach-md.ts --commit    # skriv till Firestore
 *
 * Idempotent: set({merge:true}) på deterministiska doc-id:n — kan köras om.
 * FACIT-ASSERTS: skriptet vägrar committa om siffrorna inte stämmer med det
 * manuellt räknade facit (20 loggade, 3 borttagna, 8 direkta …). Ändras
 * md-filerna efter 2026-07-26 måste facit-konstanterna uppdateras medvetet.
 */

import * as fs from 'fs';
import * as path from 'path';
import { db, dbTarget } from '../config/firebase';

const DOCS = path.resolve(__dirname, '../../../../docs/outreach');
const DAY_MS = 86_400_000;
const KARENS_DAGAR = 21;

type Mode = 'dry-run' | 'verify' | 'commit';
const mode: Mode = process.argv.includes('--commit') ? 'commit'
    : process.argv.includes('--verify') ? 'verify' : 'dry-run';

/* ── Hjälpare ─────────────────────────────────────────────────────────────── */

const slugify = (s: string) =>
    s.toLowerCase()
        .replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 80);

/** '17/7' → epoch ms (12:00 lokal, år 2026 — allt facit är juli 2026). */
const parseShortDate = (s: string): number | undefined => {
    const m = s.match(/(\d{1,2})\/(\d{1,2})/);
    if (!m) return undefined;
    return new Date(2026, parseInt(m[2], 10) - 1, parseInt(m[1], 10), 12, 0, 0).getTime();
};

/** 'skickat: 2026-07-17' → epoch ms. */
const parseIsoDate = (s: string): number | undefined => {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return undefined;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12).getTime();
};

const read = (f: string) => fs.readFileSync(path.join(DOCS, f), 'utf8');

/* ── 1. facebook-grupplista.md → kontakter + loggrader ────────────────────── */

interface ParsedGroup {
    listNumber: number;
    name: string;
    citySlug: string | null;
    hasCityPage: boolean;
    postatRaw: string;
}

function parseGrupplista(): ParsedGroup[] {
    const rows: ParsedGroup[] = [];
    for (const line of read('facebook-grupplista.md').split('\n')) {
        // | 12 | Det händer i Helsingborg | /evenemang/helsingborg | 24/7 · … |
        const m = line.match(/^\|\s*(\d+)\s*\|([^|]+)\|([^|]+)\|([^|]*)\|/);
        if (!m) continue;
        const link = m[3].trim();
        rows.push({
            listNumber: parseInt(m[1], 10),
            name: m[2].trim(),
            citySlug: link.startsWith('/evenemang/') ? link.slice('/evenemang/'.length) : null,
            hasCityPage: link.startsWith('/evenemang/'),
            postatRaw: m[4].trim(),
        });
    }
    return rows;
}

interface ParsedLog {
    listNumber: number;
    name: string;
    postedAt: number;
    linkPlacement: 'i-inlägget' | 'i-första-kommentaren';
    starLinkIncluded: boolean;
    variant?: string;
    outcome: 'publicerat-direkt' | 'krävde-godkännande' | 'godkänt-uppe' | 'borttagen' | 'okänt';
    likes?: number; comments?: number; shares?: number;
    noteTail?: string;
}

function parsePostat(g: ParsedGroup): ParsedLog | null {
    if (!g.postatRaw) return null;
    const parts = g.postatRaw.split('·').map(p => p.trim());
    const postedAt = parseShortDate(parts[0] ?? '');
    if (!postedAt) {
        throw new Error(`Rad ${g.listNumber} (${g.name}): kan inte tolka datum ur "${g.postatRaw}"`);
    }
    const method = parts[1] ?? '';
    const rest = parts.slice(2).join(' · ');

    const outcome: ParsedLog['outcome'] =
        /BORTTAGEN/i.test(rest) ? 'borttagen'
        : /KRÄVDE GODKÄNNANDE/i.test(rest) ? 'krävde-godkännande'
        : /GODKÄNT\/uppe/i.test(rest) ? 'godkänt-uppe'
        : /publicerat direkt/i.test(rest) ? 'publicerat-direkt'
        : 'okänt';

    // Engagemang: '**26 likes, 15 komm., 1 delning**' / '5 likes' / '6 likes, 2 komm.'
    const likes = rest.match(/(\d+)\s*likes/i)?.[1];
    const comments = rest.match(/(\d+)\s*komm/i)?.[1];
    const shares = rest.match(/(\d+)\s*delning/i)?.[1];

    return {
        listNumber: g.listNumber,
        name: g.name,
        postedAt,
        linkPlacement: /kommentar/i.test(method) ? 'i-första-kommentaren' : 'i-inlägget',
        starLinkIncluded: /stjärnlänk/i.test(method),
        variant: method.match(/variant\s+([A-Z])/i)?.[1]?.toUpperCase(),
        outcome,
        likes: likes ? parseInt(likes, 10) : undefined,
        comments: comments ? parseInt(comments, 10) : undefined,
        shares: shares ? parseInt(shares, 10) : undefined,
        noteTail: rest || undefined,
    };
}

/* ── 2. facebook-grupper.md → bodyText per grupp + Byske-engagemang ───────── */

// Rubriker i grupper.md ↔ ordagranna namn i masterlistan (de som skiljer sig).
const HEADING_ALIAS: Record<string, string> = {
    'Vad händer i Tierps kommun?': 'Vad händer i Tierp kommun',
    'Gränna (postat 2026-07-19 — länk-i-kommentar-test 2)': 'Vad händer i Gränna',
    'Halmstad - Vad händer i stan med omnejd': 'Halmstad - Vad händer i stan med omnejd',
    'Du vet vad som händer i Eskilstuna (→ /evenemang/eskilstuna)': 'Du vet vad som händer i Eskilstuna',
    'Vad händer i Nyköping med omnejd. (→ /evenemang/nykoping)': 'Vad händer i Nyköping med omnejd.',
    'Det händer i Helsingborg (→ /evenemang/helsingborg)': 'Det händer i Helsingborg',
    'Händer i Karlstad-Tipsa om vad som händer i stan! (→ /evenemang/karlstad)': 'Händer i Karlstad-Tipsa om vad som händer i stan!',
    'Vad som händer i Stockholm (→ /evenemang/stockholm)': 'Vad som händer i Stockholm',
    'Vad händer i Malmö? (→ /evenemang/malmo)': 'Vad händer i Malmö?',
    'Vad händer i Göteborg? (→ /evenemang/goteborg)': 'Vad händer i Göteborg?',
};

/** Blockquote-avsnitt per '## N. <namn>' / '### X. <namn>'-rubrik. */
function parseBodyTexts(): Map<string, string> {
    const out = new Map<string, string>();
    const lines = read('facebook-grupper.md').split('\n');
    let current: string | null = null;
    let buf: string[] = [];
    const flush = () => {
        if (current && buf.length) {
            const existing = out.get(current);
            const text = buf.join('\n').trim();
            // Första blockquotet vinner (senare = varianter/uppföljningar).
            if (!existing) out.set(current, text);
        }
        buf = [];
    };
    for (const line of lines) {
        const h = line.match(/^##+\s+(?:\d+[AB]?\.|[A-G]\.)\s+(.+)$/);
        if (h) { flush(); current = (HEADING_ALIAS[h[1].trim()] ?? h[1].trim()); continue; }
        if (/^##/.test(line)) { flush(); current = null; continue; }
        if (current && /^>\s?/.test(line)) buf.push(line.replace(/^>\s?/, ''));
        else if (current && buf.length && line.trim() === '') buf.push('');
    }
    flush();
    return out;
}

/* ── 3. arrangorer.md → arrangörskontakter + mejlloggar ───────────────────── */

interface ParsedOrg {
    orgName: string; eventCount: number; cities: string[]; domain: string;
    template: string; prio: 1 | 2 | 3; checked: boolean;
    exampleEvents: string[]; sentAt?: number; reply?: string; linkUrl?: string;
}

function parseArrangorer(): ParsedOrg[] {
    const out: ParsedOrg[] = [];
    let prio: 1 | 2 | 3 = 1;
    const lines = read('arrangorer.md').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const p = line.match(/^## Prio (\d)/);
        if (p) { prio = parseInt(p[1], 10) as 1 | 2 | 3; continue; }
        // - [x] **ABF** — 355 event · Västerås, Malmö · `abf.se` · mall A (mejl)
        const m = line.match(/^- \[([ x])\] \*\*(.+?)\*\* — (\d+) event · (.+?) · `(.+?)` · (.+)$/);
        if (!m) continue;
        const org: ParsedOrg = {
            checked: m[1] === 'x',
            orgName: m[2].trim(),
            eventCount: parseInt(m[3], 10),
            cities: m[4].trim() === '—' ? [] : m[4].split(',').map(s => s.trim()),
            domain: m[5].trim(),
            template: m[6].trim(),
            prio,
            exampleEvents: [],
        };
        // Följeraden: - t.ex. _X_ · _Y_ · skickat: 2026-07-17 · svar: ____ · länk: ____
        const next = lines[i + 1] ?? '';
        if (/^\s+- t\.ex\./.test(next)) {
            org.exampleEvents = [...next.matchAll(/_([^_]+)_/g)].map(x => x[1]).slice(0, 2);
            org.sentAt = next.includes('skickat:') ? parseIsoDate(next) : undefined;
            const reply = next.match(/svar:\s*([^·]+)/)?.[1]?.trim();
            if (reply && reply !== '____') org.reply = reply;
            const link = next.match(/länk:\s*(\S+)/)?.[1];
            if (link && link !== '____') org.linkUrl = link;
        }
        out.push(org);
    }
    return out;
}

/* ── 4. Bygg dokumenten ───────────────────────────────────────────────────── */

/** Doc-id per grupp. Slugify tappar skiljetecken så "Vad händer i Ängelholm?"
 *  och "Vad händer i Ängelholm" (rad 37/68 — OLIKA grupper!) kolliderar →
 *  kollisioner får radnummer-suffix på ALLA inblandade (deterministiskt). */
function groupIds(groups: ParsedGroup[]): Map<number, string> {
    const bySlug = new Map<string, number[]>();
    for (const g of groups) {
        const s = slugify(g.name);
        bySlug.set(s, [...(bySlug.get(s) ?? []), g.listNumber]);
    }
    const ids = new Map<number, string>();
    for (const [s, nums] of bySlug) {
        for (const n of nums) ids.set(n, nums.length > 1 ? `${s}-${n}` : s);
    }
    return ids;
}

function main() {
    const groups = parseGrupplista();
    const bodyTexts = parseBodyTexts();
    const orgs = parseArrangorer();
    const idOf = groupIds(groups);

    const logs = groups.map(parsePostat).filter((l): l is ParsedLog => l !== null);

    /* FACIT-ASSERTS (manuellt räknade 2026-07-26 — se admin-konsol-plan.md §4) */
    const assertEq = (label: string, got: number, want: number) => {
        const ok = got === want;
        console.log(`${ok ? '✅' : '❌'} ${label}: ${got} (facit ${want})`);
        if (!ok) throw new Error(`FACIT-AVVIKELSE: ${label} = ${got}, väntade ${want}. Ingenting skrivs.`);
    };
    assertEq('FB-grupper', groups.length, 83);
    assertEq('loggade postningar', logs.length, 20);
    assertEq('länk i inlägget', logs.filter(l => l.linkPlacement === 'i-inlägget').length, 13);
    assertEq('länk i kommentar', logs.filter(l => l.linkPlacement === 'i-första-kommentaren').length, 7);
    assertEq('med stjärnlänk', logs.filter(l => l.starLinkIncluded).length, 7);
    assertEq('borttagna', logs.filter(l => l.outcome === 'borttagen').length, 3);
    assertEq('publicerat direkt', logs.filter(l => l.outcome === 'publicerat-direkt').length, 8);
    assertEq('krävde godkännande', logs.filter(l => l.outcome === 'krävde-godkännande').length, 3);
    assertEq('godkänt/uppe', logs.filter(l => l.outcome === 'godkänt-uppe').length, 1);
    assertEq('okänt utfall (?)', logs.filter(l => l.outcome === 'okänt').length, 5);
    // Engagemang i grupplista (37/17/1) + Byske ur grupper.md (15/8/0) = 52/25/1.
    const BYSKE = { likes: 15, comments: 8 };
    const likes = logs.reduce((s, l) => s + (l.likes ?? 0), 0) + BYSKE.likes;
    const comments = logs.reduce((s, l) => s + (l.comments ?? 0), 0) + BYSKE.comments;
    const shares = logs.reduce((s, l) => s + (l.shares ?? 0), 0);
    assertEq('likes totalt (inkl Byske)', likes, 52);
    assertEq('kommentarer totalt (inkl Byske)', comments, 25);
    assertEq('delningar', shares, 1);
    assertEq('arrangörer', orgs.length, 120);
    assertEq('arrangörsmejl skickade', orgs.filter(o => o.sentAt).length, 10);
    assertEq('unika grupp-id:n', new Set(idOf.values()).size, 83);
    console.log(`ℹ️  bodyText hittad för ${[...bodyTexts.keys()].length} rubriker i grupper.md`);

    if (mode !== 'commit') {
        console.log(`\n[${mode}] Allt stämmer — kör med --commit för att skriva till Firestore (target: ${dbTarget.name}).`);
        return;
    }

    /* Skrivning */
    if (!db) throw new Error('Ingen DB-anslutning (service-account.json saknas?)');
    const now = Date.now();
    const batchWrites: Promise<unknown>[] = [];

    // Städa bort ev. kollisions-orphan från tidigare körning (rad 37/68 delade
    // id:t 'vad-hander-i-angelholm' innan suffix-fixen).
    for (const [slug, ] of [['vad-hander-i-angelholm']]) {
        if (![...idOf.values()].includes(slug)) {
            batchWrites.push(db.collection('outreachContacts').doc(slug).delete());
        }
    }

    for (const g of groups) {
        const id = idOf.get(g.listNumber)!;
        const log = logs.find(l => l.listNumber === g.listNumber);
        const status = !log ? 'orörd'
            : log.outcome === 'borttagen' ? 'borttagen'
            : log.outcome === 'krävde-godkännande' ? 'väntar-godkännande'
            : 'postad';
        batchWrites.push(db.collection('outreachContacts').doc(id).set({
            id, kind: 'fb-grupp',
            name: g.name,
            listNumber: g.listNumber,
            citySlug: g.citySlug,
            hasCityPage: g.hasCityPage,
            // Ort ur namnet är opålitligt — citySlug-städerna får stadens namn,
            // resten lämnas åt konsolen att fylla i (⚠-markeras i kön).
            ...(g.citySlug ? { city: g.citySlug.charAt(0).toUpperCase() + g.citySlug.slice(1) } : {}),
            postingMode: log
                ? (log.outcome === 'krävde-godkännande' ? 'approval'
                    : log.outcome === 'publicerat-direkt' || log.outcome === 'godkänt-uppe' ? 'direct' : 'unknown')
                : 'unknown',
            doNotPost: log?.outcome === 'borttagen',   // borttagen ⇒ avskriven tills ägaren säger annat
            ...(log?.outcome === 'borttagen' ? { moderationRisk: 'hög' } : {}),
            ...(log ? {
                lastPostedAt: log.postedAt,
                nextAllowedAt: log.postedAt + KARENS_DAGAR * DAY_MS,
                lastOutcome: log.outcome,
            } : {}),
            postCount: log ? 1 : 0,
            usedVariants: log?.variant ? [log.variant] : [],
            status,
            createdAt: now, updatedAt: now,
        }, { merge: true }));

        if (log) {
            const logId = `import-${g.listNumber}`;
            const bodyText = bodyTexts.get(g.name);
            batchWrites.push(db.collection('outreachLog').doc(logId).set({
                id: logId,
                contactId: id, contactName: g.name,
                channel: 'fb-grupp',
                draftCreatedAt: log.postedAt, postedAt: log.postedAt,
                confirmedByOwner: true,      // allt i md-loggen är ägar-bekräftat (loggregeln)
                status: log.outcome === 'krävde-godkännande' ? 'i-godkännandekö'
                    : log.outcome === 'okänt' ? 'postat'
                    : log.outcome === 'borttagen' ? 'borttagen'
                    : log.outcome === 'godkänt-uppe' ? 'godkänt-uppe' : 'postat',
                ...(bodyText ? { bodyText } : {}),
                ...(log.variant ? { variant: log.variant } : {}),
                linkPlacement: log.linkPlacement,
                linkUrl: g.hasCityPage ? `https://vadkul.se/evenemang/${g.citySlug}` : 'https://vadkul.se',
                starCode: log.starLinkIncluded ? 'STJARNA1' : null,
                starLinkIncluded: log.starLinkIncluded,
                outcome: log.outcome,
                // Kända utfall räknas som "kollade" vid postdatumet; '?' lämnas
                // öppet så TodayPanel genast flaggar dem för uppföljning.
                ...(log.outcome !== 'okänt' ? { outcomeCheckedAt: log.postedAt } : {}),
                ...(log.likes !== undefined ? { likes: log.likes } : {}),
                ...(log.comments !== undefined ? { comments: log.comments } : {}),
                ...(log.shares !== undefined ? { shares: log.shares } : {}),
                ...(log.likes !== undefined ? { engagementCheckedAt: log.postedAt + DAY_MS } : {}),
                ...(log.noteTail ? { notes: log.noteTail } : {}),
                nextAllowedAt: log.postedAt + KARENS_DAGAR * DAY_MS,
                importedFrom: `facebook-grupplista.md#rad${g.listNumber}`,
            }, { merge: true }));
        }
    }

    // Byske-engagemanget (15 likes/8 komm. före borttagningen) på rad 27-loggen.
    batchWrites.push(db.collection('outreachLog').doc('import-27').set({
        likes: 15, comments: 8, engagementCheckedAt: parseShortDate('18/7'),
        notes: '15 likes, 8 kommentarer — sen BORTTAGEN av moderator (facebook-grupper.md)',
    }, { merge: true }));

    for (const o of orgs) {
        const id = `org-${slugify(o.orgName)}`;
        batchWrites.push(db.collection('outreachContacts').doc(id).set({
            id, kind: 'arrangor',
            name: o.orgName, orgName: o.orgName,
            eventCount: o.eventCount,
            cities: o.cities,
            domain: o.domain,
            prio: o.prio,
            hasCityPage: false,
            postingMode: 'unknown',
            doNotPost: false,
            exampleEvents: o.exampleEvents.map(t => ({ title: t })),
            ...(o.reply ? { replyStatus: o.reply } : {}),
            ...(o.linkUrl ? { linkUrl: o.linkUrl } : {}),
            ...(o.sentAt ? {
                lastPostedAt: o.sentAt,
                followUpDueAt: o.sentAt + 8 * DAY_MS,
                status: 'postad', postCount: 1,
            } : { status: 'orörd', postCount: 0 }),
            usedVariants: [],
            createdAt: now, updatedAt: now,
        }, { merge: true }));

        if (o.sentAt) {
            const logId = `import-org-${slugify(o.orgName)}`;
            batchWrites.push(db.collection('outreachLog').doc(logId).set({
                id: logId, contactId: id, contactName: o.orgName,
                channel: 'email',
                draftCreatedAt: o.sentAt, postedAt: o.sentAt,
                confirmedByOwner: true, status: 'postat',
                variant: o.template,
                starCode: 'ARRANGOR1', starLinkIncluded: true,
                outcome: 'okänt',
                followUpAt: o.sentAt + 8 * DAY_MS,
                importedFrom: 'arrangorer.md',
            }, { merge: true }));
        }
    }

    // Medlemslistan — ett aggregat, ingen PII (csv:n är gitignorad och förblir så).
    batchWrites.push(db.collection('outreachContacts').doc('medlemslistan').set({
        id: 'medlemslistan', kind: 'medlemslista',
        name: 'Medlemsmejlet (137 mottagare)',
        memberCount: 137,
        hasCityPage: false, postingMode: 'unknown',
        doNotPost: true,    // blockerad tills Zoho Campaigns-vägen är uppsatt
        notes: 'Skickas ENDAST via Zoho Campaigns (aldrig Zoho Mail). Stjärnkod MEDLEM1. Se medlemsmejl.md.',
        postCount: 0, usedVariants: [], status: 'orörd',
        createdAt: now, updatedAt: now,
    }, { merge: true }));

    Promise.all(batchWrites).then(() => {
        console.log(`\n✅ Import klar: ${groups.length} grupper, ${orgs.length} arrangörer, ${logs.length + orgs.filter(o => o.sentAt).length} loggrader → ${dbTarget.name}`);
        console.log('Nästa steg: firebase deploy --only firestore:rules (regel 19–21), sedan arkivera md-filerna.');
        process.exit(0);
    }).catch(e => { console.error('❌ Skrivfel:', e); process.exit(1); });
}

main();
