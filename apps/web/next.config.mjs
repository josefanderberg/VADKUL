/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
    reactStrictMode: false, // Sometimes helpful to disable for map/ref issues dev mode
    serverExternalPackages: ['better-sqlite3', 'firebase-admin'],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
        unoptimized: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    outputFileTracingRoot: path.join(__dirname, '../../'),
    // Gamla sidor (/shop, /login) är skrotade — inloggning + funktioner bor på
    // kartan. Mjuk redirect på routing-nivå så gamla länkar/bokmärken landar på
    // kartan i stället för 404. (Ersätter redirect-only page-stubbar som kraschade
    // bygget med "Cannot find module for page" i Next 15.)
    async redirects() {
        return [
            { source: '/shop', destination: '/', permanent: false },
            { source: '/login', destination: '/', permanent: false },
            // Webbläsare OCH Googles favicon-crawler frågar alltid efter
            // /favicon.ico — skicka dem till BLÅ plattan (192 = Googles
            // önskade 48-multipel). Pekade på gamla vita favicon.png t.o.m.
            // 1/9 — det var därför sökresultaten fortsatte visa vit ikon
            // trots att head-länkarna bytts 30/8. (favicon.png lever kvar
            // som välkomstrutans molngrafik — skriv inte över den.)
            { source: '/favicon.ico', destination: '/favicon-192-bla.png', permanent: true },
        ];
    },
};

export default nextConfig;

