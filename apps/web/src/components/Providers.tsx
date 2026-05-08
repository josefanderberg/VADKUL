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
import toast from 'react-hot-toast';

function FCMHandler() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // Request notification permission and save token
        const requestPermission = async () => {
            const token = await requestNotificationPermission();
            if (token) {
                await notificationService.saveFCMToken(user.uid, token);
                console.log('FCM token saved for user:', user.uid);
            }
        };

        requestPermission();

        // Handle foreground messages
        const unsubscribe = onForegroundMessage((payload) => {
            const title = payload.notification?.title || 'VADKUL';
            const body = payload.notification?.body || 'Du har en ny notis';

            toast(body, {
                icon: '🔔',
                duration: 4000,
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
                    </AdminProvider>
                </AuthProvider>
            </ThemeProvider>
        </QueryProvider>
    );
}
