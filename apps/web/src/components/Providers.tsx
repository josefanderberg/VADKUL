'use client';

import { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { AdminProvider } from '@/context/AdminContext';
import { useAuth } from '@/context/AuthContext';
import QueryProvider from './providers/QueryProvider';
import InstallPrompt from './pwa/InstallPrompt';
import { registerServiceWorker } from '@/utils/registerServiceWorker';
import { refreshDeviceToken, onForegroundMessage } from '@/utils/fcm';
import { shouldCheckOnResume } from '@/utils/fcmTokenSync';
import toast, { Toaster } from 'react-hot-toast';

function FCMHandler() {
    const { user } = useAuth();
    // uid, inte user-objektet: profiländringar byter objektet (setUser({...}))
    // och körde om hela effekten i onödan.
    const uid = user?.uid ?? null;

    useEffect(() => {
        if (!uid) return;

        // Token-UPPFRÄSCHNING, aldrig en prompt: permission-frågan ställs bara
        // från en riktig tap (profilpanelens notis-rad / gilla-nudgen) — en
        // gest-lös requestPermission() här avvisades alltid på iOS och gav
        // 0 registrerade tokens. refreshDeviceToken gör inget utan beviljat
        // tillstånd och skriver bara när tokenen är ny/roterad eller dygnet
        // gått (utils/fcmTokenSync).
        //
        // Både vid mount OCH när appen kommer tillbaka i förgrunden: en
        // iOS-PWA laddas sällan om utan väcks ur bakgrunden, och det är där
        // iOS hunnit återkalla pushprenumerationen. Då ger getToken() en ny
        // token som måste in på kontot innan nästa utskick (helgtipset 17/9:
        // ägarens iPhone fick sin nya token först timmen EFTER utskicket).
        let lastCheck: number | null = Date.now();
        refreshDeviceToken(uid).catch(console.error);

        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            const now = Date.now();
            if (!shouldCheckOnResume(lastCheck, now)) return;
            lastCheck = now;
            refreshDeviceToken(uid).catch(console.error);
        };
        document.addEventListener('visibilitychange', onVisible);

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

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            unsubscribe();
        };
    }, [uid]);

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
