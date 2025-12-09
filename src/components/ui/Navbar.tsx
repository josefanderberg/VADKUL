// src/components/layout/Navbar.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userService } from '../../services/userService';
import NotificationsMenu from '../ui/NotificationsMenu';
import {
  Sun, Moon,
  Plus, MessageSquare
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
    <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-slate-800 shadow-lg z-50 border-b border-slate-200 dark:border-slate-700 h-16 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-full flex justify-between items-center">

        {/* LOGO */}
        <Link to="/" className="text-3xl font-extrabold italic text-green-700 dark:text-green-500 tracking-tight hover:text-green-800 dark:hover:text-green-400 transition-colors">
          VADKUL
        </Link>

        <div className="flex items-center gap-3">

          {/* 1. SKAPA EVENT (Nu placerad FÖRE Theme Toggle) */}
          {user && (
            <Link to="/create" className="p-2 text-green-600 dark:text-green-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors" title="Skapa Event">
              <Plus size={24} strokeWidth={2.5} />
            </Link>
          )}

          {/* 2. THEME TOGGLE */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
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
              <Link to="/chat" className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                <MessageSquare size={20} />
              </Link>

              {/* PROFILBILD */}
              <Link to="/profile" className="block ml-1">
                {navImage ? (
                  // OM BILD FINNS
                  <img
                    src={navImage}
                    alt="Profil"
                    className="w-9 h-9 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700 shadow-sm hover:border-indigo-400 transition-colors"
                  />
                ) : (
                  // FALLBACK: Initialer
                  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-extrabold text-xs border-2 border-indigo-200 dark:border-indigo-700 shadow-sm hover:border-indigo-400 transition-colors">
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