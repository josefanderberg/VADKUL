import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/admin/'] },
        sitemap: 'https://vadkul.se/sitemap.xml',
        host: 'https://vadkul.se',
    };
}
