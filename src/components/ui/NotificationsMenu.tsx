// src/components/ui/NotificationsMenu.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import type { AppNotification } from '../../types';

export default function NotificationsMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Lyssna på notiser
  useEffect(() => {
    if (!user) return;
    const unsub = notificationService.subscribe(user.uid, (data) => {
      setNotifications(data);
    });
    return () => unsub();
  }, [user]);

  // Stäng om man klickar utanför
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClickNotif = async (notif: AppNotification) => {
    await notificationService.markAsRead(notif.id);
    setIsOpen(false);
    if (notif.link) navigate(notif.link);
  };

  const markAllRead = async () => {
    if (user) await notificationService.markAllAsRead(user.uid);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* BELL BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 md:p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-colors relative"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-background animate-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* DROPDOWN */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-card rounded-2xl shadow-xl border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">

          <div className="p-3 border-b border-border flex justify-between items-center bg-muted/30">
            <h3 className="font-bold text-sm text-foreground">Notiser</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-indigo-600 hover:underline">
                Markera alla lästa
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Inga notiser än.
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  className={`w-full text-left p-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0
                                ${!n.read ? 'bg-primary/5' : ''}
                            `}
                >
                  <div className="shrink-0 pt-1">
                    {n.senderImage ? (
                      <img src={n.senderImage} className="w-8 h-8 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User size={14} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-bold">{n.senderName}</span> {n.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}