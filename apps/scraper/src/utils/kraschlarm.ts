/**
 * Kraschlarm för launchd-skript: importeras FÖRST i skriptet (före alla andra
 * imports) och larmar i Telegram om processen dör på ett okontrollerat fel.
 *
 * Varför: dagsinlägget dog tyst varje morgon 3-18/11 2026. better-sqlite3 var
 * byggd för node 24 men jobbet körde Homebrews node 26, så det föll redan när
 * modulerna laddades (#259). Skriptets egen main().catch hann aldrig registreras,
 * så varken förhandsvisning, inlägg eller felmeddelande nådde Telegram. Det här
 * fångar just den klassen av fel: allt som inte fångas någon annanstans.
 *
 * Läser TG_BOT_TOKEN/TG_CHAT_ID ur miljön eller ~/.vadkul-secrets/env (själv,
 * utan andra moduler, så att larmet fungerar även när resten inte går att ladda).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

/** Texten i Telegram-larmet. Ren funktion (testad). */
export function kraschText(jobb: string, fel: unknown): string {
    const e = fel as { message?: unknown; code?: unknown } | null | undefined;
    const meddelande = String(e?.message ?? fel ?? 'okänt fel').split('\n').filter(Boolean).slice(0, 3).join(' ');
    const kod = typeof e?.code === 'string' ? ` (${e.code})` : '';
    const kort = meddelande.length > 350 ? `${meddelande.slice(0, 349)}…` : meddelande;
    return `❌ ${jobb} kraschade innan det hann göra något${kod}:\n${kort}\n\nLoggen på minin: ~/Library/Logs/vadkul-scraper/`;
}

/** Jobbnamnet ur skriptets filnamn: ".../dagsinlagg.ts" -> "dagsinlagg". */
export function jobbNamn(argv: string[]): string {
    const skript = argv.find(a => /\.(ts|js)$/.test(a) && !a.includes('node_modules')) ?? argv[1] ?? 'skript';
    return path.basename(skript).replace(/\.(ts|js)$/, '');
}

function telegramNycklar(): { token: string; chat: string } {
    let token = process.env.TG_BOT_TOKEN ?? '';
    let chat = process.env.TG_CHAT_ID ?? '';
    if (!token || !chat) {
        try {
            const fil = path.join(process.env.HOME || os.homedir(), '.vadkul-secrets', 'env');
            for (const rad of fs.readFileSync(fil, 'utf-8').split('\n')) {
                const m = rad.match(/^(TG_BOT_TOKEN|TG_CHAT_ID)="?([^"]*)"?\s*$/);
                if (m?.[1] === 'TG_BOT_TOKEN' && !token) token = m[2];
                if (m?.[1] === 'TG_CHAT_ID' && !chat) chat = m[2];
            }
        } catch { /* ingen hemlighetsfil: inget larm, men processen avslutas ändå med kod 1 */ }
    }
    return { token, chat };
}

async function larma(text: string): Promise<void> {
    const { token, chat } = telegramNycklar();
    if (!token || !chat) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
            signal: AbortSignal.timeout(15_000),
        });
    } catch { /* nätet nere: felet står ändå i loggen */ }
}

let larmat = false;
if (!process.env.VITEST) {
    process.on('uncaughtException', (fel) => {
        console.error(fel);
        if (larmat) process.exit(1);
        larmat = true;
        const text = kraschText(jobbNamn(process.argv), fel);
        console.error(`[kraschlarm] ${text.split('\n')[0]}`);
        void larma(text).finally(() => process.exit(1));
    });
}
