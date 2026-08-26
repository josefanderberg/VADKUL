'use client';

// Stadssidornas besöksräknare (Josef 26/8) — matar besök/vecka- och totalt-
// kolumnerna i topplistan på /evenemang. EN ping per webbläsare, stad och dag
// (localStorage-dedupe per slug, samma grepp som SiteVisitBeacon) →
// /api/stats/visit med { stad } i kroppen → outreachStats/cityVisits,
// server-only. Kategorisidorna räknas till sin stad — de är samma undersida.

import { useEffect } from 'react';

export default function CityVisitBeacon({ stad }: { stad: string }) {
    useEffect(() => {
        try {
            const day = new Date().toLocaleDateString('sv-SE');   // "2026-07-26"
            const KEY = `vadkul-cityvisit-${stad}`;
            if (localStorage.getItem(KEY) === day) return;
            localStorage.setItem(KEY, day);
            const body = new Blob([JSON.stringify({ stad })], { type: 'application/json' });
            if (!navigator.sendBeacon?.('/api/stats/visit', body)) {
                fetch('/api/stats/visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stad }),
                    keepalive: true,
                }).catch(() => { /* best-effort */ });
            }
        } catch { /* utan storage (strikt privat läge) räknar vi hellre inte än spammar */ }
    }, [stad]);
    return null;
}
