// src/pages/Chat.tsx
import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, User as UserIcon } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chatService';
import { notificationService } from '../services/notificationService';
import type { ChatRoom, ChatMessage, AppNotification } from '../types';

export default function Chat() {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Data från navigation (när man klickade "Chatta" på profilen)
    // VIKTIGT: Spara initialTarget i ett state för att hantera rensning av URL-state.
    const [initialChatTarget, setInitialChatTarget] = useState(location.state?.targetUser);

    const [chats, setChats] = useState<ChatRoom[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);

    // NYTT: Hålla koll på notiser i chatten för att visa röda prickar
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    // 1. Ladda mina chattar
    useEffect(() => {
        if (!user) return;
        const unsub = chatService.subscribeToChats(user.uid, (data) => {
            setChats(data);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    // NYTT: Lyssna på notiser även här (för att se vilka konversationer som har olästa meddelanden)
    useEffect(() => {
        if (!user) return;
        const unsub = notificationService.subscribe(user.uid, (data) => {
            setNotifications(data);
        });
        return () => unsub();
    }, [user]);

    // 2. Initiera chatt från profilsidan om det behövs
    useEffect(() => {
        // Använd det lokala state-värdet
        if (initialChatTarget && user && !activeChatId) {
            const initChat = async () => {
                // Vi måste matcha UserProfile-typen bättre här
                const myProfile = {
                    uid: user.uid,
                    displayName: user.displayName || 'Jag',
                    email: user.email || '',
                    verificationImage: user.photoURL || null,
                    age: 0,
                    isVerified: false,
                    createdAt: new Date()
                } as any;

                try {
                    const chatId = await chatService.createOrGetChat(myProfile, initialChatTarget);
                    setActiveChatId(chatId);

                    // NY LOGIK: Rensa location.state HELT efter att chatten är skapad.
                    if (location.state?.targetUser) {
                        navigate(location.pathname, { replace: true });
                    }
                    // Rensa det lokala state-värdet också
                    setInitialChatTarget(undefined);

                } catch (error) {
                    console.error("Kunde inte starta chatt:", error);
                }
            };
            initChat();
        }
    }, [initialChatTarget, user, activeChatId, location.pathname, location.state, navigate]);

    // 3. Lyssna på meddelanden i vald chatt
    useEffect(() => {
        if (!activeChatId) return;
        const unsub = chatService.subscribeToMessages(activeChatId, (msgs) => {
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsub();
    }, [activeChatId]);

    // NYTT: Markera notiser för denna chatt som lästa när vi öppnar den
    useEffect(() => {
        if (!activeChatId || !user || !chats.length) return;

        const currentChat = chats.find(c => c.id === activeChatId);
        if (!currentChat) return;

        const otherId = currentChat.participants.find(p => p !== user.uid);
        if (!otherId) return;

        // Kolla om vi har några olästa notiser från denna person av typen 'chat'
        const hasUnread = notifications.some(n =>
            n.senderId === otherId && n.type === 'chat' && !n.read
        );

        if (hasUnread) {
            notificationService.markChatNotificationsAsRead(user.uid, otherId);
        }

    }, [activeChatId, user, chats, notifications]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChatId || !user) return;

        // Spara meddelandet temporärt och rensa input direkt för bättre känsla
        const msgToSend = newMessage;
        setNewMessage('');

        try {
            await chatService.sendMessage(activeChatId, user.uid, msgToSend);

            // --- SKICKA NOTIS TILL MOTTAGAREN ---
            const currentChat = chats.find(c => c.id === activeChatId);

            // Hitta ID på den som INTE är jag
            const otherId = currentChat?.participants.find(p => p !== user.uid);

            if (otherId) {
                await notificationService.send({
                    recipientId: otherId,
                    senderId: user.uid,
                    senderName: user.displayName || 'Någon',
                    senderImage: user.photoURL || null,
                    type: 'chat',
                    message: `skickade ett meddelande.`,
                    link: '/chat' // Länka till chatten
                });
            }
            // ------------------------------------

        } catch (err) {
            console.error("Fel vid sändning:", err);
        }
    };

    const handleBack = () => {
        if (chats.length === 0 && initialChatTarget) {
            navigate(-1);
        } else {
            setActiveChatId(null);
        }
    }

    const getOtherParticipant = (chat: ChatRoom) => {
        if (!user) return null;
        const otherId = chat.participants.find(p => p !== user.uid);
        if (!otherId) return null;
        return chat.participantDetails[otherId];
    };

    // Hjälpfunktion för att kolla om en chatt har olästa meddelanden
    const hasUnreadMessages = (chat: ChatRoom) => {
        if (!user) return false;
        const otherId = chat.participants.find(p => p !== user.uid);
        if (!otherId) return false;

        return notifications.some(n =>
            n.senderId === otherId && n.type === 'chat' && !n.read
        );
    };

    const formatTime = (date: any) => {
        if (!date) return '';
        // Konvertera Firestore timestamp till Date om det behövs
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!user) return null;

    const showList = !activeChatId;
    const showChat = activeChatId;

    return (
        <Layout>
            <div className="max-w-5xl mx-auto h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] flex bg-card md:rounded-2xl md:shadow-xl md:border md:border-border overflow-hidden">

                {/* --- VÄNSTERSPALT (Chattlista) --- */}
                <div className={`w-full md:w-80 border-r border-border flex flex-col ${showList ? 'block' : 'hidden md:flex'}`}>
                    <div className="p-4 border-b border-border">
                        <h2 className="font-extrabold text-xl text-foreground">Meddelanden</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {chats.length === 0 && !loading && (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                Inga chattar än. Gå in på någons profil för att börja snacka!
                            </div>
                        )}
                        {chats.map(chat => {
                            const other = getOtherParticipant(chat);
                            const isActive = chat.id === activeChatId;
                            const isUnread = hasUnreadMessages(chat);

                            return (
                                <button
                                    key={chat.id}
                                    onClick={() => setActiveChatId(chat.id)}
                                    className={`w-full p-4 flex items-center gap-3 transition-colors border-b border-border/50 relative
                                ${isActive ? 'bg-primary/5' : 'hover:bg-muted/50'}
                            `}
                                >
                                    {isUnread && (
                                        <span className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-destructive"></span>
                                    )}

                                    {other?.photoURL ? (
                                        <img src={other.photoURL} className="w-12 h-12 rounded-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <UserIcon size={20} />
                                        </div>
                                    )}
                                    <div className="text-left overflow-hidden flex-1">
                                        <div className="flex justify-between items-center">
                                            <p className={`font-bold truncate ${isUnread ? 'text-primary' : 'text-foreground'}`}>
                                                {other?.displayName || 'Okänd'}
                                            </p>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                                {chat.lastUpdated ? formatTime(chat.lastUpdated) : ''}
                                            </span>
                                        </div>
                                        <p className={`text-xs truncate ${isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                            {chat.lastMessage || 'Starta konversationen...'}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* --- HÖGERSPALT (Aktiv chatt) --- */}
                <div className={`flex-1 flex flex-col bg-muted/20 ${showChat ? 'block' : 'hidden md:flex'}`}>

                    {activeChatId ? (
                        <>
                            {/* Header */}
                            <div className="p-4 bg-card border-b border-border flex items-center gap-3 shadow-sm z-10">
                                <button onClick={handleBack} className="md:hidden p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-full">
                                    <ArrowLeft size={20} />
                                </button>
                                {(() => {
                                    const chat = chats.find(c => c.id === activeChatId);
                                    const other = chat ? getOtherParticipant(chat) : null;
                                    const otherId = chat?.participants.find(p => p !== user?.uid);

                                    return (
                                        <div
                                            onClick={() => otherId && navigate(`/public-profile/${otherId}`)}
                                            className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity"
                                            title="Gå till profil"
                                        >
                                            {other?.photoURL && (
                                                <img src={other.photoURL} className="w-8 h-8 rounded-full object-cover md:hidden" alt="" />
                                            )}
                                            <div className="font-bold text-foreground">
                                                {other ? other.displayName : 'Chatt'}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Meddelanden */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((msg) => {
                                    const isMe = msg.senderId === user.uid;
                                    return (
                                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${isMe
                                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                : 'bg-card text-foreground shadow-sm border border-border rounded-tl-none'
                                                }`}>
                                                {msg.text}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground mt-1 px-1 opacity-70">
                                                {formatTime(msg.createdAt)}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div ref={scrollRef} />
                            </div>

                            {/* Input */}
                            <div className="p-4 bg-card border-t border-border">
                                <form onSubmit={handleSend} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Skriv ett meddelande..."
                                        className="flex-grow p-3 rounded-xl bg-muted border-transparent focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all text-foreground"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className="p-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
                                    >
                                        <Send size={20} />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
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