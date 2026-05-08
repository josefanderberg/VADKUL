import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react'; // <-- Tog bort "User"
import { useAuth } from '../../context/AuthContext';
import { eventChatService } from '../../services/eventChatService';
import type { ChatMessage } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  eventId: string;
}

export default function EventChat({ eventId }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Lyssna på meddelanden
  useEffect(() => {
    const unsubscribe = eventChatService.subscribeToMessages(eventId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [eventId]);

  // Scrolla ner automatiskt vid nytt meddelande
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      await eventChatService.sendMessage(eventId, {
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Anonym',
        senderImage: user.photoURL || null,
        text: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
      toast.error('Kunde inte skicka meddelandet.');
    }
  };

  return (
    <div className="flex flex-col h-[60vh] md:h-[500px] bg-card rounded-xl border border-border overflow-hidden">

      {/* Meddelande-lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-10">
            <p>Inga meddelanden än.</p>
            <p className="text-sm">Bli den första att säga hej! 👋</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;

          // Säkerställ att vi kan hantera både Firestore Timestamp och vanliga Date-objekt (om det skulle behövas)
          // msg.createdAt är typad som Timestamp i interfacet
          let timeString = '';
          if (msg.createdAt && typeof msg.createdAt.toDate === 'function') {
            timeString = msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar (om inte jag) */}
                {!isMe && (
                  <div className="shrink-0">
                    {msg.senderImage ? (
                      <img src={msg.senderImage} alt={msg.senderName} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {(msg.senderName || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-2 shadow-sm text-sm relative group
                  ${isMe
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted/80 text-foreground border border-border rounded-bl-none'
                    }`}
                >
                  {!isMe && (
                    <p className="text-[10px] text-muted-foreground/80 font-bold mb-0.5">
                      {msg.senderName || 'Deltagare'}
                    </p>
                  )}
                  <p className="breaking-words">{msg.text}</p>
                  {/* Timestamp inside or outside? Lets put it tiny inside at bottom right or outside. Inside is cleaner but takes space. */}
                  <span className={`text-[9px] opacity-70 block text-right mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {timeString}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input fält */}
      <form onSubmit={handleSend} className="p-3 bg-card border-t border-border flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Skriv något..."
          className="flex-1 px-4 py-2 bg-muted/50 rounded-full focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}