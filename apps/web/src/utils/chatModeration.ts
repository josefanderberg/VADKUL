/**
 * Moderering i eventchatten - port av appens vadkul-app/src/lib/moderering.ts
 * (App Store-regel 1.2 / samma skydd på webben: anmäl meddelanden, blockera
 * användare). REN logik: dokumentformerna som Firestore-reglerna låser,
 * filtret som döljer blockerade/anmälda meddelanden och skrivningarna för
 * blockeringen. Rören bor i services/moderationService.
 *
 * DOKUMENTFORMEN ÄR FRYST: appens build 7 skriver exakt samma reports-
 * dokument, och reports-regeln (firestore.rules §6) är formlåst mot den.
 * Ändra aldrig nycklar, värden eller tak här utan att appen och regeln
 * följer med - chatReportDoc-testet bär samma facit som appens test.
 *
 * ANMÄLAN går till reports/{auto-id} med en ögonblicksbild av meddelandet
 * (granskningen ska inte hänga på att originalet finns kvar). Mejlet
 * (chatReportMailto) är reserven när skrivningen inte går fram.
 *
 * BLOCKERING bor i en EGEN lista users/{uid}/blocked/{blockeradUid} som bara
 * ägaren läser - inte som status i friends, där båda parter kan läsa och
 * radera raden. Att blockera river samtidigt vänskapen (båda raderna, samma
 * batch). Meddelandena göms på klienten för den som blockerat, i både publik
 * och privat chatt.
 */
import { friendRemoveWrites, type FriendWrite } from './friendStatus';

export const REPORT_RECIPIENT = 'hej@vadkul.se';

/** Samma strängar som appen - de sparas som reason i reports. */
export const CHAT_REPORT_REASONS = [
    'Stötande eller kränkande',
    'Hot eller trakasserier',
    'Spam eller bedrägeri',
    'Något annat',
] as const;

export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];

export type ChatKind = 'public' | 'private';

/** Fältens tak - SAMMA siffror som reports-regeln i firestore.rules. */
export const REPORT_LIMITS = {
    eventId: 1400,
    eventTitle: 200,
    id: 128,
    senderName: 80,
    text: 500,
    reason: 80,
} as const;

/** Det som syns i en chattbubbla - ChatMessage, defensivt. */
export interface ChatMessageLite {
    id?: string;
    senderId?: string;
    senderName?: string;
    text?: string;
}

export interface ChatReportInput {
    chat: ChatKind;
    eventId: string;
    eventTitle: string;
    /** Privata trådens id (= inbjudarens uid). null i publika chatten. */
    threadId: string | null;
    message: ChatMessageLite;
    reason: ChatReportReason;
    /** Den som anmäler. */
    reporterUid: string;
}

