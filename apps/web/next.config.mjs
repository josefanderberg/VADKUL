/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
    // @vadkul/kontrakt skeppas som TS-källa från packages/ — Next måste
    // transpilera det (fas 0 i plattformsplanen).
    transpilePackages: ['@vadkul/kontrakt'],
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
    // Egress-trappan steg 5 (11/9): webpack-byggcachen (~278 MB rått,
    // .next/cache/webpack) följde med i frameworks-deployens function-source.zip
    // (528 MB, uppmätt i gcf-v2-sources-bucketen) och laddas upp+ner vid VARJE
    // deploy. I CI är runnern färsk varje gång — cachen återanvänds aldrig och
    // är ren barlast. Lokalt behålls den (snabbare rebuilds).
    webpack: (config) => {
        if (process.env.CI) config.cache = false;
        return config;
    },
    // SSG-arbetarna (15/9): genereringen av de ~1 045 statiska sidorna är
    // deployens största post (~8 min). Nexts default är cpus-1 (= 3 på
    // GitHub-runnerns 4 kärnor) — använd alla fyra i CI. Bara CI: lokalt
    // får Next välja själv.
    ...(process.env.CI ? { experimental: { cpus: 4 } } : {}),
    // Gamla sidor (/shop, /login) är skrotade — inloggning + funktioner bor på
    // kartan. Mjuk redirect på routing-nivå så gamla länkar/bokmärken landar på
    // kartan i stället för 404. (Ersätter redirect-only page-stubbar som kraschade
    // bygget med "Cannot find module for page" i Next 15.)
    async redirects() {
        return [
            { source: '/shop', destination: '/', permanent: false },
            { source: '/login', destination: '/', permanent: false },
            // /admin är Vad kul-studion (klippverktyget, eget repo i vadkulyt/). Den kör
            // på Mac minin bakom Tailscale Funnel med egen lösenordsinloggning. Studion
            // är den ENDA admin-ytan (ägarbeslut 22/9): gamla admin-sidan (feedback/
            // rapporter) togs bort 17/9 och outreach-konsolen (/admin/outreach) 22/9.
            // Undersökvägarna går också till studion så gamla bokmärken inte 404:ar.
            { source: '/admin', destination: 'https://mac-mini-som-tillhr-ai.tailba7cb9.ts.net/', permanent: false },
            { source: '/admin/:path*', destination: 'https://mac-mini-som-tillhr-ai.tailba7cb9.ts.net/', permanent: false },
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

