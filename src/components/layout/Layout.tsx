import type { ReactNode } from 'react';
import Navbar from '../ui/Navbar';
// NYTT: Importera Toaster
import { Toaster } from 'react-hot-toast'; // Lägg till denna import

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    // h-screen + overflow-hidden låser yttre ramen
    <div className="h-screen overflow-hidden flex flex-col bg-background transition-colors">

      <Navbar />

      <main className="flex-1 overflow-y-auto pt-16">
        {children}
      </main>

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