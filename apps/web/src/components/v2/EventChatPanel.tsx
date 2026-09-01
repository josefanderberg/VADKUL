'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, ChevronDown, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { linkEventChatService } from '@/services/eventChatService';
import type { ChatMessage } from '@/types';
import toast from 'react-hot-toast';

interface Props {
    eventId: string;
    /** Eventtiteln — följer med till senaste-kommentar-bubblan på kartan. */
    eventTitle?: string;
    /** Öppna inloggningsmodalen (utan att lämna sidan). */
    onRequireLogin: () => void;
}

/**
 * Kompakt chatt för ett kart-event — bor i eventkortets utfällda läge.
 * KRÄVER KONTO FÖR ATT ENS LÄSAS (Josef 31/8; ersätter den öppna läsningen):
 * utloggade möts av en låst rad — "Logga in för att se chatten" — som öppnar
 * auth-modalen. Ingen prenumeration startas då, så utloggade kostar noll
 * Firestore-läsningar (chatten låg tidigare och lyssnade på VARJE öppnat kort).
 * INFÄLLD tills någon faktiskt skrivit något (Josef 30/8): en tom chatt är
 * mest en tom ruta — utan meddelanden visas bara en rad man kan fälla upp.
 */
export default function EventChatPanel({ eventId, eventTitle, onRequireLogin }: Props) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    // Manuellt uppfälld trots tom chatt (för att bli först att skriva).
    const [expanded, setExpanded] = useState(false);
    // Scrolla ENBART chattens egen meddelandelista (aldrig scrollIntoView —
    // den scrollar alla scrollbara föräldrar och drog ner hela eventkortet
    // till chatten när serverns första snapshot landade efter mount).
    const listRef = useRef<HTMLDivElement>(null);

    // uid (inte user-objektet) som effekt-nyckel: AuthContext byter referens
    // vid token-refresh och skulle annars riva upp lyssnaren i onödan.
    const uid = user?.uid ?? null;
    useEffect(() => {
        // Eventbyte återanvänder komponenten (ingen key i EventCard) — börja
        // om hopfällt och utan förra eventets meddelanden.
        setExpanded(false);
        setMessages([]);
        // Utloggad = ingen lyssnare alls. Chatten är låst (se den låsta raden
        // nedan), och en prenumeration hade bara bränt läsningar på innehåll
        // som ändå inte visas. Loggar man in monteras lyssnaren direkt (uid
        // byter värde) så chatten dyker upp utan att kortet behöver stängas.
        if (!uid) return;
        const unsubscribe = linkEventChatService.subscribeToMessages(eventId, setMessages);
        return () => unsubscribe();
    }, [eventId, uid]);

    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;   // rör bara den inre listan
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || sending) return;
        setSending(true);
        try {
            await linkEventChatService.sendMessage(eventId, {
                senderId: user.uid,
                senderName: user.displayName || user.email || 'Anonym',
                senderImage: user.photoURL || null,
                text: newMessage.trim(),
            }, eventTitle);
            setNewMessage('');
        } catch (error) {
            console.error(error);
            toast.error('Kunde inte skicka meddelandet.');
        } finally {
            setSending(false);
        }
    };

    // UTLOGGAD: chatten är låst (Josef 31/8). Samma rad-format som det
    // hopfällda läget, men hänglås i stället för chevron — den lovar inget
    // som inte går att fälla upp. Klick öppnar auth-modalen.
    if (!user) {
        return (
            <button
                type="button"
                onClick={onRequireLogin}
                className="flex items-center gap-2 rounded-xl border border-border bg-slate-50 dark:bg-zinc-900/40 px-3 py-2.5 text-left hover:border-[#006AA7]/40 transition-colors"
            >
                <MessageCircle size={14} className="text-[#006AA7] shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">Chatt</span>
                <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#006AA7]">
                    Logga in för att se chatten
                </span>
                <Lock size={13} className="text-slate-400 shrink-0" aria-hidden />
            </button>
        );
    }

    // Hopfällt läge: inga meddelanden och inte manuellt uppfälld — bara en
    // rad som visar att chatten finns. Klick fäller upp hela panelen.
    if (messages.length === 0 && !expanded) {
        return (
            <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-expanded={false}
                className="flex items-center gap-2 rounded-xl border border-border bg-slate-50 dark:bg-zinc-900/40 px-3 py-2.5 text-left hover:border-[#006AA7]/40 transition-colors"
            >
                <MessageCircle size={14} className="text-[#006AA7] shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">Chatt</span>
                <span className="flex-1 min-w-0 truncate text-xs font-semibold text-slate-400">
                    Inga meddelanden än — bli först att säga hej! 👋
                </span>
                <ChevronDown size={14} className="text-slate-400 shrink-0" aria-hidden />
            </button>
        );
    }

    return (
        <div className="flex flex-col rounded-xl border border-border bg-slate-50 dark:bg-zinc-900/40 overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-white/60 dark:bg-zinc-900/60">
                <MessageCircle size={14} className="text-[#006AA7]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Chatt {messages.length > 0 && `· ${messages.length}`}
                </span>
            </div>

            <div ref={listRef} className="max-h-56 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                    <p className="text-center text-xs font-semibold text-slate-400 py-3">
                        Inga meddelanden än — bli först att säga hej! 👋
                    </p>
                )}
                {messages.map((msg) => {
                    const isMe = msg.senderId === user?.uid;
                    const time = msg.createdAt && typeof (msg.createdAt as any).toDate === 'function'
                        ? (msg.createdAt as any).toDate().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                        : '';
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm shadow-sm ${
                                isMe
                                    ? 'bg-[#006AA7] text-white rounded-br-sm'
                                    : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-border rounded-bl-sm'
                            }`}>
                                {/* Användarnamnet syns på ALLA kommentarer — även ens egna,
                                    så man ser hur man framstår för andra. */}
                                <p className={`text-[10px] font-black mb-0.5 ${isMe ? 'text-white/85' : 'text-[#006AA7] dark:text-sky-300'}`}>
                                    {isMe ? `${msg.senderName || 'Du'} (du)` : (msg.senderName || 'Deltagare')}
                                </p>
                                <p className="break-words">{msg.text}</p>
                                <span className={`block text-right text-[9px] mt-0.5 ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                                    {time}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Inget "logga in för att chatta"-läge längre: hit kommer man
                bara som inloggad (utloggade fastnar på den låsta raden ovan). */}
            <form onSubmit={handleSend} className="p-2 border-t border-border flex gap-2 bg-white/60 dark:bg-zinc-900/60">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Skriv något…"
                    aria-label="Skriv ett chattmeddelande"
                    maxLength={500}
                    className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-[#006AA7]/40 text-sm text-slate-800 dark:text-zinc-100"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    aria-label="Skicka"
                    className="p-2 bg-[#006AA7] text-white rounded-full hover:bg-[#005590] disabled:opacity-40 transition-colors"
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}
