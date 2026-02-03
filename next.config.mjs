/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false, // Sometimes helpful to disable for map/ref issues dev mode
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
