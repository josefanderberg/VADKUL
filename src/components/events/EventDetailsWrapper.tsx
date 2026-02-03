'use client';

import dynamic from 'next/dynamic';

const EventDetails = dynamic(() => import('@/views/EventDetails'), {
    ssr: false,
});

export default function EventDetailsWrapper() {
    return <EventDetails />;
}
