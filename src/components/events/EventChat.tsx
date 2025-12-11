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
        text: newMessage.trim(),
        // Vi kan spara displayNamn här också om vi vill slippa slå upp det
        // men för enkelhetens skull använder vi senderId
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

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm text-sm 
                ${isMe
                  ? 'bg-primary text-primary-foreground rounded-br-none'
                  : 'bg-muted/80 text-foreground border border-border rounded-bl-none'
                }`}
              >
                {!isMe && <p className="text-[10px] text-muted-foreground/80 font-bold mb-1">Deltagare</p>}
                <p>{msg.text}</p>
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