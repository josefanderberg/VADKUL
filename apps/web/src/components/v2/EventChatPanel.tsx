'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { linkEventChatService } from '@/services/eventChatService';
import type { ChatMessage } from '@/types';
import toast from 'react-hot-toast';

interface Props {
    eventId: string;
    /** Öppna inloggningsmodalen (utan att lämna sidan). */
    onRequireLogin: () => void;
}

/**
 * Kompakt chatt för ett kart-event — bor i eventkortets utfällda läge.
 * Alla kan läsa; skriva kräver konto (CTA öppnar auth-modalen).
 */
export default function EventChatPanel({ eventId, onRequireLogin }: Props) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    // Auto-scrolla BARA på nya meddelanden efter första laddningen — annars
    // rycker kortet ner till chatten varje gång man öppnar ett event.
    const initialLoad = useRef(true);

    useEffect(() => {
        initialLoad.current = true;
        const unsubscribe = linkEventChatService.subscribeToMessages(eventId, setMessages);
        return () => unsubscribe();
    }, [eventId]);

    useEffect(() => {
        if (initialLoad.current) { initialLoad.current = false; return; }
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
            });
            setNewMessage('');
        } catch (error) {
            console.error(error);
            toast.error('Kunde inte skicka meddelandet.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col rounded-xl border border-border bg-slate-50 dark:bg-slate-900/40 overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-white/60 dark:bg-slate-900/60">
                <MessageCircle size={14} className="text-[#006AA7]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Chatt {messages.length > 0 && `· ${messages.length}`}
                </span>
            </div>

            <div className="max-h-56 overflow-y-auto p-3 space-y-2">
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
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-border rounded-bl-sm'
                            }`}>
                                {!isMe && (
                                    <p className="text-[10px] font-black text-[#006AA7] dark:text-sky-300 mb-0.5">
                                        {msg.senderName || 'Deltagare'}
                                    </p>
                                )}
                                <p className="break-words">{msg.text}</p>
                                <span className={`block text-right text-[9px] mt-0.5 ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                                    {time}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {user ? (
                <form onSubmit={handleSend} className="p-2 border-t border-border flex gap-2 bg-white/60 dark:bg-slate-900/60">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Skriv något…"
                        maxLength={500}
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-[#006AA7]/40 text-sm text-slate-800 dark:text-slate-100"
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
            ) : (
                <button
                    type="button"
                    onClick={onRequireLogin}
                    className="m-2 px-4 py-2 rounded-full bg-[#006AA7] text-white text-xs font-bold hover:bg-[#005590] transition-colors"
                >
                    Logga in för att chatta
                </button>
            )}
        </div>
    );
}
