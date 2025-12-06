// src/components/layout/Navbar.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  Sun, Moon, LogOut, 
  Plus, MessageSquare, Bell 
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Hämtar initialer från e-post eller display name
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
            
            {/* THEME TOGGLE */}
            <button 
                onClick={toggleTheme} 
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                title="Växla tema"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {user ? (
                <>
                    {/* SKAPA EVENT (Syns bara när inloggad) */}
                    <Link to="/create" className="p-2 text-green-600 dark:text-green-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors" title="Skapa Event">
                        <Plus size={24} strokeWidth={2.5} />
                    </Link>

                    {/* NOTISER (Mockad) */}
                    <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors relative">
                        <Bell size={20} />
                        <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-800"></span>
                    </button>

                    {/* CHATT */}
                    <Link to="/chat" className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <MessageSquare size={20} />
                    </Link>

                    {/* PROFIL */}
                    <Link to="/profile" className="block ml-1">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-extrabold text-xs border-2 border-indigo-200 dark:border-indigo-700 shadow-sm hover:border-indigo-400 transition-colors">
                            {getInitials()}
                        </div>
                    </Link>

                    {/* LOGGA UT */}
                    <button onClick={() => logout()} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors" title="Logga ut">
                        <LogOut size={20} />
                    </button>
                </>
            ) : (
                /* LOGGA IN KNAPP (Om utloggad) */
                <Link to="/login" className="px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-colors active:scale-95">
                    Logga In / Registrera
                </Link>
            )}
        </div>
      </div>
    </nav>
  );
}