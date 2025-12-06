import type { ReactNode } from 'react';
import Navbar from '../ui/Navbar'; // Kontrollera att sökvägen stämmer

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    // h-screen + overflow-hidden låser yttre ramen
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
      
      <Navbar />

      <main className="flex-1 overflow-y-auto pt-16">
        {children}
      </main>
      <div id="toast-container" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100]"></div>
    </div>
  );
}