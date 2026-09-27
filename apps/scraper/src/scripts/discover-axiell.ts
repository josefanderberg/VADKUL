/**
 * Axiell-tenant-discovery: sveper kommunerna som saknar bibliotekstenant och
 * sniffar customerId ur browserns api.axiell.com-anrop (config-endpointen är
 * 403 sedan sommaren — samma metod som rundan 2/7, nu som repo-skript i
 * stället för engångs-scratchpad). Ren logik + tester i utils/axiellDiscovery.
 *
 *   npm run discover-axiell                       # alla otäckta kommuner
 *   npm run discover-axiell -- --kommun eskilstuna,strangnas,trosa
 *
 * Utskriften slutar med klistringsklara AXIELL_TENANTS-rader (nya customerId)
 * och en miss-lista. Konsortie-dubbletter (samma customerId som en befintlig
 * tenant) rapporteras som "redan täckt via <id>" — lägg ALDRIG in dem igen.
 *
 * Skriptet SKRIVER ingenting — raderna granskas och klistras in för hand i
 * scrapers/bibliotek.ts (cityHint/cities är ett manuellt beslut, se typen).
 * I molncontainern: PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
 * (Playwrights förinstallerade Chromium) om puppeteers egen saknas.
 */

import puppeteer, { Browser } from 'puppeteer';
import { KOMMUNER, Kommun } from '../sources/data/kommuner';
import { AXIELL_TENANTS } from '../scrapers/bibliotek';
import {
    candidateUrls, customerIdFromUrl, formatTenantRow, isKnownCustomerId, uncoveredKommuner,
} from '../utils/axiellDiscovery';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SNIFF_TIMEOUT_MS = 20_000;

type Fynd =
    | { kommun: Kommun; status: 'ny'; customerId: string; eventsUrl: string; upcoming: number }
    | { kommun: Kommun; status: 'dubblett'; customerId: string; via: string }
    | { kommun: Kommun; status: 'miss'; reason: string };

/** Finns kalendersidan alls? Billig HEAD/GET innan browsern dras igång. */
async function pageExists(url: string): Promise<boolean> {
    try {
        const res = await fetch(url, {
            method: 'GET', redirect: 'follow', headers: { 'user-agent': UA },
            signal: AbortSignal.timeout(10_000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/** Ladda kalendersidan headless och fånga första api.axiell.com-anropet. */
async function sniffCustomerId(browser: Browser, url: string): Promise<string | null> {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    try {
        const found = new Promise<string | null>(resolve => {
            page.on('request', req => {
                const id = customerIdFromUrl(req.url());
                if (id) resolve(id);
            });
            setTimeout(() => resolve(null), SNIFF_TIMEOUT_MS);
        });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SNIFF_TIMEOUT_MS }).catch(() => null);
        return await found;
    } finally {
        await page.close().catch(() => undefined);
    }
}

/** Verifiera tenant-id:t mot API:t och räkna kommande event. */
async function verifyTenant(customerId: string): Promise<number | null> {
    const url = `https://api.axiell.com/event/api/customers/${customerId}/search`
        + `?queryString=*&start=0&size=1`
        + `&rangeFilters=${encodeURIComponent(JSON.stringify([{ field: 'event.endDate', gte: new Date().toISOString() }]))}`
        + `&termFilters=${encodeURIComponent(JSON.stringify([{ field: 'event.status', values: ['PUBLISHED'] }]))}`;
    try {
        const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return null;
        const body = await res.json() as { totalHits?: number; total?: number; hits?: unknown[] };
        return body.totalHits ?? body.total ?? (Array.isArray(body.hits) ? body.hits.length : 0);
    } catch {
        return null;
    }
}

async function probeKommun(browser: Browser, kommun: Kommun): Promise<Fynd> {
    for (const url of candidateUrls(kommun)) {
        if (!(await pageExists(url))) continue;
        const customerId = await sniffCustomerId(browser, url);
        if (!customerId) return { kommun, status: 'miss', reason: `${url} finns men inget api.axiell.com-anrop (ej Arena Nova?)` };
        if (isKnownCustomerId(customerId, AXIELL_TENANTS)) {
            const via = AXIELL_TENANTS.find(t => t.customerId === customerId)!.id;
            return { kommun, status: 'dubblett', customerId, via };
        }
        const upcoming = await verifyTenant(customerId);
        if (upcoming === null) return { kommun, status: 'miss', reason: `${customerId} sniffat men API-verifieringen svarade inte` };
        return { kommun, status: 'ny', customerId, eventsUrl: url, upcoming };
    }
    return { kommun, status: 'miss', reason: 'ingen bibliotekshost på något av mönstren' };
}

async function main() {
    const arg = process.argv.find(a => a.startsWith('--kommun'));
    const wanted = arg ? (arg.split('=')[1] ?? process.argv[process.argv.indexOf(arg) + 1] ?? '')
        .toLowerCase().split(',').filter(Boolean) : null;

    let work = uncoveredKommuner(KOMMUNER, AXIELL_TENANTS);
    if (wanted) work = KOMMUNER.filter(k => wanted.includes(k.domain.replace(/\.se$/, '')));
    console.log(`Probar ${work.length} kommuner (${AXIELL_TENANTS.length} tenants redan i listan)…\n`);

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox'],
    });
    const fynd: Fynd[] = [];
    try {
        for (const kommun of work) {
            const f = await probeKommun(browser, kommun);
            fynd.push(f);
            const label = f.status === 'ny' ? `NY  ${f.customerId} (${f.upcoming} kommande)`
                : f.status === 'dubblett' ? `dubblett av '${f.via}'`
                : `miss: ${f.reason}`;
            console.log(`  ${kommun.name.padEnd(16)} ${label}`);
        }
    } finally {
        await browser.close().catch(() => undefined);
    }

    const nya = fynd.filter((f): f is Extract<Fynd, { status: 'ny' }> => f.status === 'ny');
    console.log(`\n═══ ${nya.length} nya tenants — klistra in i AXIELL_TENANTS (granska cityHint!) ═══`);
    for (const f of nya.sort((a, b) => b.upcoming - a.upcoming)) {
        console.log(formatTenantRow(f));
    }
    const missar = fynd.filter(f => f.status === 'miss').length;
    const dubbletter = fynd.filter(f => f.status === 'dubblett').length;
    console.log(`\n${nya.length} nya · ${dubbletter} dubbletter (redan täckta konsortier) · ${missar} missar`);
}

main().catch(e => { console.error(e); process.exit(1); });
