'use client';

import dynamic from 'next/dynamic';

const CreateEvent = dynamic(() => import('@/views/CreateEvent'), { ssr: false });

export default function EditEventPage() {
    return <CreateEvent />;
}
