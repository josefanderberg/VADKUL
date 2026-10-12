/**
 * ortsrapport.ts - underlaget till en kommun som PDF (docs/outreach/kommunstrategi.md).
 *
 * Läser SQLite-spegeln (aldrig Firestore), räknar orten och grannorterna och
 * skriver docs/outreach/underlag/<ort>-<datum>.html + .pdf. PDF:en ritas av
 * Chrome i huvudlöst läge; saknas Chrome blir det bara HTML (skriv ut den).
 * Kör helst på minin, där spegeln är färsk efter nattkedjan.
 *
 * Användning:
 *   npm run ortsrapport -- Eskilstuna
 *   npm run ortsrapport -- Eskilstuna --kalender=visiteskilstuna.se \
 *       --till="Kultur- och fritidsförvaltningen, Eskilstuna kommun"
 *
 * Logiken (och dokumentets text) bor i utils/ortsrapport.ts.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import Database from 'better-sqlite3';
import { CITIES } from './city-gaps';
import { cityPoints, lookupCityPoint } from '../utils/cityLookup';
import { dokumentHtml, grannar, Ort, raknaOrt, RapportEvent } from '../utils/ortsrapport';

const REPO = path.resolve(__dirname, '../../../..');
const UT = path.join(REPO, 'docs/outreach/underlag');
const LOGGA = path.join(REPO, 'apps/web/public/pwa-icon-bla-192-rund.png');
const CHROME = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome', 'chromium',
];

function args() {
    const val: Record<string, string> = {};
    const fria: string[] = [];
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.*)$/);
        if (m) val[m[1]] = m[2];
        else fria.push(a);
    }
    return { ort: fria.join(' '), ...val };
}

function slugga(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ritaPdf(html: string, pdf: string): boolean {
    // Egen profil: med en vanlig Chrome öppen är standardprofilen låst och utskriften uteblir.
    const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'ortsrapport-'));
    try {
        fs.rmSync(pdf, { force: true });
        for (const c of CHROME) {
            const r = spawnSync(c, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profil}`,
                `--print-to-pdf=${pdf}`, `file://${html}`], { stdio: 'ignore', timeout: 90_000 });
            if (r.status === 0 && fs.existsSync(pdf)) return true;
        }
        return false;
    } finally {
        fs.rmSync(profil, { recursive: true, force: true });
    }
}

function main() {
    const a = args() as { ort: string; kalender?: string; till?: string; dagar?: string };
    if (!a.ort) {
        console.error('Ange orten: npm run ortsrapport -- Eskilstuna [--kalender=domän] [--till="Mottagare"]');
        process.exit(1);
    }
    const punkt = lookupCityPoint(a.ort);
    if (!punkt) {
        console.error(`Hittar inte orten "${a.ort}" i webbens cityPoints.`);
        process.exit(1);
    }
    const pop = CITIES.find((c) => c.name.toLowerCase() === punkt.name.toLowerCase())?.pop;
    const ort: Ort = { ...punkt, pop };
    const orter = cityPoints();
    const kandidater: Ort[] = CITIES.filter((c) => !c.metro).map((c) => ({ name: c.name, lat: c.lat, lng: c.lng, pop: c.pop }));

    const fran = new Date();
    fran.setHours(0, 0, 0, 0);
    const val = { fran, dagar: a.dagar ? parseInt(a.dagar, 10) : 30, kalenderDoman: a.kalender };

    const db = new Database(process.env.SCRAPER_SQLITE_PATH || path.resolve(__dirname, '../../events.db'), { readonly: true });
    const events = db.prepare(`
        SELECT url, title, time, lat, lng, hostName, category, locationName, extractedAddress FROM link_events
        WHERE hidden = 0 AND lat IS NOT NULL AND lng IS NOT NULL AND time >= ? AND time < ?
    `).all(fran.toISOString(), new Date(fran.getTime() + (val.dagar + 1) * 86_400_000).toISOString()) as RapportEvent[];
    const senast = (db.prepare('SELECT MAX(updatedAt) AS t FROM link_events').get() as { t: string | null }).t;
    db.close();

    const statistik = raknaOrt(events, ort, orter, val);
    const html = dokumentHtml({
        statistik,
        grannar: grannar(events, ort, kandidater, orter, val),
        mottagare: a.till || `${ort.name} kommun`,
        datum: new Date(),
        logga: `data:image/png;base64,${fs.readFileSync(LOGGA).toString('base64')}`,
    });

    fs.mkdirSync(UT, { recursive: true });
    const idag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const bas = path.join(UT, `${slugga(ort.name)}-${idag}`);
    fs.writeFileSync(`${bas}.html`, html);
    const pdf = ritaPdf(`${bas}.html`, `${bas}.pdf`);

    console.log(`${ort.name}: ${statistik.antal} evenemang, ${statistik.arrangorer} arrangörer` +
        (statistik.per10k !== undefined ? `, ${statistik.per10k} per 10 000 invånare` : '') +
        (statistik.kalender ? `, ${statistik.kalender.antal} från ${statistik.kalender.doman}` : ''));
    console.log(`Spegeln senast uppdaterad: ${senast ?? 'okänt'}`);
    console.log(`HTML: ${bas}.html`);
    console.log(pdf ? `PDF:  ${bas}.pdf` : 'Ingen PDF (Chrome saknas) - öppna HTML:en och skriv ut som PDF.');
}

if (require.main === module) main();