/** reports-dokumentet (createdAt läggs på som serverTimestamp i tjänsten). */
export interface ChatReportDoc {
    type: 'chatMessage';
    chat: ChatKind;
    eventId: string;
    eventTitle: string;
    threadId?: string;
    messageId: string;
    senderId: string;
    senderName?: string;
    text: string;
    reason: ChatReportReason;
    reporterUid: string;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Går meddelandet att anmäla/blockera? Bara ANDRAS meddelanden med en
 *  avsändare - sina egna modererar man inte. */
export function canModerate(msg: ChatMessageLite, myUid: string | null): boolean {
    const sender = clean(msg.senderId);
    return !!myUid && sender.length > 0 && sender !== myUid;
}

/**
 * Bygg reports-dokumentet. null = går inte att anmäla (eget meddelande,
 * saknat id/avsändare/event). Allt klipps till reglernas tak; id:n som är
 * för långa vägras hellre än klipps (de ska gå att slå upp).
 */
export function chatReportDoc(u: ChatReportInput): ChatReportDoc | null {
    const messageId = clean(u.message.id);
    const senderId = clean(u.message.senderId);
    const eventId = u.eventId.slice(0, REPORT_LIMITS.eventId);
    const reporterUid = clean(u.reporterUid);
    if (!messageId || messageId.length > REPORT_LIMITS.id) return null;
    if (!senderId || senderId.length > REPORT_LIMITS.id) return null;
    if (!eventId || !reporterUid || senderId === reporterUid) return null;
    const threadId = u.chat === 'private' ? clean(u.threadId) : '';
    if (u.chat === 'private' && (!threadId || threadId.length > REPORT_LIMITS.id)) return null;
    const senderName = clean(u.message.senderName).slice(0, REPORT_LIMITS.senderName);
    return {
        type: 'chatMessage',
        chat: u.chat,
        eventId,
        eventTitle: clean(u.eventTitle).slice(0, REPORT_LIMITS.eventTitle),
        ...(threadId ? { threadId } : {}),
        messageId,
        senderId,
        ...(senderName ? { senderName } : {}),
        text: (typeof u.message.text === 'string' ? u.message.text : '').slice(0, REPORT_LIMITS.text),
        reason: u.reason,
        reporterUid,
    };
}

/** Reserven när reports-skrivningen inte går fram: samma innehåll som mejl. */
export function chatReportMailto(d: ChatReportDoc): string {
    const subject = `Anmält chattmeddelande: ${d.eventTitle || d.eventId}`;
    const lines = [
        `Skäl: ${d.reason}`,
        '',
        `Chatt: ${d.chat === 'private' ? 'privat' : 'publik'}`,
        `Event: ${d.eventTitle}`,
        `Event-id: ${d.eventId}`,
    ];
    if (d.threadId) lines.push(`Tråd: ${d.threadId}`);
    lines.push(
        `Meddelande-id: ${d.messageId}`,
        `Avsändare: ${d.senderName ?? '(namnlös)'} (uid ${d.senderId})`,
        `Anmält av: ${d.reporterUid}`,
        '',
        'Meddelandet:',
        d.text,
        '',
        'Beskriv gärna vad som hänt:',
        '',
    );
    return `mailto:${REPORT_RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

/**
 * Det som visas i en chatt: blockerade avsändares meddelanden och de
 * meddelanden JAG anmält göms. Mina egna visas alltid. Samma array tillbaka
 * när inget ska döljas. Muterar inte indata.
 */
export function visibleMessages<T extends ChatMessageLite>(
    messages: T[],
    myUid: string | null,
    blocked: ReadonlySet<string>,
    hidden: ReadonlySet<string>,
): T[] {
    if (blocked.size === 0 && hidden.size === 0) return messages;
    return messages.filter(m => {
        const sender = clean(m.senderId);
        if (myUid && sender === myUid) return true;
        if (sender && blocked.has(sender)) return false;
        if (m.id && hidden.has(m.id)) return false;
        return true;
    });
}

/** Namnet som visas i menyn - avsändarnamnet eller "användaren". */
export function senderLabel(msg: ChatMessageLite): string {
    return clean(msg.senderName) || 'användaren';
}

/** Svensk genitiv: "Annas", men "Lars" och "Max" utan extra s. */
export function genitive(name: string): string {
    return /[sxz]$/i.test(name) ? name : `${name}s`;
}

/** Lägg ett anmält meddelande-id i den lokala döljlistan - nyast sist,
 *  äldsta faller bort över taket (listan sparas i webbläsaren). */
export function addHidden(hidden: readonly string[], id: string, cap = 200): string[] {
    if (!id) return [...hidden];
    const without = hidden.filter(h => h !== id);
    return [...without, id].slice(-cap);
}

/** Tolka en sparad döljlista (localStorage) defensivt. */
export function parseHiddenList(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const v: unknown = JSON.parse(raw);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
    } catch {
        return [];
    }
}

// ── BLOCKERINGSLISTAN ─────────────────────────────────────────────────────

/** En rad i MIN blocked-undersamling - uid är den blockerades. */
export interface BlockRow {
    uid: string;
    name: string | null;
}

/** Tolka ett blocked-dokument defensivt (som parseFriendRow). */
export function parseBlockRow(id: string, data: unknown): BlockRow | null {
    if (!id || !data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    const name = clean(d.name);
    return { uid: id, name: name || null };
}

/** Skrivningen för blocked-dokumentet. data null = radera (häv). */
export interface BlockWrite {
    owner: string;
    blocked: string;
    data: { name?: string } | null;
}

export interface BlockWrites {
    block: BlockWrite;
    /** Vänskapen rivs i samma batch (båda raderna, utils/friendStatus). */
    friends: FriendWrite[];
}

/** Blockera: min blocked-rad (namnet denormaliserat för listan i profilen)
 *  + radering av båda vänraderna. null = ogiltigt (sig själv). */
export function blockWrites(myUid: string, other: { uid: string; name?: string | null }): BlockWrites | null {
    if (!myUid || !other.uid || myUid === other.uid) return null;
    const name = clean(other.name).slice(0, 80);
    return {
        block: { owner: myUid, blocked: other.uid, data: name ? { name } : {} },
        friends: friendRemoveWrites(myUid, other.uid),
    };
}

/** Häv blockering: bara min rad raderas - vänskapen kommer inte tillbaka. */
export function unblockWrite(myUid: string, otherUid: string): BlockWrite | null {
    if (!myUid || !otherUid || myUid === otherUid) return null;
    return { owner: myUid, blocked: otherUid, data: null };
}

/** Listan i profilen: namnordning (sv), namnlösa sist. Muterar inte indata. */
export function sortBlocked(rows: readonly BlockRow[]): BlockRow[] {
    return [...rows].sort((a, b) => {
        if (a.name === null && b.name === null) return a.uid < b.uid ? -1 : 1;
        if (a.name === null) return 1;
        if (b.name === null) return -1;
        return a.name.localeCompare(b.name, 'sv');
    });
}
