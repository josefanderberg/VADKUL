import type { ReactNode } from 'react';
import Navbar from '../ui/Navbar';
// NYTT: Importera Toaster
import { Toaster } from 'react-hot-toast'; // Lägg till denna import

interface LayoutProps {
  children: ReactNode;
}

import { useAdmin } from '../../context/AdminContext';
import { Crown } from 'lucide-react';

export default function Layout({ children }: LayoutProps) {
  const { isAdmin } = useAdmin();
  return (
    // min-h-screen ser till att bakgrunden täcker hela sidan, men låter body scrolla
    <div className="min-h-screen flex flex-col bg-background transition-colors">

      <Navbar />

      <main className="flex-1 pt-16">
        {children}
      </main>

      {/* <InstallPrompt /> */}

      {isAdmin && (
        <div className="fixed top-20 right-4 z-[100] pointer-events-none animate-pulse">
          <div className="bg-yellow-100/80 backdrop-blur-sm p-2 rounded-full border-2 border-yellow-400 shadow-lg text-yellow-600">
            <Crown size={24} fill="currentColor" />
          </div>
        </div>
      )}

      {/* FIX: Byt ut den tomma div:en mot Toaster-komponenten */}
      <Toaster
        position="top-center" // Standardposition
        toastOptions={{
          // Anpassa stilen för att matcha designen
          style: {
            padding: '16px',
            fontWeight: 'bold',
            color: '#1e293b', // Slate-900
          },
        }}
      />
    </div>
  );
}