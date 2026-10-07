'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, ChevronDown, Lock, UserPlus, Users, Link2, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { linkEventChatService } from '@/services/eventChatService';
import {
    ensurePrivateThread,
    joinPrivateThread,
    sendPrivateMessage,
    subscribeMyPrivateThreads,
    subscribePrivateMessages,
} from '@/services/privateChatService';
import { isThreadMember, pickPrivateThread, privateInviteThreadId, threadOthersLabel, type PrivateThreadLite } from '@/utils/privateChat';
import { inviteUrl } from '@/utils/rsvpTransition';
import type { ChatMessage } from '@/types';
import toast from 'react-hot-toast';

interface Props {
    eventId: string;
    /** Eventtiteln - följer med till senaste-kommentar-bubblan på kartan. */
    eventTitle?: string;
    /** Serietillfällen (userCreated) delar PRIVAT tråd på seriens dokument
     *  (privateChatKey/rsvpShareId) - publika tråden går på rått id som förut. */
    userCreated?: boolean;
    /** Kortet öppnades via en inbjudningslänk (?inb=1&fran=<uid>): fran är
     *  inbjudarens uid = den privata trådens id, så panelen kan visa en
     *  gå-med-väg i den privata chatten (spår 3). */
    invite?: { fran: string | null } | null;
    /** Öppna inloggningsmodalen (utan att lämna sidan). */
    onRequireLogin: () => void;
}

// Gemensamt skal för chattblocken (rad och panel).
const BOX = 'rounded-xl border border-border bg-slate-50 dark:bg-zinc-900/40';
const ROW = `flex items-center gap-2 ${BOX} px-3 py-2.5 text-left hover:border-[#006AA7]/40 transition-colors`;
const LABEL = 'text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0';

function formatTime(msg: ChatMessage): string {
    return msg.createdAt && typeof (msg.createdAt as any).toDate === 'function'
        ? (msg.createdAt as any).toDate().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
        : '';
}

