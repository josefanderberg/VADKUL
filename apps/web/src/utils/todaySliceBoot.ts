// Boot-scriptet för kartsidan, inlinat i (v2)/layout.tsx. Egen modul så att
// själva skriptsträngen kan köras i test (utils/todaySliceBoot.test.ts) - ett
// syntaxfel i ett inline-script kastar inte, det tystnar bara.
import { API_BOT_RE } from './apiBot';

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
// Djuplänken (?event=) får samma försprång: /api/event?id= (~1 kB, hela
// kortfältet inkl. beskrivning) börjar hämtas här så svaret ofta redan finns
// när djuplänks-snabbstarten i page.tsx frågar (fetchDeepLinkEvent i
// utils/eventSeed återanvänder promisen). Körs bara vid FULL sidladdning —
// klientnavigering (t.ex. /e/-sidans router.replace) exekverar inte inline-
// script, och där hämtar fetchDeepLinkEvent själv.
// Botar (utils/apiBot, samma regel som API-vakten) hoppar över alltihop:
// API:t svarar dem 403, och dagsfilen (~180 kB br) gör ingen nytta för en
// crawler som renderar djuplänkar från stadssidorna tusentals gånger per dygn.
export const TODAY_SLICE_BOOT = `(function(){try{
if(new RegExp(${JSON.stringify(API_BOT_RE.source)},'i').test(navigator.userAgent))return;
var f=new Date();f.setHours(0,0,0,0);var t=new Date();t.setHours(23,59,59,999);
window.__vadkulTodaySliceDay=f.toDateString();
window.__vadkulTodayStatic=fetch('/events-today.json').then(function(r){return r.ok?r.json():null}).catch(function(){return null});
window.__vadkulTodaySlice=fetch('/api/events/destinations?from='+encodeURIComponent(f.toISOString())+'&to='+encodeURIComponent(t.toISOString()))
.then(function(r){return r.ok?r.json():null}).catch(function(){return null});
var ev=new URLSearchParams(location.search).get('event');
if(ev){window.__vadkulDeepLinkEvent=fetch('/api/event?id='+encodeURIComponent(ev))
.then(function(r){return r.ok?r.json():null}).catch(function(){return null});}
}catch(e){}})();`;
