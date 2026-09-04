'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { writeEventSeed } from '@/utils/eventSeed';
import type { ShareEvent } from './shareData';

// Skickar människor vidare till kartan med eventet öppet. Delnings-skrapare
// (Facebook/Messenger m.fl.) kör ingen JS och stannar på sidan → de läser
// per-event-OG-taggarna, vilket är hela poängen med /e/-sidorna.
//
// Sidans egna eventfält lämnas över som sessionStorage-seed (utils/eventSeed)
// innan hoppet: kortet på /?event= öppnar då direkt på titel/värd/bild i
// stället för att vänta på Sverige-lagren. ShareEvent saknar koordinater och
// beskrivning — /api/event-svaret fyller dem (och kameran flyger först då).
export default function MapRedirect({ event }: { event: ShareEvent }) {
    const router = useRouter();
    useEffect(() => {
        const t = Date.parse(event.time);
        if (Number.isFinite(t)) {
            writeEventSeed({
                id: event.id,
                title: event.title,
                t,
                hasSpecificTime: event.hasSpecificTime,
                locationName: event.locationName || undefined,
                emoji: event.emoji || undefined,
                hostName: event.hostName,
                coverImage: event.coverImage,
            });
        }
        router.replace(`/?event=${encodeURIComponent(event.id)}`);
    }, [router, event]);
    return null;
}
