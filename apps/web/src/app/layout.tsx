import type { Metadata, Viewport } from 'next';
import { Fredoka } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import Hotjar from '@/components/analytics/Hotjar';
import FirebaseAnalytics from '@/components/analytics/FirebaseAnalytics';

// Rundad, vänlig display-font för moln-texten och andra "lockande" inslag.
// Variabel font så vi får alla vikter (300–700) i en fil.
const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-fredoka',
});

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
        <html lang="sv" suppressHydrationWarning className={fredoka.variable}>
            <head>
                <link rel="icon" type="image/png" href="/favicon.png" />
                <link rel="apple-touch-icon" href="/favicon.png" />
                <meta name="theme-color" content="#38bdf8" />
                {/* Impact kräver value-attributet (inte content) — spread eftersom Reacts typer saknar value på meta */}
                <meta name="impact-site-verification" {...({ value: '17f79b5d-182e-4a80-bff9-634b6d47ebc7' } as Record<string, string>)} />
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
