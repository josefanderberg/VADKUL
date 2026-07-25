'use client';

import { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { AdminProvider } from '@/context/AdminContext';
import { useAuth } from '@/context/AuthContext';
import QueryProvider from './providers/QueryProvider';
import InstallPrompt from './pwa/InstallPrompt';
import { registerServiceWorker } from '@/utils/registerServiceWorker';
import { requestNotificationPermission, onForegroundMessage } from '@/utils/fcm';
import { notificationService } from '@/services/notificationService';
import toast, { Toaster } from 'react-hot-toast';

function FCMHandler() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // Token-UPPFRÄSCHNING, aldrig en prompt: permission-frågan ställs bara
        // från en riktig tap (profilpanelens notis-rad / gilla-nudgen) — en
        // gest-lös requestPermission() här avvisades alltid på iOS och gav
        // 0 registrerade tokens. Är tillståndet redan beviljat resolvar
        // requestNotificationPermission() utan UI och vi sparar om token på
        // det inloggade kontot (token är per enhet, kontot kan ha bytts).
        const refreshToken = async () => {
            if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
            const token = await requestNotificationPermission();
            if (token) {
                await notificationService.saveFCMToken(user.uid, token);
                console.log('FCM token saved for user:', user.uid);
            }
        };

        refreshToken().catch(console.error);

        // Handle foreground messages. Event-påminnelserna är data-only
        // (title/body i payload.data) — falla tillbaka på dem.
        const unsubscribe = onForegroundMessage((payload) => {
            const title = payload.notification?.title || payload.data?.title || 'VADKUL';
            const body = payload.notification?.body || payload.data?.body || 'Du har en ny notis';

            toast(`${title}\n${body}`, {
                icon: '🔔',
                duration: 6000,
            });
        });

        return () => unsubscribe();
    }, [user]);

    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        registerServiceWorker();
    }, []);

    return (
        <QueryProvider>
            <ThemeProvider>
                <AuthProvider>
                    <AdminProvider>
                        <FCMHandler />
                        {children}
                        <InstallPrompt />
                        {/* Renderar alla toast.error/success i appen — utan denna syns inga notiser. */}
                        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
                    </AdminProvider>
                </AuthProvider>
            </ThemeProvider>
        </QueryProvider>
    );
}
