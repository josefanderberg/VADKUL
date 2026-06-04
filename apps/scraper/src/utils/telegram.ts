/**
 * Telegram-bot — minimal API för approval-flow.
 *
 * Konfig (i ~/.vadkul-secrets/env):
 *   TG_BOT_TOKEN=123456:ABC-xyz...
 *   TG_CHAT_ID=12345678
 *
 * Setup-instruktioner: `npm run setup-telegram`
 */

const TG_TOKEN = (): string => process.env.TG_BOT_TOKEN || '';
const TG_CHAT = (): string => process.env.TG_CHAT_ID || '';
const API = (): string => `https://api.telegram.org/bot${TG_TOKEN()}`;

export function isTelegramConfigured(): boolean {
    return !!(TG_TOKEN() && TG_CHAT());
}

export async function sendMessage(text: string): Promise<number | null> {
    if (!isTelegramConfigured()) return null;
    try {
        const r = await fetch(`${API()}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TG_CHAT(),
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: false,
            }),
        });
        const d: any = await r.json();
        return d.ok ? d.result.message_id : null;
    } catch (e) {
        console.error('[Telegram] sendMessage failed:', (e as Error).message);
        return null;
    }
}

export async function sendPhoto(photoUrl: string, caption: string): Promise<number | null> {
    if (!isTelegramConfigured()) return null;
    try {
        const r = await fetch(`${API()}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TG_CHAT(),
                photo: photoUrl,
                caption,
                parse_mode: 'HTML',
            }),
        });
        const d: any = await r.json();
        if (!d.ok) {
            console.error('[Telegram] sendPhoto API-fel:', d.description);
            // Fallback: skicka som textmeddelande med URL
            return sendMessage(`${caption}\n\n🖼 ${photoUrl}`);
        }
        return d.result.message_id;
    } catch (e) {
        console.error('[Telegram] sendPhoto failed:', (e as Error).message);
        return null;
    }
}

/**
 * Skicka 2-10 bilder som ett album med en gemensam caption på första bilden.
 * Returnerar antal skickade.
 */
/**
 * Validera att Telegram kan hämta en bild-URL (HEAD request).
 * Filtrerar bort 404, för stora bilder, fel content-type.
 */
async function isImageReachable(url: string): Promise<boolean> {
    try {
        const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (!r.ok) return false;
        const ct = r.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) return false;
        const len = parseInt(r.headers.get('content-length') || '0', 10);
        // Telegram-limit: ~10 MB
        if (len > 10 * 1024 * 1024) return false;
        return true;
    } catch { return false; }
}

export async function sendMediaGroup(photoUrls: string[], caption: string): Promise<number> {
    if (!isTelegramConfigured() || photoUrls.length === 0) return 0;
    const candidates = photoUrls.filter((u) => !!u && u.startsWith('http'));
    if (candidates.length === 0) {
        await sendMessage(caption);
        return 0;
    }

    // Pre-flight: filtrera bort URL:er Telegram inte kan hämta
    const checks = await Promise.all(candidates.map(isImageReachable));
    const valid = candidates.filter((_, i) => checks[i]);

    if (valid.length === 0) {
        // Ingen bild fungerar — fall tillbaka på textmeddelande
        await sendMessage(caption + '\n\n<i>(bilderna gick inte att ladda)</i>');
        return 0;
    }
    if (valid.length === 1) {
        return (await sendPhoto(valid[0], caption)) ? 1 : 0;
    }

    try {
        const media = valid.slice(0, 10).map((url, i) => ({
            type: 'photo',
            media: url,
            ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}),
        }));
        const r = await fetch(`${API()}/sendMediaGroup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT(), media }),
        });
        const d: any = await r.json();
        if (!d.ok) {
            console.error('[Telegram] sendMediaGroup API-fel:', d.description);
            // Fallback: bara första bilden
            await sendPhoto(valid[0], caption);
            return 1;
        }
        return d.result.length;
    } catch (e) {
        console.error('[Telegram] sendMediaGroup failed:', (e as Error).message);
        // Sista utvägen: textmeddelande
        await sendMessage(caption + '\n\n<i>(bildvisning misslyckades)</i>');
        return 0;
    }
}

// State för long-polling — undvik att läsa samma meddelande två gånger
let lastUpdateId = 0;

/** Initiera lastUpdateId till nu så vi inte plockar upp gamla meddelanden */
export async function flushPendingUpdates(): Promise<void> {
    if (!isTelegramConfigured()) return;
    try {
        const r = await fetch(`${API()}/getUpdates?limit=100&timeout=0`);
        const d: any = await r.json();
        if (d.ok && d.result.length > 0) {
            lastUpdateId = Math.max(...d.result.map((u: any) => u.update_id));
        }
    } catch { /* ignore */ }
}

/**
 * Vänta på svar från användaren (long-polling).
 * Returnerar svars-texten eller null vid timeout.
 */
export async function waitForReply(timeoutMs: number): Promise<string | null> {
    if (!isTelegramConfigured()) return null;
    const deadline = Date.now() + timeoutMs;
    const pollSeconds = 25; // Telegram tillåter upp till 50

    while (Date.now() < deadline) {
        const remaining = Math.floor((deadline - Date.now()) / 1000);
        const timeout = Math.min(pollSeconds, Math.max(1, remaining));
        try {
            const params = new URLSearchParams({
                offset: String(lastUpdateId + 1),
                timeout: String(timeout),
                allowed_updates: '["message"]',
            });
            const r = await fetch(`${API()}/getUpdates?${params}`, {
                signal: AbortSignal.timeout((timeout + 5) * 1000),
            });
            const d: any = await r.json();
            if (!d.ok || !d.result) continue;

            for (const u of d.result) {
                lastUpdateId = Math.max(lastUpdateId, u.update_id);
                const msg = u.message;
                if (!msg || !msg.text) continue;
                // Filtrera: bara meddelanden från konfigurerat chat-id
                if (String(msg.chat?.id) !== TG_CHAT()) continue;
                return msg.text.trim();
            }
        } catch (e) {
            // Network/timeout — fortsätt poll-loop
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    return null;
}
