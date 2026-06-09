import { Metadata } from 'next';

import { serverEventService } from '@/services/serverEventService';
import EventDetails from '@/components/events/EventDetails';

type Props = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const { id } = await params;
    const event = await serverEventService.getEventById(id);

    if (!event) {
        return {
            title: 'Event hittades inte | VADKUL',
            description: 'Detta event kunde inte hittas.',
        };
    }

    // Format date efficiently
    const dateStr = event.time
        ? new Date(event.time).toLocaleDateString('sv-SE', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        })
        : '';

    const title = `${event.title} ${dateStr} | VADKUL`;
    const description = event.description
        ? event.description.substring(0, 160)
        : `Kom och häng på ${event.title}!`;

    return {
        title: title,
        description: description,
        openGraph: {
            title: title,
            description: description,
            images: [
                {
                    url: event.coverImage || '/og-default.png', // Fallback needed
                    width: 1200,
                    height: 630,
                    alt: event.title,
                },
            ],
            locale: 'sv_SE',
            type: 'website',
        },
    };
}

export default async function EventDetailsPage({ params }: Props) {
    const { id } = await params;
    // Fetch data server-side
    const event = await serverEventService.getEventById(id);

    // We pass the data (or null) to the client component
    return <EventDetails initialEvent={event} />;
}
