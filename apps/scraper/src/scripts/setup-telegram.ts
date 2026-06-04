/**
 * Telegram-setup-hjälp.
 *
 * Hjälper dig:
 *   1. Verifiera att din TG_BOT_TOKEN funkar
 *   2. Lyssna efter ditt första meddelande till boten → få chat-id
 *
 * Använd:
 *   1. På Telegram: skicka /newbot till @BotFather → spara token
 *   2. Lägg in i ~/.vadkul-secrets/env:
 *        TG_BOT_TOKEN=123456789:ABC-xyz...
 *   3. Kör: npm run setup-telegram
 *   4. När prompten väntar — skicka "hej" till din nya bot
 *   5. Skriptet visar ditt chat-id. Lägg in i samma env-fil:
 *        TG_CHAT_ID=12345678
 */

import path from 'path';
import fs from 'fs';

// Ladda hemligheter (samma mönster som publish-fb.ts)
const secretFile = path.join(process.env.HOME || '~', '.vadkul-secrets/env');
if (fs.existsSync(secretFile)) {
    const raw = fs.readFileSync(secretFile, 'utf-8');
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/);
        if (m) process.env[m[1]] = m[2];
    }
}

const TOKEN = process.env.TG_BOT_TOKEN || '';

async function main() {
    if (!TOKEN) {
        console.error('❌ TG_BOT_TOKEN saknas i ~/.vadkul-secrets/env');
        console.error('');
        console.error('Steg 1: På Telegram, sök @BotFather → /newbot → följ instruktionerna');
        console.error('Steg 2: Spara token i ~/.vadkul-secrets/env:');
        console.error('         TG_BOT_TOKEN=123456789:ABC-xyz...');
        console.error('Steg 3: Kör detta skript igen');
        process.exit(1);
    }

    console.log('🤖 Verifierar bot-token…');
    const meR = await fetch(`https://api.telegram.org/bot${TOKEN}/getMe`);
    const me: any = await meR.json();
    if (!me.ok) {
        console.error('❌ Token ogiltig:', me.description);
        process.exit(1);
    }
    console.log(`✅ Bot OK — @${me.result.username} (${me.result.first_name})`);
    console.log('');
    console.log('👉 GÅ NU TILL TELEGRAM och skicka ett meddelande (typ "hej") till @' + me.result.username);
    console.log('   Väntar på ditt meddelande…');
    console.log('');

    // Hämta tidigare updates och ignorera dem
    const initR = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`);
    const init: any = await initR.json();
    let lastUpdateId = 0;
    if (init.ok && init.result.length > 0) {
        lastUpdateId = Math.max(...init.result.map((u: any) => u.update_id));
    }

    const deadline = Date.now() + 5 * 60 * 1000; // 5 min timeout
    while (Date.now() < deadline) {
        try {
            const r = await fetch(
                `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`,
            );
            const d: any = await r.json();
            if (d.ok && d.result.length > 0) {
                for (const u of d.result) {
                    lastUpdateId = Math.max(lastUpdateId, u.update_id);
                    const msg = u.message;
                    if (!msg) continue;
                    const chatId = msg.chat.id;
                    const from = msg.from?.first_name || '?';
                    console.log('');
                    console.log(`📨 Meddelande från ${from} (chat-id: ${chatId}): "${msg.text}"`);
                    console.log('');
                    console.log('✅ Klart! Lägg in i ~/.vadkul-secrets/env:');
                    console.log('');
                    console.log(`    TG_CHAT_ID=${chatId}`);
                    console.log('');
                    console.log('Skicka sedan ett testmeddelande:');
                    console.log('    npx ts-node -e "(async () => { const t = await import(\\"./src/utils/telegram\\"); await t.sendMessage(\\"🎉 Test från VADKUL-boten!\\"); })()"');
                    process.exit(0);
                }
            }
        } catch (e) {
            console.error('Poll-fel:', (e as Error).message);
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    console.error('⏰ Timeout efter 5 min. Skicka ett meddelande till boten och prova igen.');
    process.exit(1);
}

main();
