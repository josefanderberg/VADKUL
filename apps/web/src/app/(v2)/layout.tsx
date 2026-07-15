'use client';

// Kartan följer temasystemet (ThemeProvider): sparat tema vinner, annars
// webbläsarens mörka/ljusa läge. Tidigare tvingades kartan alltid ljus här —
// borttaget 2026-07-05 (användarbeslut: mörka eventkort är OK i darkmode).

// Snabbstart för dagens prickar: hämtningarna av dagens event börjar HÄR,
// i HTML-parsningen — långt innan JS-bundlen laddat klart och hydrerat (~2 s
// på mobil). TVÅ källor parallellt: den statiska dagsfilen (ren CDN-fil bakad
// vid deploy, ~100 kB gz — snabbast och opåverkad av funktions-kallstarter)
// och API-slicen (färskast). fetchTodayStatic/fetchTodaySlice i
// linkEventService plockar upp promisarna via window.__vadkulToday* i stället
// för att starta egna hämtningar; dagstämpeln (slice) resp. day-fältet i
// filen (static) skyddar mot förlegade svar (flik över midnatt / besök före
// morgondeployen). URL-formen för slicen MÅSTE spegla fetchTodaySlice (lokal
// midnatt→midnatt som UTC-ISO) — CDN:en cachar per URL, en post per dag/tidszon.
const TODAY_SLICE_BOOT = `(function(){try{
var f=new Date();f.setHours(0,0,0,0);var t=new Date();t.setHours(23,59,59,999);
window.__vadkulTodaySliceDay=f.toDateString();
window.__vadkulTodayStatic=fetch('/events-today.json').then(function(r){return r.ok?r.json():null}).catch(function(){return null});
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
