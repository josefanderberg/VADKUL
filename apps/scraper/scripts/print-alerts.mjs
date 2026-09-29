#!/usr/bin/env node
/**
 * Skriver ut scraper-alerts.json (nattkedjans samlade skrapproblem) i
 * terminalen. Körs före rotens `npm run dev` (predev) och av `npm run alerts`
 * i roten (--all = hela listan). Beroendefri, kastar aldrig — ett trasigt eller
 * saknat larmfil får inte stoppa dev-servern.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scraper-alerts.json');
const all = process.argv.includes('--all');
const MAX = 8;

const c = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s), yellow = (s) => c('33', s), dim = (s) => c('2', s), bold = (s) => c('1', s);

try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const { counts, alerts = [], generatedAt } = data;
    const ageH = Math.round((Date.now() - new Date(generatedAt).getTime()) / 3.6e6);
    const age = ageH < 1 ? 'nyss' : ageH < 48 ? `${ageH} h sedan` : `${Math.round(ageH / 24)} dagar sedan`;
    const stale = ageH > 36 ? red(' — GAMMAL: har nattkedjan slutat pusha? (git pull?)') : '';

    if (alerts.length === 0) {
        console.log(`\n🩺 Skrapare: inga kända problem ${dim(`(kollat ${age})`)}${stale}\n`);
    } else {
        const head = counts.fel > 0 ? red(bold(`${counts.fel} fel`)) + ', ' : '';
        console.log(`\n🩺 ${bold('Skrapare')}: ${head}${yellow(`${counts.varning} varningar`)}, ${counts.nollkoordinatTotalt} event på 0,0 ${dim(`(kollat ${age})`)}${stale}`);
        const shown = all ? alerts : alerts.slice(0, MAX);
        for (const a of shown) {
            const tag = a.level === 'fel' ? red('✗') : yellow('!');
            console.log(`   ${tag} ${bold(a.source)} ${dim(`[${a.kind}]`)} ${a.message}`);
        }
        if (!all && alerts.length > MAX) console.log(dim(`   … ${alerts.length - MAX} till — \`npm run alerts\` visar alla`));
        console.log('');
    }
} catch {
    // Ingen fil än (första natten) eller trasig — tyst, dev-servern ska starta ändå.
}
