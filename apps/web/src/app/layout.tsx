import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Fredoka } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import Hotjar from '@/components/analytics/Hotjar';
import FirebaseAnalytics from '@/components/analytics/FirebaseAnalytics';
import SiteVisitBeacon from '@/components/analytics/SiteVisitBeacon';

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
    title: {
        default: 'VADKUL – Hitta events och saker att göra nära dig',
        template: '%s – VADKUL',
    },
    description:
        'Över 20 000 evenemang i hela Sverige på en karta – konserter, marknader, sport och saker att göra med barn. Se vad som händer nära dig idag. Gratis.',
    applicationName: 'VADKUL',
    // Delnings-länkar (?event=...) pekar alla på kartan — self-canonical håller
    // ihop dem i Googles index. /integritet sätter sin egen canonical.
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        locale: 'sv_SE',
        url: '/',
        siteName: 'VADKUL',
        title: 'VADKUL – Hitta events och saker att göra nära dig',
        description:
            'Över 20 000 evenemang i hela Sverige på en karta. Se vad som händer nära dig idag – gratis.',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'VADKUL – Hitta events och saker att göra nära dig',
        description:
            'Över 20 000 evenemang i hela Sverige på en karta. Se vad som händer nära dig idag – gratis.',
    },
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

// Strukturerad data (schema.org) — hjälper Google förstå vad VADKUL är och visa
// varumärket rätt i sökresultat. Event-markup per event hör hemma på kommande
// stads-/kategorisidor; på sajtnivå räcker WebSite + Organization.
const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebSite',
            '@id': 'https://vadkul.se/#website',
            url: 'https://vadkul.se',
            name: 'VADKUL',
            description:
                'Över 20 000 evenemang i hela Sverige på en karta – se vad som händer nära dig idag.',
            inLanguage: 'sv',
            publisher: { '@id': 'https://vadkul.se/#organization' },
        },
        {
            '@type': 'Organization',
            '@id': 'https://vadkul.se/#organization',
            name: 'VADKUL',
            url: 'https://vadkul.se',
            logo: 'https://vadkul.se/pwa-icon-512.png',
        },
    ],
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
                {/* Två favicons med olika roller: Google (och iOS-hemskärmen) tar den
                    STÖRSTA deklarerade — blå platta så det vita molnet syns i sökresultatens
                    vita cirkel. Fliken tar 32:an — transparent, som förr. Ordningen är
                    medveten: Safari väljer sist deklarerade ikonen, Chrome går på sizes. */}
                <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192-bla.png" />
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
                <link rel="apple-touch-icon" href="/favicon-192-bla.png" />
                <meta name="theme-color" content="#38bdf8" />
                {/* Impact kräver value-attributet (inte content) — spread eftersom Reacts typer saknar value på meta */}
                <meta name="impact-site-verification" {...({ value: 'dfee543c-aa2e-4d41-8f1e-0496d288b344' } as Record<string, string>)} />
            </head>
            <body>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
                <Providers>
                    {children}
                    <Hotjar />
                    <SiteVisitBeacon />
                    {/* useSearchParams() i FirebaseAnalytics kräver en Suspense-gräns —
                        annars kan sidor tvingas ur statisk rendering. */}
                    <Suspense fallback={null}>
                        <FirebaseAnalytics />
                    </Suspense>
                </Providers>
            </body>
        </html>
    );
}
