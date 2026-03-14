// src/components/layout/Navbar.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userService } from '../../services/userService';
import { notificationService } from '../../services/notificationService';
import NotificationsMenu from '../ui/NotificationsMenu';
import {
  Sun, Moon,
  Plus, MessageSquare, Info
} from 'lucide-react';
import type { AppNotification } from '../../types';

export default function Navbar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State för bilden i navbaren - Initiera med null för SSR, hämta i useEffect
  const [navImage, setNavImage] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem('cached_avatar_url');
    // Using setTimeout to prevent React warning about synchronous state updates inside effect
    if (cached) setTimeout(() => setNavImage(cached), 0);
  }, []);

  // State för notiser (Flyttad från NotificationsMenu)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Highlight-sekvens för oinloggade (Info -> Tema -> Tema -> Login)
  const [activeHighlight, setActiveHighlight] = useState<'info' | 'theme' | 'login' | null>(null);

  useEffect(() => {
    if (user) return;

    const runSequence = async () => {
      // 1. Info icon (1s)
      setActiveHighlight('info');
      await new Promise(r => setTimeout(r, 1000));
      setActiveHighlight(null);

      // 2. 1 sek senare den darkmode knappen i 1 sekund
      await new Promise(r => setTimeout(r, 1000));
      setActiveHighlight('theme');
      await new Promise(r => setTimeout(r, 1000));
      setActiveHighlight(null);

      // 3. sen till baka 2 sek (Då ska info kanppen tändas i en sekund)
      await new Promise(r => setTimeout(r, 500));
      setActiveHighlight('info');
      await new Promise(r => setTimeout(r, 1000));
      setActiveHighlight(null);
      await new Promise(r => setTimeout(r, 500));

      // 4. sen till dark igen i 0.5 s
      setActiveHighlight('theme');
      await new Promise(r => setTimeout(r, 500));
      setActiveHighlight(null);

      // 5. och sen login/registrera i en sekund (direkt efter)
      setActiveHighlight('login');
      await new Promise(r => setTimeout(r, 1000));
      setActiveHighlight(null);
    };

    // Kör direkt vid laddning
    const initialTimer = setTimeout(runSequence, 1000);
    // Upprepa var tjugonde sekund för en lagom paus
    const interval = setInterval(runSequence, 20000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [user]);

  // Hämta bilden från databasen när användaren ändras
  useEffect(() => {
    if (user?.uid) {
      // VIKTIGT: Vi använder INTE user.photoURL direkt längre, eftersom det kan vara verifikationsbilden.
      // Däremot kan vi kolla om vi redan har en cachad bild.

      userService.getUserProfile(user.uid).then(profile => {
        if (profile?.photoURL) {
          setNavImage(profile.photoURL);
          // Uppdatera cachen
          localStorage.setItem('cached_avatar_url', profile.photoURL);
        } else {
          // Om ingen bild finns i profilen heller, rensa cachen om den fanns?
          // Eller behåll "null" så initialerna visas.
          // setNavImage(null); 
          // Vi låter bli att rensa här för att inte flimra om fetch misslyckas tillfälligt,
          // men om man vill vara strikt:
          // localStorage.removeItem('cached_avatar_url');
        }
      });
    } else {
      setTimeout(() => setNavImage(null), 0);
      localStorage.removeItem('cached_avatar_url'); // Rensa vid utloggning
    }
  }, [user]);

  // Hämta notiser
  useEffect(() => {
    if (!user) return;
    const unsub = notificationService.subscribe(user.uid, (data) => {
      setNotifications(data);
    });
    return () => unsub();
  }, [user]);

  const getInitials = () => {
    if (!user?.email) return '??';
    return (user.displayName || user.email).substring(0, 2).toUpperCase();
  };

  // Filtrera notiser
  // 'chat' går till chatt-ikonen
  // Allt annat går till klockan
  const chatNotifications = notifications.filter(n => n.type === 'chat');
  const generalNotifications = notifications.filter(n => n.type !== 'chat');

  const unreadChatCount = chatNotifications.filter(n => !n.read).length;

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Om vi är på startsidan, växla mellan karta och lista
    if (pathname === '/') {
      const currentView = searchParams.get('view') || 'map';
      const nextView = currentView === 'map' ? 'list' : 'map';
      router.push(`/?view=${nextView}`);
    } else {
      // Om vi kommer från en annan sida, gå direkt till kartan
      router.push('/?view=map');
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-card/80 backdrop-blur-md shadow-sm z-50 border-b border-border h-16 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-full flex justify-between items-center">

        {/* LOGO */}
        <Link 
          href="/" 
          onClick={handleLogoClick}
          className="text-3xl font-extrabold italic text-primary tracking-tight hover:text-primary/90 transition-colors"
        >
          VADKUL
        </Link>

        <div className="flex items-center gap-0.5 md:gap-2">

          {/* 1. SKAPA EVENT (Nu placerad FÖRE Theme Toggle) */}
          {/* 1. SKAPA EVENT (Nu placerad FÖRE Theme Toggle) */}
          <Link href="/create" className="p-1.5 md:p-2 text-primary hover:bg-accent hover:text-accent-foreground rounded-full transition-colors" title="Skapa Event">
            <Plus size={24} strokeWidth={2.5} />
          </Link>

          {/* 1.5 INFO (Ny) */}
          <Link
            href="/about"
            className={[
              'p-1.5 md:p-2 rounded-full transition-all duration-300 ease-in-out',
              activeHighlight === 'info'
                ? 'bg-accent text-accent-foreground scale-110 shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground scale-100',
            ].join(' ')}
            title="Om VADKUL"
          >
            <Info size={22} />
          </Link>

          {/* 2. THEME TOGGLE */}
          <button
            onClick={toggleTheme}
            className={[
              'p-1.5 md:p-2 rounded-full transition-all duration-300 ease-in-out',
              activeHighlight === 'theme'
                ? 'bg-accent text-accent-foreground scale-110 shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground scale-100',
              !user ? 'mr-3' : ''
            ].join(' ')}
            title="Växla tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* 3. RESTERANDE MENY (Notiser, Chatt, Profil eller Login) */}
          {user ? (
            <>
              {/* NOTISER (Endast generella) */}
              <NotificationsMenu notifications={generalNotifications} />

              {/* CHATT */}
              <Link href="/chat" className="p-1.5 md:p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors relative">
                <MessageSquare size={20} />
                {unreadChatCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-background animate-in zoom-in">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </Link>

              {/* PROFILBILD */}
              <Link href="/profile" className="block ml-1 shrink-0">
                {navImage ? (
                  // OM BILD FINNS
                  <img
                    src={navImage}
                    alt="Profil"
                    className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border-2 border-border shadow-sm hover:border-ring transition-colors"
                  />
                ) : (
                  // FALLBACK: Initialer
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-extrabold text-xs border-2 border-border shadow-sm hover:border-ring transition-colors">
                    {getInitials()}
                  </div>
                )}
              </Link>
            </>
          ) : (
            /* LOGGA IN KNAPP */
            <Link
              href="/login"
              className={[
                'px-3 py-2 text-sm font-semibold rounded-lg text-white shadow-md transition-all duration-300',
                activeHighlight === 'login'
                  ? 'bg-indigo-500 scale-105 shadow-lg'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
              ].join(' ')}
            >
              <span className="min-[450px]:hidden">Logga in</span>
              <span className="hidden min-[450px]:inline">Logga In / Registrera</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}