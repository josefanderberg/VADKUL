// src/pages/Chat.tsx
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, ArrowLeft, User as UserIcon } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chatService';
import { notificationService } from '../services/notificationService'; // <--- NY IMPORT
import type { ChatRoom, ChatMessage } from '../types';

export default function Chat() {
  const { user } = useAuth();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Data från navigation (när man klickade "Chatta" på profilen)
  const initialTarget = location.state?.targetUser; 

  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Ladda mina chattar
  useEffect(() => {
    if (!user) return;
    const unsub = chatService.subscribeToChats(user.uid, (data) => {
      setChats(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);


  
  useEffect(() => {
    if (initialTarget && user && !activeChatId) {
      const initChat = async () => {
        // Vi måste matcha UserProfile-typen bättre här
        const myProfile = {
            uid: user.uid,
            displayName: user.displayName || 'Jag',
            email: user.email || '',
            // LÄGG TILL DETTA: Använd photoURL från auth eller null
            verificationImage: user.photoURL || null, 
            age: 0, 
            isVerified: false, 
            createdAt: new Date()
        } as any; // Tvinga typen om det behövs för att matcha UserProfile

        try {
            const chatId = await chatService.createOrGetChat(myProfile, initialTarget);
            setActiveChatId(chatId);
            // Rensa state så vi inte loopar om sidan laddas om
            window.history.replaceState({}, document.title);
        } catch (error) {
            console.error("Kunde inte starta chatt:", error);
        }
      };
      initChat();
    }
  }, [initialTarget, user, activeChatId]);

  // 3. Lyssna på meddelanden i vald chatt
  useEffect(() => {
    if (!activeChatId) return;
    const unsub = chatService.subscribeToMessages(activeChatId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [activeChatId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId || !user) return;
    
    try {
        await chatService.sendMessage(activeChatId, user.uid, newMessage);
        
        // --- SKICKA NOTIS TILL MOTTAGAREN ---
        const currentChat = chats.find(c => c.id === activeChatId);
        // Hitta ID på den som INTE är jag
        const otherId = currentChat?.participants.find(p => p !== user.uid);

        if (otherId) {
            await notificationService.send({
                recipientId: otherId,
                senderId: user.uid,
                senderName: user.displayName || 'Någon',
                senderImage: user.photoURL || undefined,
                type: 'chat',
                message: `skickade ett meddelande.`,
                link: '/chat' // Länka till chatten
            });
        }
        // ------------------------------------

        setNewMessage('');
    } catch (err) {
        console.error("Fel vid sändning:", err);
    }
  };

  const getOtherParticipant = (chat: ChatRoom) => {
    if (!user) return null;
    const otherId = chat.participants.find(p => p !== user.uid);
    if (!otherId) return null;
    return chat.participantDetails[otherId];
  };

  if (!user) return null;

  const showList = !activeChatId;
  const showChat = activeChatId;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] flex bg-white dark:bg-slate-800 md:rounded-2xl md:shadow-xl md:border md:border-slate-200 dark:md:border-slate-700 overflow-hidden">
        
        {/* --- VÄNSTERSPALT --- */}
        <div className={`w-full md:w-80 border-r border-slate-100 dark:border-slate-700 flex flex-col ${showList ? 'block' : 'hidden md:flex'}`}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-extrabold text-xl dark:text-white">Meddelanden</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto">
                {chats.length === 0 && !loading && (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        Inga chattar än. Gå in på någons profil för att börja snacka!
                    </div>
                )}
                {chats.map(chat => {
                    const other = getOtherParticipant(chat);
                    const isActive = chat.id === activeChatId;
                    return (
                        <button 
                            key={chat.id}
                            onClick={() => setActiveChatId(chat.id)}
                            className={`w-full p-4 flex items-center gap-3 transition-colors border-b border-slate-50 dark:border-slate-700/50
                                ${isActive ? 'bg-indigo-50 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}
                            `}
                        >
                            {other?.photoURL ? (
                                <img src={other.photoURL} className="w-12 h-12 rounded-full object-cover" alt="" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                                    <UserIcon size={20} />
                                </div>
                            )}
                            <div className="text-left overflow-hidden">
                                <p className="font-bold text-slate-900 dark:text-white truncate">{other?.displayName || 'Okänd'}</p>
                                <p className="text-xs text-slate-500 truncate">{chat.lastMessage || 'Starta konversationen...'}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* --- HÖGERSPALT --- */}
        <div className={`flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/50 ${showChat ? 'block' : 'hidden md:flex'}`}>
            
            {activeChatId ? (
                <>
                    {/* Header */}
                    <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 shadow-sm z-10">
                        <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 -ml-2 text-slate-500">
                            <ArrowLeft size={20} />
                        </button>
                        {(() => {
                             const chat = chats.find(c => c.id === activeChatId);
                             const other = chat ? getOtherParticipant(chat) : null;
                             return (
                                <div className="font-bold text-slate-900 dark:text-white">
                                    {other ? other.displayName : 'Chatt'}
                                </div>
                             );
                        })()}
                    </div>

                    {/* Meddelanden */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg) => {
                            const isMe = msg.senderId === user.uid;
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                                        isMe 
                                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                                        : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-600 rounded-tl-none'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={scrollRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                        <form onSubmit={handleSend} className="flex gap-2">
                            <input 
                                type="text" 
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Skriv ett meddelande..."
                                className="flex-grow p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                            />
                            <button 
                                type="submit" 
                                disabled={!newMessage.trim()}
                                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
                            >
                                <Send size={20} />
                            </button>
                        </form>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                        <Send size={32} className="opacity-50" />
                    </div>
                    <p>Välj en konversation för att börja chatta.</p>
                </div>
            )}
        </div>

      </div>
    </Layout>
  );
}