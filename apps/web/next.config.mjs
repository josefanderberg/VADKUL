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
            // Webbläsare frågar alltid efter /favicon.ico — den finns bara som PNG.
            { source: '/favicon.ico', destination: '/favicon.png', permanent: true },
        ];
    },
};

export default nextConfig;

