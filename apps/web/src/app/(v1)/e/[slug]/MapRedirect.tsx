'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Skickar människor vidare till kartan med eventet öppet. Delnings-skrapare
// (Facebook/Messenger m.fl.) kör ingen JS och stannar på sidan → de läser
// per-event-OG-taggarna, vilket är hela poängen med /e/-sidorna.
export default function MapRedirect({ eventId }: { eventId: string }) {
    const router = useRouter();
    useEffect(() => {
        router.replace(`/?event=${encodeURIComponent(eventId)}`);
    }, [router, eventId]);
    return null;
}
