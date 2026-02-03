'use client';

import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { AdminProvider } from '@/context/AdminContext';
import QueryProvider from './providers/QueryProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryProvider>
            <ThemeProvider>
                <AuthProvider>
                    <AdminProvider>
                        {children}
                    </AdminProvider>
                </AuthProvider>
            </ThemeProvider>
        </QueryProvider>
    );
}
