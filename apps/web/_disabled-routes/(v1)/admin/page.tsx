'use client';

import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(() => import('@/views/AdminDashboard'), {
    ssr: false,
});

export default function AdminPage() {
    return <AdminDashboard />;
}
