import AdminClient from './AdminClient';

// Admin-sidan renderas DYNAMISKT (aldrig statiskt prerenderad vid build). Den
// är en 'use client'-sida som laddar firebase och bara nås inloggad — det finns
// inget att prerendera, och dess prerender kraschade ibland Next-workern
// ("Cannot find module for page: /admin"). force-dynamic gör bygget deterministiskt.
export const dynamic = 'force-dynamic';

export default function AdminPage() {
    return <AdminClient />;
}
