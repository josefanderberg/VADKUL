// src/services/privateChatService.ts
import {
    FieldPath, addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy,
    query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChatMessage } from '../types';
import { rsvpShareId } from '../utils/rsvpTransition';
import { parsePrivateThread, privateChatKey, type PrivateThreadLite } from '../utils/privateChat';

/**
 * Privata eventchatten (spår 3): eventChats/{nyckel}/privat/{inbjudarUid},
 * tråd-/medlemslogiken bor i utils/privateChat (REN, testad). Skild från den
 * publika tråden (eventChats/{nyckel}/messages) - och till skillnad från den
 * speglas INGENTING till latestActivity/latestComment: det dokumentet läses
 * av alla, och privata meddelanden ska aldrig dit.
 *
 * Reglerna (firestore.rules, EJ deployade ännu - degradera snyggt): läsning
 * bara för medlemmar, gå-med bara via sin egen members-nyckel, skapa bara
 * tråden med sitt eget uid som id. Tills reglerna är ute svarar Firestore
 * permission-denied på allt här - varje väg in har därför en fel-gren som
 * UI:t visar som "inte aktiverad än" i stället för att krascha.
 */

function threadRef(eventId: string, userCreated: boolean | undefined, threadId: string) {
    return doc(db, 'eventChats', privateChatKey(eventId, userCreated), 'privat', threadId);
}

function messagesCol(eventId: string, userCreated: boolean | undefined, threadId: string) {
    return collection(db, 'eventChats', privateChatKey(eventId, userCreated), 'privat', threadId, 'messages');
}

// En tråd-skapning per event och session räcker (Bjud med kan tryckas flera
// gånger) - cachen nollas inte vid fel: är reglerna inte ute hjälper inga
// omförsök den här sessionen.
const ensuredThreads = new Set<string>();

/** Skapa inbjudarens tråd om den saknas - best-effort, fire-and-forget från
 *  Bjud med (delningen ÄR redan gjord, tråden får aldrig fälla den). */
export async function ensurePrivateThread(
    eventId: string,
    userCreated: boolean | undefined,
    me: { uid: string; name: string | null },
): Promise<void> {
    const key = `${privateChatKey(eventId, userCreated)}/${me.uid}`;
    if (ensuredThreads.has(key)) return;
    ensuredThreads.add(key);
    try {
        const ref = threadRef(eventId, userCreated, me.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) return;
        await setDoc(ref, {
            eventId: rsvpShareId(eventId, userCreated),
            members: { [me.uid]: true },
            ...(me.name ? { inviterName: me.name.slice(0, 80) } : {}),
            createdAt: serverTimestamp(),
        });
    } catch (e) {
        console.warn('Kunde inte skapa privata chatten (regler ej ute?):', e);
    }
}

/** Gå med i en tråd via inbjudningslänken (?fran= är trådens id). Rör BARA
 *  sin egen members-nyckel (reglernas Map.diff-lås). Kastar vid fel -
 *  anroparen visar "inte aktiverad än"/"tråden saknas". */
export async function joinPrivateThread(
    eventId: string,
    userCreated: boolean | undefined,
    threadId: string,
    myUid: string,
): Promise<void> {
    await updateDoc(threadRef(eventId, userCreated, threadId), new FieldPath('members', myUid), true);
}

/** Lyssna på trådarna JAG är med i för ett event. Filtret på den egna
 *  members-nyckeln är det som gör queryn tillåten i reglerna (samma mönster
 *  som eventPhotos-votersen fast för läsning). Fel (regler ej ute) →
 *  onUnavailable, lyssnaren dör tyst. */
export function subscribeMyPrivateThreads(
    eventId: string,
    userCreated: boolean | undefined,
    myUid: string,
    callback: (threads: PrivateThreadLite[]) => void,
    onUnavailable?: () => void,
) {
    const q = query(
        collection(db, 'eventChats', privateChatKey(eventId, userCreated), 'privat'),
        where(new FieldPath('members', myUid), '==', true),
        limit(5),
    );
    return onSnapshot(q, snap => {
        callback(snap.docs
            .map(d => parsePrivateThread(d.id, d.data()))
            .filter((t): t is PrivateThreadLite => t !== null));
    }, () => onUnavailable?.());
}

/** Meddelandena i en tråd - samma 50-senaste-mönster som publika chatten. */
export function subscribePrivateMessages(
    eventId: string,
    userCreated: boolean | undefined,
    threadId: string,
    callback: (msgs: ChatMessage[]) => void,
    onUnavailable?: () => void,
) {
    const q = query(messagesCol(eventId, userCreated, threadId), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, snapshot => {
        const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[];
        callback(messages.reverse());
    }, () => onUnavailable?.());
}

export async function sendPrivateMessage(
    eventId: string,
    userCreated: boolean | undefined,
    threadId: string,
    message: Omit<ChatMessage, 'id' | 'createdAt'>,
): Promise<void> {
    await addDoc(messagesCol(eventId, userCreated, threadId), {
        ...message,
        createdAt: serverTimestamp(),
    });
    // INGEN latestActivity-spegel här - privata meddelanden ska aldrig synas
    // i kartans "senaste kommentaren"-flöde.
}
