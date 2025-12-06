import type { ReactNode } from 'react'; // ÄNDRAT: lade till "type"
import Navbar from '../ui/Navbar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 font-sans">
      <Navbar />
      <main className="pt-16 min-h-screen">
        {children}
      </main>
      <div id="toast-container" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100]"></div>
    </div>
  );
}