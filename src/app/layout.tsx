import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import Hotjar from '@/components/analytics/Hotjar';

export const metadata: Metadata = {
    metadataBase: new URL('https://vadkul.se'),
    title: 'VADKUL - Hitta kul saker att göra',
    description: 'Se vad som händer i dina trakter',
    manifest: '/manifest.json',
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
                <link rel="icon" type="image/png" href="/pwa-icon-v2.png" />
            </head>
            <body>
                <Providers>
                    {children}
                    <Hotjar />
                </Providers>
            </body>
        </html>
    );
}
