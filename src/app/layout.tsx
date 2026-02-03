import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
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
                <link rel="icon" type="image/svg+xml" href="/vite.svg" />
            </head>
            <body>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
