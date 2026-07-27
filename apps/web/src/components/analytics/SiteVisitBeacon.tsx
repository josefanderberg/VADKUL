'use client';

// Egen dagsbesöks-räknare — matar "Besök idag" i publiceringskonsolen
// (/admin/outreach). EN ping per webbläsare och dag (localStorage-dedupe),
// aldrig på /admin-sidor. Datat: outreachStats/siteVisits, server-only.

import { useEffect } from 'react';

export default function SiteVisitBeacon() {
    useEffect(() => {
        try {
            if (window.location.pathname.startsWith('/admin')) return;
            const day = new Date().toLocaleDateString('sv-SE');   // "2026-07-26"
            const KEY = 'vadkul-visit-day';
            if (localStorage.getItem(KEY) === day) return;
            localStorage.setItem(KEY, day);
            if (!navigator.sendBeacon?.('/api/stats/visit')) {
                fetch('/api/stats/visit', { method: 'POST', keepalive: true }).catch(() => { /* best-effort */ });
            }
        } catch { /* utan storage (strikt privat läge) räknar vi hellre inte än spammar */ }
    }, []);
    return null;
}
