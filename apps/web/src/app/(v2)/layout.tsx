'use client';

// Kartan följer temasystemet (ThemeProvider): sparat tema vinner, annars
// webbläsarens mörka/ljusa läge. Tidigare tvingades kartan alltid ljus här —
// borttaget 2026-07-05 (användarbeslut: mörka eventkort är OK i darkmode).

// Snabbstart för dagens prickar: hämtningen av dagens event-slice börjar HÄR,
// i HTML-parsningen — långt innan JS-bundlen laddat klart och hydrerat (~2 s
// på mobil). fetchTodaySlice (linkEventService) plockar upp promisen via
// window.__vadkulTodaySlice i stället för att starta en egen hämtning; dag-
// stämpeln skyddar mot en förlegad promise (flik som återupplivas nästa dag).
// URL-formen MÅSTE spegla fetchTodaySlice (lokal midnatt→midnatt som UTC-ISO)
// — CDN:en cachar per URL, en post per dag och tidszon.
const TODAY_SLICE_BOOT = `(function(){try{
var f=new Date();f.setHours(0,0,0,0);var t=new Date();t.setHours(23,59,59,999);
window.__vadkulTodaySliceDay=f.toDateString();
window.__vadkulTodaySlice=fetch('/api/events/destinations?from='+encodeURIComponent(f.toISOString())+'&to='+encodeURIComponent(t.toISOString()))
.then(function(r){return r.ok?r.json():null}).catch(function(){return null});
}catch(e){}})();`;

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
