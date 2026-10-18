// src/services/analyticsService.ts
import { analytics } from '../lib/firebase';

/**
 * GA4-händelser (18/10, "fixa analytics"): EN väg för alla intressanta
 * användarhandlingar, så tjänstelagret kan logga med en rad. Sidvisningarna
 * tas av components/analytics/FirebaseAnalytics - det här är handlingarna:
 * event_view/event_anmal_click (speglar eventStats-räknarna), gilla/RSVP/
 * stjärna, skapa/önska, inbjudningstratten och butiksbannern.
 *
 * Fire-and-forget precis som eventStats-räknarna: analytics kan vara
 * avstängt (isSupported falsy, SSR) och får ALDRIG störa själva handlingen.
 * Parametrar hålls korta - GA4 klipper strängar över 100 tecken.
 */
export function track(name: string, params?: Record<string, string | number | boolean>): void {
    try {
        void analytics
            .then(async a => {
                if (!a) return;
                const { logEvent } = await import('firebase/analytics');
                logEvent(a, name, params);
            })
            .catch(() => { /* analytics avstängt */ });
    } catch { /* defensivt - aldrig störa anroparen */ }
}
