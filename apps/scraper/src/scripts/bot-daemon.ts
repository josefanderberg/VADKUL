/**
 * VADKUL Telegram bot-daemon.
 *
 * Lyssnar persistent på Telegram för kommandon. Triggar publish-fb vid /nytt.
 *
 * När publish-fb redan körs (lock-fil finns): daemon pausar polling så
 * publish-fb's egen approval-flow får alla svar. Daemon väcker när lock släpps.
 *
 * Kommandon:
 *   /nytt        — Starta ett nytt FB-utkast nu (publish-fb, dagsresa 3 events)
 *   /list10      — Starta 10-event-listan (publish-digest); "klar" publicerar
 *                  karusell till Instagram + Facebook
 *   /stopp       — Avbryt aktiv publicering (skickar SIGTERM)
 *   /status      — Visa läget
 *   /milstolpe <text> — Spara en milstolpe ("1 000 medlemmar") till
 *                  dagsinläggets söndagsbudskap (utils/dagsinlagg)
 *   En videofil (mp4/mov) med temat som bildtext — sparas i dagsinläggets
 *   inkorg (utils/dagsinlagg/inkorg.ts), granskas nästa morgon 07:00.
 *
 * Körs som launchd-jobb (persistent).
 */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { sendMessage, waitForMessage, flushPendingUpdates, isTelegramConfigured, type InkommandeMedia } from '../utils/telegram';
import { sparaInkommetKlipp } from '../utils/dagsinlagg/inkorg';
import { laddaLogg, sparaLogg } from '../utils/dagsinlagg/logg';
import { stockholmDatum } from '../utils/dagsinlagg/tid';

// Ladda hemligheter
const secretFile = path.join(process.env.HOME || '~', '.vadkul-secrets/env');
if (fs.existsSync(secretFile)) {
    const raw = fs.readFileSync(secretFile, 'utf-8');
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/);
        if (m) process.env[m[1]] = m[2];
    }
}

const LOCK_FILE        = '/tmp/vadkul-publish-fb.lock';
const DIGEST_LOCK_FILE = '/tmp/vadkul-publish-digest.lock';
/** Dagsinlägget (scripts/dagsinlagg.ts --kör) äger pollen 07:00-09:00. */
const DAGSINLAGG_LOCK_FILE = '/tmp/vadkul-dagsinlagg.lock';
const SCRAPER_DIR = path.resolve(__dirname, '../..');

function readLock(file: string): { running: boolean; pid?: number } {
    if (!fs.existsSync(file)) return { running: false };
    try {
        const pid = parseInt(fs.readFileSync(file, 'utf8'), 10);
        process.kill(pid, 0); // throws om PID ej lever
        return { running: true, pid };
    } catch {
        try { fs.unlinkSync(file); } catch { /* ignore */ }
        return { running: false };
    }
}

function isPublishFbRunning(): { running: boolean; pid?: number } {
    return readLock(LOCK_FILE);
}

function isDigestRunning(): { running: boolean; pid?: number } {
    return readLock(DIGEST_LOCK_FILE);
}

function isDagsinlaggRunning(): { running: boolean; pid?: number } {
    return readLock(DAGSINLAGG_LOCK_FILE);
}

type Aktiv = 'fb' | 'digest' | 'dagsinlagg';
const AKTIV_NAMN: Record<Aktiv, string> = { fb: 'FB-publicering', digest: '10-listan', dagsinlagg: 'dagsinlägget' };

function anyPublishRunning(): { running: boolean; which?: Aktiv; pid?: number } {
    const fb = isPublishFbRunning();
    if (fb.running) return { running: true, which: 'fb', pid: fb.pid };
    const dg = isDigestRunning();
    if (dg.running) return { running: true, which: 'digest', pid: dg.pid };
    const di = isDagsinlaggRunning();
    if (di.running) return { running: true, which: 'dagsinlagg', pid: di.pid };
    return { running: false };
}

/** Ett klipp till dagsinläggets inkorg. */
async function handleMedia(media: InkommandeMedia): Promise<void> {
    try {
        const k = await sparaInkommetKlipp(media);
        const stad = k.stad ? ` ${k.stad}` : '';
        await sendMessage(`🎬 Klipp mottaget: <code>${k.fil}</code> (tema: ${k.tema}${stad}). Granskas nästa morgon 07:00.`);
    } catch (e) {
        await sendMessage(`⚠️ Kunde inte spara klippet: ${(e as Error).message}`);
    }
}

/** /milstolpe <text> -> dagsinlagg-logg.json (söndagsbudskapet). */
async function handleMilstolpe(text: string): Promise<void> {
    const t = text.trim();
    if (!t) { await sendMessage('Skriv vad milstolpen är: <code>/milstolpe 1 000 medlemmar</code>'); return; }
    const logg = laddaLogg();
    logg.milstolpar.push({ text: t, datum: stockholmDatum(Date.now()) });
    sparaLogg(logg);
    await sendMessage(`🏁 Milstolpe sparad: "${t}". Går ut i nästa söndagsbudskap.`);
}

function spawnNpm(scriptName: string, logFileName: string, extraArgs: string[] = []): void {
    const args = ['run', scriptName, ...(extraArgs.length ? ['--', ...extraArgs] : [])];
    const logDir = path.join(process.env.HOME || '~', 'Library/Logs/vadkul-scraper');
    try { fs.mkdirSync(logDir, { recursive: true }); } catch { /* ignore */ }
    const logPath = path.join(logDir, logFileName);
    const out = fs.openSync(logPath, 'a');
    fs.writeSync(out, `\n\n=== spawned ${new Date().toISOString()} ===\n`);
    const child = spawn('npm', args, {
        cwd: SCRAPER_DIR,
        detached: true,
        stdio: ['ignore', out, out],
        env: process.env,
    });
    child.unref();
    console.log(`[Bot] Spawnade ${scriptName} (PID ${child.pid}) → ${logPath}`);
}

