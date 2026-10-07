/**
 * Privata eventchatten (spår 3, 7/10 kväll - "man både kan ha en publik
 * chatt och en privat chatt med folk man bjuder in"). REN logik: trådnyckeln,
 * medlemstolkningen och vilken tråd panelen ska visa.
 *
 * Datamodellen: eventChats/{nyckel}/privat/{inbjudarUid} - EN tråd per
 * inbjudare och event, med medlemmarna som MAP uid→true (voters-mönstret i
 * eventPhotos gör att reglerna kan låsa uppdateringar till ens EGEN nyckel).
 * Att gå med kräver i praktiken inbjudningslänken: ?fran=<uid> ÄR trådens id.
 *
 * NYCKELN går på SERIENS dokument (rsvpShareId) till skillnad från den
 * publika chatten som går på rått event-id (per tillfälle): inbjudningslänken
 * /e/<slug> pekar på seriens dokument, och inbjudare + mottagare måste landa
 * i samma tråd oavsett vilket tillfälle de råkar ha öppet.
 */
import { rsvpShareId } from '@/utils/rsvpTransition';

/** Samma enkodning + tak som publika chattens chatKeyFor (eventChatService). */
export function privateChatKey(eventId: string, userCreated: boolean | undefined): string {
    return encodeURIComponent(rsvpShareId(eventId, userCreated)).slice(0, 1400);
}

export interface PrivateThreadLite {
    /** Dokument-id = inbjudarens uid. */
    id: string;
    inviterName: string | null;
    members: string[];
}

/** Tolka tråd-dokumentet defensivt (som parseFriendRow). */
export function parsePrivateThread(id: string, data: unknown): PrivateThreadLite | null {
    if (!id || !data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    const membersRaw = d.members;
    if (!membersRaw || typeof membersRaw !== 'object' || Array.isArray(membersRaw)) return null;
    const members = Object.entries(membersRaw as Record<string, unknown>)
        .filter(([uid, v]) => uid.length > 0 && v === true)
        .map(([uid]) => uid)
        .sort();
    return {
        id,
        inviterName: typeof d.inviterName === 'string' && d.inviterName.trim() ? d.inviterName.trim() : null,
        members,
    };
}

export function isThreadMember(thread: PrivateThreadLite, uid: string | null): boolean {
    return uid !== null && thread.members.includes(uid);
}

/**
 * Vilken tråd panelen visar: min EGEN (jag bjöd) går före, sedan den jag
 * blev bjuden till (?fran=), sedan första medlemskapet. null = ingen tråd
 * att visa (men ?fran= kan fortfarande ge en gå-med-väg, se panelen).
 */
export function pickPrivateThread(
    threads: PrivateThreadLite[],
    myUid: string | null,
    inviteFran: string | null,
): PrivateThreadLite | null {
    if (myUid) {
        const mine = threads.find(t => t.id === myUid);
        if (mine) return mine;
    }
    if (inviteFran) {
        const invited = threads.find(t => t.id === inviteFran);
        if (invited) return invited;
    }
    return threads[0] ?? null;
}

/** De ANDRA i tråden - panelens rubrik ("Privat med Josef"). */
export function threadOthersLabel(thread: PrivateThreadLite, myUid: string | null): string | null {
    if (thread.inviterName && thread.id !== myUid) return thread.inviterName;
    const others = thread.members.filter(u => u !== myUid).length;
    if (others <= 0) return null;
    return others === 1 ? '1 inbjuden' : `${others} inbjudna`;
}

/**
 * Vart en inbjudningslänk ur privata chatten leder (länkens ?fran= = trådens
 * id): den tråd jag redan är MEDLEM i - då hamnar de jag bjuder in i samma
 * chatt som jag, även när någon annan startade den - annars min egen tråd
 * (som skapas i samma tryck, ensurePrivateThread).
 */
export function privateInviteThreadId(activeThread: PrivateThreadLite | null, myUid: string): string {
    if (activeThread && isThreadMember(activeThread, myUid)) return activeThread.id;
    return myUid;
}