/** Meddelandelistan + skrivfältet - samma för publik och privat chatt. */
function ChatThread({ messages, myUid, emptyText, placeholder, onSend }: {
    messages: ChatMessage[];
    myUid: string;
    emptyText: string;
    placeholder: string;
    onSend: (text: string) => Promise<void>;
}) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    // Scrolla ENBART chattens egen meddelandelista (aldrig scrollIntoView -
    // den scrollar alla scrollbara föräldrar och drog ner hela eventkortet
    // till chatten när serverns första snapshot landade efter mount).
    const listRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;   // rör bara den inre listan
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() || sending) return;
        setSending(true);
        try {
            await onSend(text.trim());
            setText('');
        } catch (error) {
            console.error(error);
            toast.error('Kunde inte skicka meddelandet.');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <div ref={listRef} className="max-h-56 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                    <p className="text-center text-xs font-semibold text-slate-400 py-3">{emptyText}</p>
                )}
                {messages.map((msg) => {
                    const isMe = msg.senderId === myUid;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm shadow-sm ${
                                isMe
                                    ? 'bg-[#006AA7] text-white rounded-br-sm'
                                    : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-border rounded-bl-sm'
                            }`}>
                                {/* Användarnamnet syns på ALLA kommentarer - även ens egna,
                                    så man ser hur man framstår för andra. */}
                                <p className={`text-[10px] font-black mb-0.5 ${isMe ? 'text-white/85' : 'text-[#006AA7] dark:text-sky-300'}`}>
                                    {isMe ? `${msg.senderName || 'Du'} (du)` : (msg.senderName || 'Deltagare')}
                                </p>
                                <p className="break-words">{msg.text}</p>
                                <span className={`block text-right text-[9px] mt-0.5 ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                                    {formatTime(msg)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <form onSubmit={handleSubmit} className="p-2 border-t border-border flex gap-2 bg-white/60 dark:bg-zinc-900/60">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={placeholder}
                    aria-label="Skriv ett chattmeddelande"
                    maxLength={500}
                    className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-[#006AA7]/40 text-sm text-slate-800 dark:text-zinc-100"
                />
                <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    aria-label="Skicka"
                    className="p-2 bg-[#006AA7] text-white rounded-full hover:bg-[#005590] disabled:opacity-40 transition-colors"
                >
                    <Send size={16} />
                </button>
            </form>
        </>
    );
}

/**
 * Eventets chattar - bor i eventkortet under svarsraden (och i stadssidornas
 * utfällda event). TVÅ BLOCK sedan 7/10 sent (Josef: "Sen ska det vara en
 * till chat. där man kan bjuda in andra direkt i en privat chatt. alltså så
 * kan man kopiera länken"):
 *
 * PUBLIK CHATT - som förut. KRÄVER KONTO FÖR ATT ENS LÄSAS (Josef 31/8):
 * utloggade möts av en låst rad som öppnar auth-modalen, och ingen
 * prenumeration startas (noll Firestore-läsningar). INFÄLLD tills någon
 * skrivit något (Josef 30/8): utan meddelanden bara en rad man kan fälla upp.
 *
 * PRIVAT CHATT - syns för ALLA inloggade, inte bara för medlemmar som när
 * den var en flik (7/10 kväll). Utan medlemskap: "Bjud in" (delningsarket)
 * och "Kopiera länk". Båda startar ens egen tråd i bakgrunden
 * (ensurePrivateThread - INTE awaitad: delning/urklipp måste ske i samma
 * tryck, Safari släpper annars användargesten) och delar
 * inbjudningslänken /e/<slug>?inb=1&fran=<trådens ägare>. Mottagaren får
 * svarsbannern (svara utan konto) och här en gå-med-väg; som medlem kan man
 * bjuda in fler till SAMMA tråd (länken bär trådägarens uid,
 * privateInviteThreadId). Tråden bor i eventChats/{nyckel}/privat/{ägarUid}
 * (utils/privateChat + privateChatService). Tills reglerna är deployade
 * svarar Firestore permission-denied och blocket visar en lugn "inte
 * aktiverad än"-rad (privUnavailable) i stället för inbjudningsknapparna.
 */
export default function EventChatPanel({ eventId, eventTitle, userCreated, invite = null, onRequireLogin }: Props) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // Manuellt uppfälld trots tom chatt (för att bli först att skriva).
    const [expanded, setExpanded] = useState(false);
    // Privata tråden (spår 3).
    const [threads, setThreads] = useState<PrivateThreadLite[]>([]);
    const [privMessages, setPrivMessages] = useState<ChatMessage[]>([]);
    const [privUnavailable, setPrivUnavailable] = useState(false);
    const [joining, setJoining] = useState(false);
    // "Kopierad ✓" på knappen en stund efter kopieringen.
    const [copied, setCopied] = useState(false);

    // uid (inte user-objektet) som effekt-nyckel: AuthContext byter referens
    // vid token-refresh och skulle annars riva upp lyssnaren i onödan.
    const uid = user?.uid ?? null;
    useEffect(() => {
        // Eventbyte återanvänder komponenten (ingen key i EventCard) - börja
        // om hopfällt och utan förra eventets meddelanden.
        setExpanded(false);
        setMessages([]);
        setThreads([]);
        setPrivMessages([]);
        setPrivUnavailable(false);
        setCopied(false);
        // Utloggad = ingen lyssnare alls. Chatten är låst (se de låsta raderna
        // nedan), och en prenumeration hade bara bränt läsningar på innehåll
        // som ändå inte visas. Loggar man in monteras lyssnaren direkt (uid
        // byter värde) så chatten dyker upp utan att kortet behöva stängas.
        if (!uid) return;
        const unsubscribe = linkEventChatService.subscribeToMessages(eventId, setMessages);
        return () => unsubscribe();
    }, [eventId, uid]);

    // Trådarna JAG är med i (0-1 i praktiken) - queryn filtrerar på den egna
    // members-nyckeln, så den är billig och tillåten i reglerna. Fel =
    // reglerna är inte ute än → privata blocket degraderar till inforaden.
    const fran = invite?.fran ?? null;
    useEffect(() => {
        if (!uid) return;
        const unsub = subscribeMyPrivateThreads(eventId, userCreated, uid, setThreads, () => setPrivUnavailable(true));
        return () => unsub();
    }, [eventId, userCreated, uid]);

    const activeThread = pickPrivateThread(threads, uid, fran);
    const amMember = activeThread !== null && isThreadMember(activeThread, uid);

    // Meddelandelyssnaren för privata tråden - bara som medlem.
    const activeThreadId = amMember ? activeThread.id : null;
    useEffect(() => {
        setPrivMessages([]);
        if (!uid || !activeThreadId) return;
        const unsub = subscribePrivateMessages(eventId, userCreated, activeThreadId, setPrivMessages, () => setPrivUnavailable(true));
        return () => unsub();
    }, [eventId, userCreated, uid, activeThreadId]);

    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 2500);
        return () => clearTimeout(t);
    }, [copied]);

    const handleJoin = async () => {
        if (!user || !fran || joining) return;
        setJoining(true);
        try {
            await joinPrivateThread(eventId, userCreated, fran, user.uid);
            // Tråd-lyssnaren plockar upp medlemskapet och blocket fylls på.
        } catch {
            // Antingen är reglerna inte ute än, eller så har inbjudaren inte
            // startat tråden (äldre klient) - samma lugna inforad i båda fallen.
            setPrivUnavailable(true);
        } finally {
            setJoining(false);
        }
    };

    // Inbjudningslänken till den privata chatten. Synkron med flit: trådens
    // dokument skapas i bakgrunden (fire-and-forget), länken beror inte på
    // det - och share/clipboard måste anropas i samma tryck.
    const privateInviteLink = (): string | null => {
        if (!user) return null;
        if (!amMember) {
            void ensurePrivateThread(eventId, userCreated, { uid: user.uid, name: user.displayName || null });
        }
        const threadId = privateInviteThreadId(activeThread, user.uid);
        return inviteUrl(window.location.origin, eventId, userCreated, threadId);
    };

    const handleShareInvite = async () => {
        const url = privateInviteLink();
        if (!url) return;
        const text = `Följer du med på ${eventTitle ?? 'det här eventet'}? Vi snackar ihop oss i en privat chatt på VADKUL.`;
        try {
            if (navigator.share) {
                await navigator.share({ title: eventTitle, text, url });
                return;
            }
            await navigator.clipboard.writeText(`${text} ${url}`);
            setCopied(true);
            toast.success('Inbjudningslänken är kopierad!');
        } catch { /* avbruten delning är inget fel */ }
    };

    const handleCopyInvite = async () => {
        const url = privateInviteLink();
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success('Länken är kopierad - skicka den till dem du vill ha med!');
        } catch {
            toast.error('Kunde inte kopiera länken.');
        }
    };

    const sendPublic = async (text: string) => {
        if (!user) return;
        await linkEventChatService.sendMessage(eventId, {
            senderId: user.uid,
            senderName: user.displayName || user.email || 'Anonym',
            senderImage: user.photoURL || null,
            text,
        }, eventTitle);
    };

    const sendPrivate = async (text: string) => {
        if (!user || !activeThreadId) return;
        await sendPrivateMessage(eventId, userCreated, activeThreadId, {
            senderId: user.uid,
            senderName: user.displayName || user.email || 'Anonym',
            senderImage: user.photoURL || null,
            text,
        });
    };

    // UTLOGGAD: båda chattarna är låsta (Josef 31/8). Samma rad-format som
    // det hopfällda läget, men hänglås i stället för chevron - de lovar inget
    // som inte går att fälla upp. Klick öppnar auth-modalen. (Gäller även
    // den som kom via en inbjudningslänk: chattarna kräver konto, svaret i
    // svarsraden gör det inte.)
    if (!user) {
        return (
            <div className="flex flex-col gap-2">
                <button type="button" onClick={onRequireLogin} className={ROW}>
                    <MessageCircle size={14} className="text-[#006AA7] shrink-0" />
                    <span className={LABEL}>Chatt</span>
                    <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#006AA7]">
                        Logga in för att se chatten
                    </span>
                    <Lock size={13} className="text-slate-400 shrink-0" aria-hidden />
                </button>
                <button type="button" onClick={onRequireLogin} className={ROW}>
                    <Users size={14} className="text-[#006AA7] shrink-0" />
                    <span className={LABEL}>Privat chatt</span>
                    <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#006AA7]">
                        {fran ? 'Logga in för att gå med' : 'Logga in för att bjuda in'}
                    </span>
                    <Lock size={13} className="text-slate-400 shrink-0" aria-hidden />
                </button>
            </div>
        );
    }

    // ── PUBLIK ─────────────────────────────────────────────────────────────
    // Hopfällt läge: inga meddelanden och inte manuellt uppfälld - bara en
    // rad som visar att chatten finns. Klick fäller upp hela panelen.
    const publicBlock = messages.length === 0 && !expanded ? (
        <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            className={ROW}
        >
            <MessageCircle size={14} className="text-[#006AA7] shrink-0" />
            <span className={LABEL}>Chatt</span>
            <span className="flex-1 min-w-0 truncate text-xs font-semibold text-slate-400">
                Inga meddelanden än - bli först att säga hej! 👋
            </span>
            <ChevronDown size={14} className="text-slate-400 shrink-0" aria-hidden />
        </button>
    ) : (
        <div className={`flex flex-col ${BOX} overflow-hidden`}>
            <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-white/60 dark:bg-zinc-900/60">
                <MessageCircle size={14} className="text-[#006AA7]" />
                <span className={LABEL}>
                    Chatt {messages.length > 0 && `· ${messages.length}`}
                </span>
            </div>
            <ChatThread
                messages={messages}
                myUid={user.uid}
                emptyText="Inga meddelanden än - bli först att säga hej! 👋"
                placeholder="Skriv något…"
                onSend={sendPublic}
            />
        </div>
    );

    // ── PRIVAT ─────────────────────────────────────────────────────────────
    const inviteButtons = (size: 'full' | 'icon') => size === 'full' ? (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => void handleShareInvite()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#006AA7] px-3.5 py-2 text-xs font-black text-white hover:bg-[#005590] active:scale-95 transition"
            >
                <UserPlus size={14} strokeWidth={2.5} aria-hidden />
                Bjud in
            </button>
            <button
                type="button"
                onClick={() => void handleCopyInvite()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-black text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 active:scale-95 transition"
            >
                {copied ? <Check size={14} strokeWidth={3} aria-hidden /> : <Link2 size={14} strokeWidth={2.5} aria-hidden />}
                {copied ? 'Kopierad' : 'Kopiera länk'}
            </button>
        </div>
    ) : (
        <div className="flex items-center gap-1 shrink-0">
            <button
                type="button"
                onClick={() => void handleShareInvite()}
                aria-label="Bjud in fler till den privata chatten"
                title="Bjud in fler"
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#006AA7] hover:bg-[#006AA7]/10 transition-colors"
            >
                <UserPlus size={14} strokeWidth={2.5} aria-hidden />
            </button>
            <button
                type="button"
                onClick={() => void handleCopyInvite()}
                aria-label="Kopiera länken till den privata chatten"
                title={copied ? 'Kopierad' : 'Kopiera länk'}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#006AA7] hover:bg-[#006AA7]/10 transition-colors"
            >
                {copied ? <Check size={14} strokeWidth={3} aria-hidden /> : <Link2 size={14} strokeWidth={2.5} aria-hidden />}
            </button>
        </div>
    );

    // Privata blockets rubrikrad ("Privat chatt · Josef").
    const privLabel = activeThread ? threadOthersLabel(activeThread, uid) : null;
    const privateHeader = (
        <div className="flex items-center gap-2 min-w-0">
            <Users size={14} className="text-[#006AA7] shrink-0" />
            <span className={LABEL}>Privat chatt</span>
            {amMember && privLabel && (
                <span className="flex-1 min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-slate-400">
                    · {privLabel}
                </span>
            )}
        </div>
    );

    const privateBlock = amMember && !privUnavailable ? (
        // MEDLEM: hela tråden + bjud in fler (samma tråd) i rubriken.
        <div className={`flex flex-col ${BOX} overflow-hidden`}>
            <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-border bg-white/60 dark:bg-zinc-900/60">
                {privateHeader}
                {inviteButtons('icon')}
            </div>
            <ChatThread
                messages={privMessages}
                myUid={user.uid}
                emptyText="Inga meddelanden än - säg hej till ditt sällskap! 👋"
                placeholder="Skriv till ditt sällskap…"
                onSend={sendPrivate}
            />
        </div>
    ) : (
        // INTE MEDLEM (än): gå-med-vägen för inbjudna, annars bjud in-
        // knapparna. Reglerna inte ute → lugn inforad i stället.
        <div className={`${BOX} px-3 py-2.5 flex flex-col gap-2`}>
            {privateHeader}
            {privUnavailable ? (
                <p className="text-xs font-semibold text-slate-400">
                    Den privata chatten är inte aktiverad än - kom tillbaka lite senare.
                </p>
            ) : fran ? (
                <>
                    <p className="text-xs font-semibold text-slate-500">
                        Du är bjuden hit - häng med i den privata chatten för er som går ihop.
                    </p>
                    <div>
                        <button
                            type="button"
                            onClick={() => void handleJoin()}
                            disabled={joining}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#006AA7] px-3.5 py-2 text-xs font-black text-white hover:bg-[#005590] disabled:opacity-50 active:scale-95 transition"
                        >
                            <UserPlus size={14} strokeWidth={2.5} aria-hidden />
                            {joining ? 'Går med…' : 'Gå med i privata chatten'}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className="text-xs font-semibold text-slate-500">
                        Bjud in dem du vill ha med - bara ni som är med ser chatten, och de kan svara om de kommer direkt.
                    </p>
                    {inviteButtons('full')}
                </>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-2">
            {publicBlock}
            {privateBlock}
        </div>
    );
}
