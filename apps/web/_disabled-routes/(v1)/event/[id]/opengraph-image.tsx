import { ImageResponse } from 'next/og';
import { serverEventService } from '@/services/serverEventService';

export const runtime = 'nodejs'; // Use nodejs runtime for firebase-admin

export const alt = 'Event Cover Image';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
    const { id } = await params;
    const event = await serverEventService.getEventById(id);

    // Fallback data if event not found
    const title = event?.title || 'VADKUL Event';
    const location = event?.location?.name || 'Okänd plats';
    const dateStr = event?.time
        ? new Date(event.time).toLocaleDateString('sv-SE', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
        })
        : '';
    const categoryEmoji = '🎉'; // We could ideally map this from categories.ts but keeping it simple for server-side

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#1a1a1a', // Dark theme background
                    backgroundImage: 'linear-gradient(to bottom right, #1a1a1a, #2a2a2a)',
                    color: 'white',
                    fontFamily: 'sans-serif',
                    position: 'relative',
                }}
            >
                {/* Background Image Overlay if exists */}
                {event?.coverImage && (
                    <img
                        src={event.coverImage}
                        style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            opacity: 0.3,
                        }}
                    />
                )}

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        textAlign: 'center',
                        padding: '40px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderRadius: '20px',
                        border: '2px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        maxWidth: '90%',
                    }}
                >
                    <div
                        style={{
                            fontSize: 100,
                            marginBottom: 20,
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
                        }}
                    >
                        {categoryEmoji}
                    </div>

                    <div
                        style={{
                            fontSize: 60,
                            fontWeight: 'bold',
                            marginBottom: 20,
                            lineHeight: 1.1,
                            textShadow: '0 4px 10px rgba(0,0,0,0.5)',
                            background: 'linear-gradient(to right, #fff, #ccc)',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        {title}
                    </div>

                    <div
                        style={{
                            fontSize: 32,
                            color: '#e0e0e0',
                            marginBottom: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}
                    >
                        📅 {dateStr}
                    </div>

                    <div
                        style={{
                            fontSize: 32,
                            color: '#a0a0a0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}
                    >
                        📍 {location}
                    </div>
                </div>

                {/* Branding */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 40,
                        fontSize: 24,
                        color: 'rgba(255,255,255,0.5)',
                        fontWeight: 'bold',
                        letterSpacing: '2px',
                    }}
                >
                    VADKUL.SE
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