function spawnPublishFb(force: boolean = true): void {
    spawnNpm('publish-fb', 'publish-fb-spawned.log', force ? ['--force'] : []);
}

function spawnPublishDigest(): void {
    spawnNpm('digest', 'publish-digest-spawned.log');
}

async function handleCommand(msg: string): Promise<void> {
    // Stripa ledande slash + lowercase
    const cmd = msg.toLowerCase().trim().replace(/^\//, '');
    console.log(`[Bot] Inkommande: "${cmd}"`);

    if (cmd === 'nytt' || cmd === 'publicera' || cmd === 'kör') {
        const active = anyPublishRunning();
        if (active.running) {
            const label = AKTIV_NAMN[active.which!];
            await sendMessage(
                `⏳ ${label} pågår redan (PID ${active.pid}).\n` +
                `Använd kommandona i pågående konversation, eller skicka <code>/stopp</code> först.`
            );
            return;
        }
        await sendMessage('🚀 Startar nytt FB-utkast — kommer om ~30 sek…');
        spawnPublishFb(true);
        return;
    }

    if (cmd === 'list10' || cmd === 'topp10' || cmd === 'digest') {
        const active = anyPublishRunning();
        if (active.running) {
            const label = AKTIV_NAMN[active.which!];
            await sendMessage(
                `⏳ ${label} pågår redan (PID ${active.pid}).\n` +
                `Skicka <code>/stopp</code> först om du vill byta.`
            );
            return;
        }
        await sendMessage('📋 Bygger 10-event-listan…');
        spawnPublishDigest();
        return;
    }

    if (cmd === 'stopp' || cmd === 'avbryt' || cmd === 'stop' || cmd === 'cancel') {
        const active = anyPublishRunning();
        if (!active.running) {
            await sendMessage('🤷 Inget pågår just nu.');
            return;
        }
        try {
            process.kill(active.pid!, 'SIGTERM');
            const label = AKTIV_NAMN[active.which!];
            await sendMessage(`🛑 Stoppade ${label} (PID ${active.pid}).`);
        } catch (e) {
            await sendMessage(`⚠️ Kunde inte stoppa: ${(e as Error).message}`);
        }
        return;
    }

    if (cmd.startsWith('milstolpe')) {
        await handleMilstolpe(msg.trim().replace(/^\/?milstolpe/i, ''));
        return;
    }

    if (cmd === 'status' || cmd === 'help' || cmd === '/?') {
        const active = anyPublishRunning();
        if (active.running) {
            if (active.which === 'dagsinlagg') {
                await sendMessage(
                    `⏳ Dagsinlägget väntar på klartecken (PID ${active.pid}).\n\n` +
                    `Svara: <code>ja</code> · <code>nej</code> · <code>byt</code> · <code>text: ...</code> · <code>stopp</code>`
                );
            } else if (active.which === 'digest') {
                await sendMessage(
                    `⏳ 10-listan pågår (PID ${active.pid}).\n\n` +
                    `Svara: <code>byt 5</code> · <code>byt 3,7,10</code> · <code>bild 5 &lt;URL&gt;</code> · <code>nytt</code> · <code>klar</code> · <code>stopp</code>`
                );
            } else {
                await sendMessage(
                    `⏳ FB-publicering pågår (PID ${active.pid}).\n\n` +
                    `Svara: <code>klar</code> · <code>text</code> · <code>nytt</code> · <code>nytt1</code>/<code>2</code>/<code>3</code> · <code>stopp</code>`
                );
            }
        } else {
            await sendMessage(
                `✅ Standby.\n\n` +
                `<code>/nytt</code>    — starta FB-utkast (dagsresa, 3 events)\n` +
                `<code>/list10</code>  — 10-event-listan → "klar" postar IG-karusell + FB\n` +
                `<code>/stopp</code>   — avbryt aktiv\n` +
                `<code>/status</code>  — visa läget\n` +
                `<code>/milstolpe &lt;text&gt;</code> — spara en milstolpe till söndagsbudskapet\n` +
                `En videofil med temat som bildtext — klipp till dagsinläggets inkorg`
            );
        }
        return;
    }

    // Ej känt kommando — ignorera tyst (kan vara svar inom approval-flow)
}

async function main() {
    if (!isTelegramConfigured()) {
        console.error('❌ TG_BOT_TOKEN / TG_CHAT_ID saknas');
        process.exit(1);
    }
    console.log('[Bot] Daemon startad. Lyssnar på Telegram…');
    await flushPendingUpdates();

    // Hälsning vid start (en gång)
    await sendMessage(
        '🤖 <b>VADKUL-bot online</b>\n' +
        '<code>/nytt</code> FB-utkast · <code>/list10</code> 10-listan · <code>/stopp</code> avbryt · <code>/status</code>'
    );

    while (true) {
        const { running } = anyPublishRunning();
        if (running) {
            // publish-fb äger pollen — vänta tills lock släpps innan vi tar över
            await new Promise(r => setTimeout(r, 5000));
            continue;
        }

        try {
            // Long-poll 30s — vi vaknar antingen vid meddelande eller timeout
            const m = await waitForMessage(30_000);
            if (m?.media) {
                await handleMedia(m.media);
            } else if (m?.text) {
                await handleCommand(m.text);
            }
        } catch (e) {
            console.error('[Bot] Poll-fel:', (e as Error).message);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

main().catch(e => {
    console.error('[Bot] Fatal:', e);
    process.exit(1);
});
