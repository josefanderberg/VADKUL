'use client';

import dynamic from 'next/dynamic';

const PublicProfile = dynamic(() => import('@/views/PublicProfile'), {
    ssr: false,
});

export default function PublicProfilePage() {
    return <PublicProfile />;
}
