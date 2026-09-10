#!/usr/bin/env node
/**
 * fb-key-probe.js — hitta en fungerande sidtoken bland de nycklar CI faktiskt
 * har, och exportera FB_PAGE_ID/FB_PAGE_TOKEN till efterföljande steg.
 *
 * VARFÖR: ägaren har FB-nycklar på GitHub men inte nödvändigtvis under just
 * namnen FB_PAGE_ID/FB_PAGE_TOKEN (10/9: bara FB_SCRAPE_TOKEN + WEB_ENV
 * fanns). I stället för att kräva exakta namn provar vi kandidaterna mot
 * Graph API:
 *   - /me?fields=id,name,category — har svaret category är det en SIDTOKEN:
 *     klart (id = sidans id, inget separat FB_PAGE_ID behövs).
 *   - annars (användartoken): /me/accounts listar sidorna kontot förvaltar,
 *     MED egna sidtokens — vi tar VADKUL-sidan (eller enda sidan).
 *
 * Kandidater, i ordning: FB_PAGE_TOKEN, FB_PAGE_ACCESS_TOKEN (webbens namn),
 * FB_SCRAPE_TOKEN, plus alla *FB*TOKEN*-nycklar i apps/web/.env (WEB_ENV).
 *
 * Skriver till $GITHUB_ENV (maskar först token med ::add-mask::). Tokens
 * loggas ALDRIG — bara kandidatnamn och sidans namn/id (publika uppgifter).
 *
 * Flaggor: --require = faila (exit 1) om ingen användbar token hittas.
 * Utanför Actions (ingen $GITHUB_ENV) skrivs bara diagnosen.
 */
const fs = require('fs');
const path = require('path');

const REQUIRE = process.argv.includes('--require');
const GRAPH = 'https://graph.facebook.com/v19.0';

// Kandidater: process.env + apps/web/.env (WEB_ENV-secreten i CI).
const pool = { ...process.env };
const envFile = path.resolve(__dirname, '../../web/.env');
try {
    for (const l of fs.readFileSync(envFile, 'utf8').split('\n')) {
        const m = l.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/);
        if (m && !pool[m[1]]) pool[m[1]] = m[2];
    }
} catch { /* ingen .env — kör på process.env */ }

const ordered = ['FB_PAGE_TOKEN', 'FB_PAGE_ACCESS_TOKEN', 'FB_SCRAPE_TOKEN'];
const extra = Object.keys(pool).filter(k => /FB/.test(k) && /TOKEN/.test(k) && !ordered.includes(k));
const candidates = [...ordered, ...extra].filter(k => (pool[k] ?? '').trim().length > 0);

async function graph(pathAndQuery, token) {
    const sep = pathAndQuery.includes('?') ? '&' : '?';
    const res = await fetch(`${GRAPH}/${pathAndQuery}${sep}access_token=${encodeURIComponent(token)}`);
    const body = await res.json().catch(() => ({}));
    return res.ok ? body : { __error: body?.error?.message ?? `HTTP ${res.status}` };
}

function exportKeys(pageId, pageToken, via) {
    console.log(`✅ Sidtoken funnen via ${via} — sida ${pageId}.`);
    const ghEnv = process.env.GITHUB_ENV;
    if (!ghEnv) { console.log('(ingen $GITHUB_ENV — bara diagnos)'); return; }
    console.log(`::add-mask::${pageToken}`);
    fs.appendFileSync(ghEnv, `FB_PAGE_ID=${pageId}\nFB_PAGE_TOKEN=${pageToken}\n`);
}

async function main() {
    if (candidates.length === 0) {
        console.error('❌ Inga token-kandidater alls i CI (FB_PAGE_TOKEN/FB_PAGE_ACCESS_TOKEN/FB_SCRAPE_TOKEN eller *FB*TOKEN* i WEB_ENV).');
        process.exit(REQUIRE ? 1 : 0);
    }
    console.log(`Kandidater som finns: ${candidates.join(', ')}`);

    for (const name of candidates) {
        const tok = pool[name].trim();
        const me = await graph('me?fields=id,name,category', tok);
        if (me.__error) { console.log(`  ${name}: ogiltig (${me.__error})`); continue; }

        if (me.category) {
            console.log(`  ${name}: SIDTOKEN för "${me.name}" (id ${me.id}, kategori ${me.category})`);
            return exportKeys(me.id, tok, name);
        }

        console.log(`  ${name}: användar-/apptoken ("${me.name}") — kollar /me/accounts …`);
        const acc = await graph('me/accounts?fields=id,name,access_token', tok);
        const pages = Array.isArray(acc.data) ? acc.data.filter(p => p.access_token) : [];
        if (acc.__error || pages.length === 0) {
            console.log(`    inga förvaltade sidor via ${name}${acc.__error ? ` (${acc.__error})` : ''}`);
            continue;
        }
        const pick = pages.find(p => /vadkul/i.test(p.name ?? '')) ?? (pages.length === 1 ? pages[0] : null);
        if (!pick) {
            console.log(`    ${pages.length} sidor men ingen heter VADKUL: ${pages.map(p => p.name).join(', ')}`);
            continue;
        }
        console.log(`    sidan "${pick.name}" (id ${pick.id}) har egen sidtoken via kontot`);
        return exportKeys(pick.id, pick.access_token, `${name} → /me/accounts`);
    }

    console.error('❌ Ingen kandidat gav en användbar sidtoken. Lägg till GitHub-secreten FB_PAGE_TOKEN (Page Access Token med pages_manage_posts + pages_read_engagement för VADKUL-sidan).');
    process.exit(REQUIRE ? 1 : 0);
}

main().catch(e => { console.error('Probe-fel:', e?.message ?? e); process.exit(REQUIRE ? 1 : 0); });
