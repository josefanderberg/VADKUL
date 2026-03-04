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
        unoptimized: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
