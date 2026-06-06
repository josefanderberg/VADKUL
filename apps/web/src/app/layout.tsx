import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import Hotjar from '@/components/analytics/Hotjar';
import FirebaseAnalytics from '@/components/analytics/FirebaseAnalytics';

export const metadata: Metadata = {
    metadataBase: new URL('https://vadkul.se'),
    title: 'VADKUL - Hitta spontana events',
    description: 'Upptäck spontana events och aktiviteter i din närhet. Hitta vad som händer just nu på kartan.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'VADKUL',
    },
    other: {
        'mobile-web-app-capable': 'yes',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="sv" suppressHydrationWarning>
            <head>
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="apple-touch-icon" href="/favicon.svg" />
                <meta name="theme-color" content="#16a34a" />
                <meta name="impact-site-verification" content="17f79b5d-182e-4a80-bff9-634b6d47ebc7" />
            </head>
            <body>
                <Providers>
                    {children}
                    <Hotjar />
                    <FirebaseAnalytics />
                </Providers>
            </body>
        </html>
    );
}
