// src/components/layout/Navbar.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userService } from '../../services/userService';
import NotificationsMenu from '../ui/NotificationsMenu';
import {
  Sun, Moon,
  Plus, MessageSquare, Info
} from 'lucide-react'; // Tog bort LogOut från importen

export default function Navbar() {
  const { user } = useAuth(); // Tog bort logout härifrån då den inte används
  const { theme, toggleTheme } = useTheme();

  // State för bilden i navbaren
  const [navImage, setNavImage] = useState<string | null>(null);

  // Hämta bilden från databasen när användaren ändras
  useEffect(() => {
    if (user?.uid) {
      // 1. Sätt först Auth-bilden om den finns (snabbast)
      if (user.photoURL) setNavImage(user.photoURL);

      // 2. Hämta den "riktiga" bilden från Firestore för att vara säker
      userService.getUserProfile(user.uid).then(profile => {
        if (profile?.photoURL) {
          setNavImage(profile.photoURL);
        } else if (profile?.verificationImage) {
          setNavImage(profile.verificationImage);
        }
      });
    } else {
      setNavImage(null);
    }
  }, [user]);

  const getInitials = () => {
    if (!user?.email) return '??';
    return (user.displayName || user.email).substring(0, 2).toUpperCase();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-card/80 backdrop-blur-md shadow-sm z-50 border-b border-border h-16 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-full flex justify-between items-center">

        {/* LOGO */}
        <Link to="/" className="text-3xl font-extrabold italic text-primary tracking-tight hover:text-primary/90 transition-colors">
          VADKUL
        </Link>

        <div className="flex items-center gap-0.5 md:gap-2">

          {/* 1. SKAPA EVENT (Nu placerad FÖRE Theme Toggle) */}
          {user && (
            <Link to="/create" className="p-1.5 md:p-2 text-primary hover:bg-accent hover:text-accent-foreground rounded-full transition-colors" title="Skapa Event">
              <Plus size={24} strokeWidth={2.5} />
            </Link>
          )}

          {/* 1.5 INFO (Ny) */}
          <Link to="/about" className="p-1.5 md:p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors" title="Om VADKUL">
            <Info size={22} />
          </Link>

          {/* 2. THEME TOGGLE */}
          <button
            onClick={toggleTheme}
            className="p-1.5 md:p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors"
            title="Växla tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* 3. RESTERANDE MENY (Notiser, Chatt, Profil eller Login) */}
          {user ? (
            <>
              {/* NOTISER */}
              <NotificationsMenu />

              {/* CHATT */}
              <Link to="/chat" className="p-1.5 md:p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors">
                <MessageSquare size={20} />
              </Link>

              {/* PROFILBILD */}
              <Link to="/profile" className="block ml-1 shrink-0">
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
            <Link to="/login" className="px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-colors active:scale-95">
              Logga In / Registrera
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}