/**
 * Approval-flow via Telegram.
 *
 * Skickar utkast → väntar på svar → tolkar:
 *   klar | ok | publicera     → publicera
 *   skip | avbryt | cancel     → avbryt
 *   bild | image | next        → byt till nästa bild
 *   text | regen | regenerera  → omgenerera text
 *   <fri text>                 → använd som ny text, vänta på "klar" igen
 */

import { sendMessage, sendPhoto, sendMediaGroup, waitForReply, flushPendingUpdates, isTelegramConfigured } from './telegram';

export interface ApprovalDraft {
    text: string;
    /** En eller flera bilder (kronologiskt: morgon, dag, kväll). */
    imageUrls?: string[];
}

export interface ApprovalCallbacks {
    onRegenText: () => Promise<string>;
    /** Returnera nya bilder (ofta från nya event-val) — om ej finns: undefined */
    onNextImages: () => Promise<string[] | undefined>;
    onRegenAll?: () => Promise<{ text: string; imageUrls?: string[] }>;
    /**
     * Byt ut specifika slots (1-indexerat externt, t.ex. "nytt13" → [1,3]).
     * Om ej implementerad, faller "nytt<digits>" tillbaka på onRegenAll.
     */
    onSwapSlots?: (slotIndices: number[]) => Promise<{ text: string; imageUrls?: string[] }>;
}

export interface ApprovalResult {
    approved: boolean;
    text: string;
    imageUrls?: string[];
    reason?: string;
}

const HELP_FOOTER = `

— Svara:
  <code>klar</code>   = publicera
  <code>text</code>   = ny text (samma events)
  <code>nytt</code>   = byt ALLA event + ny text
  <code>nytt1</code>  = byt bara morgon-eventet
  <code>nytt2</code>  = byt bara dag-eventet
  <code>nytt3</code>  = byt bara kväll-eventet
  <code>nytt13</code> = byt morgon + kväll
  <code>stopp</code>  = avbryt idag (inget inlägg)
  eller skriv egen text`;

function formatPreview(text: string, isCustom: boolean): string {
    const header = isCustom ? '✏️ <b>Din text</b>' : '📋 <b>Dagens utkast</b>';
    // Escape HTML-tecken i text (Telegram HTML-mode)
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `${header}\n\n${safe}${HELP_FOOTER}`;
}

async function sendDraft(text: string, imageUrls: string[] | undefined, isCustom: boolean): Promise<void> {
    const body = formatPreview(text, isCustom);
    const imgs = (imageUrls ?? []).filter(Boolean);
    if (imgs.length === 0) {
        await sendMessage(body + '\n\n<i>(inga bilder)</i>');
    } else if (imgs.length === 1) {
        await sendPhoto(imgs[0], body);
    } else {
        await sendMediaGroup(imgs, body);
    }
}

/**
 * Driv approval-flow. Returnerar `approved: true` om användaren godkände
 * (skicka vidare till publicering), annars `false`.
 */
export async function approveDraft(
    initial: ApprovalDraft,
    cb: ApprovalCallbacks,
    timeoutMs: number = 7 * 60 * 60 * 1000,
): Promise<ApprovalResult> {
    if (!isTelegramConfigured()) {
        console.log('[Approval] Telegram ej konfigurerat — auto-godkänner.');
        return { approved: true, text: initial.text, imageUrls: initial.imageUrls, reason: 'no-telegram' };
    }

    await flushPendingUpdates();

    let text = initial.text;
    let imageUrls = initial.imageUrls ?? [];
    let textIsCustom = false;
    const deadline = Date.now() + timeoutMs;

    await sendDraft(text, imageUrls, textIsCustom);

    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        const reply = await waitForReply(remaining);
        if (!reply) {
            await sendMessage('⏰ Timeout — hoppar över publicering idag.');
            return { approved: false, text, imageUrls, reason: 'timeout' };
        }

        const cmd = reply.toLowerCase().trim();

        if (['klar', 'ok', 'publish', 'publicera', '👍', '✅'].includes(cmd)) {
            await sendMessage('🚀 Publicerar nu…');
            return { approved: true, text, imageUrls };
        }
        if (['stopp', 'avbryt', 'cancel', 'nej', 'no', '❌'].includes(cmd)) {
            await sendMessage('🛑 Avbryter publicering idag.');
            return { approved: false, text, imageUrls, reason: 'user-skip' };
        }
        if (['bild', 'bilder', 'image', 'next', 'nästa'].includes(cmd)) {
            const next = await cb.onNextImages();
            if (!next || next.length === 0) {
                await sendMessage('🚫 Inga nya bilder — behåller nuvarande.');
                continue;
            }
            imageUrls = next;
            await sendDraft(text, imageUrls, textIsCustom);
            continue;
        }
        if (['text', 'regen', 'regenerera', 'ny text', 'nytext'].includes(cmd)) {
            await sendMessage('🔄 Genererar ny text…');
            text = await cb.onRegenText();
            textIsCustom = false;
            await sendDraft(text, imageUrls, textIsCustom);
            continue;
        }
        // "nytt" + valfria siffror: nytt1, nytt12, nytt23, nytt123
        // Siffror är 1-indexerade (1=morgon, 2=dag, 3=kväll). Inga siffror = byt allt.
        const nyttMatch = cmd.match(/^(?:nytt|annat|byt|omstart)\s*([1-9]+)?$/);
        if (nyttMatch || cmd === 'skip') {
            const digitStr = nyttMatch?.[1] ?? '';
            const slotIndices = digitStr.split('').map(d => parseInt(d, 10)).filter(n => n >= 1 && n <= 3);
            const uniqueSlots = [...new Set(slotIndices)].sort();

            // Inga digits eller alla 3 = full omstart
            const isFullRegen = uniqueSlots.length === 0 || uniqueSlots.length === 3;

            if (isFullRegen) {
                if (cb.onRegenAll) {
                    await sendMessage('🔄 Genererar nytt utkast (text + bilder)…');
                    const fresh = await cb.onRegenAll();
                    text = fresh.text;
                    imageUrls = fresh.imageUrls ?? imageUrls;
                } else {
                    await sendMessage('🔄 Ny text och nya bilder…');
                    text = await cb.onRegenText();
                    const next = await cb.onNextImages();
                    if (next) imageUrls = next;
                }
            } else {
                if (cb.onSwapSlots) {
                    const slotNames = uniqueSlots.map(i => ['morgon', 'dag', 'kväll'][i - 1]).join(' + ');
                    await sendMessage(`🔄 Byter ${slotNames}…`);
                    const fresh = await cb.onSwapSlots(uniqueSlots);
                    text = fresh.text;
                    imageUrls = fresh.imageUrls ?? imageUrls;
                } else {
                    await sendMessage('⚠️ Per-slot-byte ej tillgängligt — byter allt.');
                    const fresh = await (cb.onRegenAll?.() ?? Promise.resolve({ text: await cb.onRegenText(), imageUrls }));
                    text = fresh.text;
                    imageUrls = fresh.imageUrls ?? imageUrls;
                }
            }
            textIsCustom = false;
            await sendDraft(text, imageUrls, textIsCustom);
            continue;
        }
        // Annars: tolka som ny anpassad text
        text = reply;
        textIsCustom = true;
        await sendDraft(text, imageUrls, textIsCustom);
    }

    await sendMessage('⏰ Timeout — hoppar över publicering idag.');
    return { approved: false, text, imageUrls, reason: 'timeout' };
}
