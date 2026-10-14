'use client';

import { TODAY_SLICE_BOOT } from '@/utils/todaySliceBoot';

// Kartan följer temasystemet (ThemeProvider): sparat tema vinner, annars
// webbläsarens mörka/ljusa läge. Tidigare tvingades kartan alltid ljus här —
// borttaget 2026-07-05 (användarbeslut: mörka eventkort är OK i darkmode).

export default function V2Layout({ children }: { children: React.ReactNode }) {
    return (
        <div data-app="v2">
            {/* Preconnect till kart-CDN:et (React hoistar länkarna till <head>):
                stil-JSON, glyfer och tiles slipper DNS+TLS-handskakningen när
                maplibre väl bootar. crossOrigin krävs — maplibre hämtar med
                CORS, och en icke-CORS-preconnect återanvänds inte då. */}
            <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="anonymous" />
            <link rel="preconnect" href="https://tiles.basemaps.cartocdn.com" crossOrigin="anonymous" />
            <script dangerouslySetInnerHTML={{ __html: TODAY_SLICE_BOOT }} />
            {children}
        </div>
    );
}
