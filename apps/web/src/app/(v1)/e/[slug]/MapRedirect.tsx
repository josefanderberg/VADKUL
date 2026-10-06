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
        // Inbjudningsparametrarna (6/10): /e/<slug>?inb=1&fran=<uid> ska nå
        // kartan — de visar "X undrar om du följer med"-bannern i kortets
        // footer. Bara de kända nycklarna förs vidare (ingen öppen passthrough).
        const incoming = new URLSearchParams(window.location.search);
        let extra = '';
        if (incoming.get('inb') === '1') {
            extra += '&inb=1';
            const fran = incoming.get('fran');
            if (fran && /^[A-Za-z0-9]{10,64}$/.test(fran)) extra += `&fran=${encodeURIComponent(fran)}`;
        }
        router.replace(`/?event=${encodeURIComponent(event.id)}${extra}`);
    }, [router, event]);
    return null;
}
