'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { LinkEvent } from '../../types';
import { eventEmoji, isEventPast } from './v2MapBricka';
import { EVENT_CATEGORIES, EventCategoryType } from '@/utils/categories';
import { nearestCityPoint } from '@/utils/cityPoints';
import { getDayLabel } from './FloatingNavbar';
import { usableImageUrl } from '@/lib/deepLinkEventIndex';

// ── Gruppväljaren i EVENTKORTET ─────────────────────────────────────────────
// Ersätter multi-event-listan som svävade över kartan (V2MapGroupList,
// borttagen 31/8 kväll på ägarbeslut): klickar man en bricka med FLERA event
// på samma koordinat byts EVENTKORTETS INNEHÅLL ut mot den här listan (emoji +
// titel + tid per rad) tills man valt — radklicket väljer eventet och kortet
// visar det som vanligt (sidan nollar groupChoice i onPickFromGroup).
// Ingen nästa-knapp/räknare som i gamla panelen: här finns plats att se och
// scrolla hela listan, så man pekar direkt på det man vill ha.
//
// DAGRUBRIKER: när man tittar på hela veckan kan en scen ha 30+ event i högen
// och då räcker inte klockslaget — man måste se VILKEN DAG raden gäller. Listan
// grupperas därför per dag med klistrade dagrubriker i SAMMA stil som listan
// under eventkortet (Josef 29/9: "dagarna ska se ut som på de vanliga
// eventkorten när man scrollar ner"): blått streck + dagnamnet ("Idag",
// "Imorgon", "Onsdag", "Ons 8 okt" - getDayLabel). Är hela högen samma dag
// (vanligt i dagsläget) ritas INGA rubriker.
// SCROLLEN (7/10 kväll — ersätter 2/9-beslutet "kortet står still"): väljar-
// läget beter sig som ett VANLIGT eventkort (Josef: "hela det fönstret åka
// upp"): svep/hjul växer arket genom stoppen (default → taket), innehållet
// scrollar först på taket. Dagrubriken är sticky mot kortets scrollcontainer,
// så den dag man är på stannar under platsrubriken tills nästa knuffar ut den.
// HAR VARIT: passerade event ligger hopfällda bakom en knapp längst ner (samma
// grepp som stadssidan) i stället för att ta plats bland de kommande.

const TZ = 'Europe/Stockholm';
const keyFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Dagnyckelns avstånd i dagar från idag (svensk tid) - båda nycklarna är
 *  'ÅÅÅÅ-MM-DD', så skillnaden är ett helt antal dygn. null utan datum. */
function dayOffsetOf(key: string, now: number): number | null {
    const k = Date.parse(key);
    if (Number.isNaN(k)) return null;
    return Math.round((k - Date.parse(keyFmt.format(new Date(now)))) / 86_400_000);
}

type DayBucket = { key: string; label: string; events: LinkEvent[] };

/** Tidssorterar och delar upp på dag (svensk tid), i kronologisk ordning. */
function bucketByDay(list: LinkEvent[], nowMs: number): DayBucket[] {
    const buckets: DayBucket[] = [];
    const byKey = new Map<string, DayBucket>();
    for (const ev of [...list].sort((a, b) => (a.time?.getTime() ?? 0) - (b.time?.getTime() ?? 0))) {
        const key = ev.time ? keyFmt.format(ev.time) : 'okänt';
        let bucket = byKey.get(key);
        if (!bucket) {
            // Samma etikett som eventkortets lista (getDayLabel).
            const offset = dayOffsetOf(key, nowMs);
            bucket = { key, label: offset === null ? 'Datum saknas' : getDayLabel(offset), events: [] };
            byKey.set(key, bucket);
            buckets.push(bucket);
        }
        bucket.events.push(ev);
    }
    return buckets;
}

interface EventCardGroupListProps {
    /** Eventen på platsen (väljaren visas bara vid > 1). */
    events: LinkEvent[];
    /** Kartans valda (representativa) event — raden markeras så man ser vilken
     *  frame brickan stod på när man klickade. */
    selectedEvent: LinkEvent | null;
    /** Radklicket = valet. Sidan väljer eventet OCH stänger väljarläget. */
    onSelect: (ev: LinkEvent) => void;
    /** Rader EFTER högen men INNANFÖR wrappern (7/10: arrangörsraden +
     *  stadssideknappen när hela platsen hör till en arrangör). Måste ligga
     *  inuti data-group-list: den klistrade platsrubriken hålls kvar av sin
     *  container, så den står överst tills man scrollat förbi även de här
     *  raderna (Josef: "sticky längst upp tills dess att man scrollat förbi
     *  fler av samma arrangör eller kommit till den vanliga listan under"). */
    moreRows?: ReactNode;
}

export default function EventCardGroupList({ events, selectedEvent, onSelect, moreRows = null }: EventCardGroupListProps) {
    // Passerade event ligger hopfällda tills man ber om dem.
    const [pastOpen, setPastOpen] = useState(false);

    // Kommande event överst (kronologiskt, dag för dag), passerade sist —
    // dämpade med "har varit" (samma isEventPast som kartans dämpning: start
    // + 1 h, kl 20 för event utan klockslag). Passerade rader går fortfarande
    // att klicka (medvetet val).
    const nowMs = Date.now();
    const upcoming = events.filter(ev => !isEventPast(ev, nowMs));
    const past = events.filter(ev => isEventPast(ev, nowMs));
    const dayBuckets = bucketByDay(upcoming, nowMs);
    const pastOrdered = bucketByDay(past, nowMs).flatMap(b => b.events);
    // Dagrubriker bara när högen faktiskt spänner över flera dagar (annars är
    // de bara brus — alla rader hör ju ändå till samma dag).
    const showDays = dayBuckets.length > 1;

    // PLATSRUBRIKEN: alla event i gruppen delar koordinat, men INTE nödvändigt-
    // vis lokal — event som bara geokodats till orten hamnar i samma hög mitt i
    // stan, och då är första eventets locationName ("Rotary Göteborg-City") en
    // lögn om de övriga 13 (Josef 27/8). Bara när HELA högen delar samma namn
    // är det en riktig lokal och namnet visas; annars räcker orten: närmsta
    // CITY_POINTS-ort, samma uppslag som stadsnamnet högst upp på kartan.
    const firstName = events[0]?.locationName?.trim() || '';
    const sharedVenue = firstName !== '' && events.every(ev => (ev.locationName?.trim() || '') === firstName);
    const placeName = sharedVenue ? firstName : nearestCityPoint(events[0].lat, events[0].lng).name;

    // En eventrad. KOMPAKT MED BILDFYRKANT TILL VÄNSTER sedan 7/10 kväll
    // (ägarbeslut: "Vi behöver inte visa bilder i dem ... elller isf i en
    // ruta åt vänster. så man ser skillnad på dem som är för just den
    // platsen") - ersätter 6/10-bildkorten (h-28): nu när den vanliga listan
    // fortsätter UNDER högen ska platsens egna rader se annorlunda ut än
    // listans stora bildrader. Bild (usableImageUrl filtrerar skräp) i en
    // w-12-fyrkant där emojin annars står; bildlösa får emoji-fyrkanten.
    // Klicket väljer eventet precis som förut.
    const infoRow = (ev: LinkEvent, isPast: boolean, isSel: boolean) => {
        const tid = ev.time && ev.hasSpecificTime !== false
            ? ev.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
            : '';
        const catKey = (ev.category && ev.category in EVENT_CATEGORIES ? ev.category : 'other') as EventCategoryType;
        const catLabel = EVENT_CATEGORIES[catKey].label;
        return (
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${isSel ? 'text-white/80' : 'text-slate-500 dark:text-zinc-400'}`}>
                {tid && <Clock size={10} className="shrink-0" />}
                {tid && <span className="shrink-0 tabular-nums">{`kl ${tid}`}</span>}
                <span className="min-w-0 truncate">{tid ? `· ${catLabel}` : catLabel}</span>
                {isPast && <span className="shrink-0">· har varit</span>}
            </span>
        );
    };
    const row = (ev: LinkEvent, isPast: boolean) => {
        const isSel = selectedEvent?.id === ev.id;
        const img = usableImageUrl(ev.coverImage);
        // Markerad rad = blå med vit kant (ring-inset, ingen layout-shift) —
        // samma "vald = vit-kantad" som markören på kartan, så man ser vilken
        // frame brickan stod på. Passerad rad dämpas (samma 50 % som kartans
        // nål-prickar).
        const selClasses = isSel ? 'ring-2 ring-inset ring-white z-10' : '';
        return (
            <li key={ev.id}>
                <button
                    type="button"
                    onClick={() => onSelect(ev)}
                    className={`relative w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${isSel ? `bg-[#006AA7] ${selClasses}` : 'hover:bg-slate-50 dark:hover:bg-zinc-800 active:bg-slate-100 dark:active:bg-zinc-700'}${isPast && !isSel ? ' opacity-50' : ''}`}
                >
                    {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={img}
                            alt=""
                            loading="lazy"
                            className="shrink-0 w-12 h-12 rounded-lg object-cover bg-slate-200 dark:bg-zinc-700"
                        />
                    ) : (
                        <span className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-xl leading-none ${isSel ? 'bg-white/20' : 'bg-slate-100 dark:bg-zinc-800 border border-border'}`} aria-hidden>{eventEmoji(ev)}</span>
                    )}
                    <span className="flex-1 min-w-0">
                        <span className={`block font-bold text-sm truncate ${isSel ? 'text-white' : 'text-slate-800 dark:text-zinc-100'}`}>{ev.title}</span>
                        {infoRow(ev, isPast, isSel)}
                    </span>
                    <ChevronRight size={16} className={`shrink-0 ${isSel ? 'text-white' : 'text-slate-400'}`} />
                </button>
            </li>
        );
    };

    return (
        // Vanligt blockinnehåll i kortets scrollcontainer — kortets sheet äger
        // höjd/drag/scroll. pt-1: scrollcontainern bär redan pt-6 för den
        // solida grip-zonen, så rubriken står 28 px ned - samma luft som
        // vanliga kortets knapprad (Josef 30/9; pt-8 ovanpå pt-6 gav 56 px
        // tomrum). data-group-list: EventCard känner igen väljarläget i DOM:en
        // och mäter listans höjd (measureDefaultHeight).
        <div className="pt-1" data-group-list>
            {/* PLATSRUBRIKEN ÄR KLISTRAD (7/10 kväll, Josef: "den platsen som
                visas längst upp på eventkortet, den ska ju vara sticky längst
                upp tills dess att man scrollat förbi fler av samma arrangör
                eller kommit till den vanliga listan under"). Containern
                (data-group-list, inkl. moreRows) är det som håller den kvar —
                när vanliga listan tar vid knuffas den ut av sig själv.
                pt-6 -mt-6 = netto noll i flödet (28 px-luften står kvar) men
                fastklistrad bär rubriken sin egen solida yta under grip-zonen
                i stället för att texten glider in bakom den. z-30 över
                dagrubrikerna (z-20), som pinnas med överlapp IN UNDER den
                (top-[60px]) så fontmetrik-skillnader aldrig öppnar en glipa. */}
            <div className="sticky top-0 z-30 bg-card pt-6 -mt-6 flex items-center gap-2 px-4 pb-2.5 border-b border-slate-200/70 dark:border-zinc-700/70">
                <div className="min-w-0 flex-1">
                    <span className="block text-base font-black text-slate-800 dark:text-zinc-100 truncate leading-tight">{placeName}</span>
                    {/* Räknarraden + uppmaningen på SAMMA rad (Josef 2/9: "Välj
                        vilket event…" hade en egen rad med för mycket luft) —
                        uppmaningen ligger längst till höger och viker aldrig;
                        räknaren trunkeras i stället om det blir trångt. */}
                    <span className="flex items-baseline justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">
                        <span className="min-w-0 truncate">
                            {events.length} event på samma plats
                            {showDays ? ` · ${dayBuckets.length} dagar` : ''}
                            {past.length > 0 && past.length < events.length ? ` · ${past.length} har varit` : ''}
                        </span>
                        <span className="shrink-0 normal-case tracking-normal font-bold text-[11px]">
                            Välj vilket event du vill öppna:
                        </span>
                    </span>
                </div>
            </div>
            {/* EN <ul> PER DAG (Josef 2/9): dagrubriken är sticky mot kortets
                scrollcontainer (närmsta scrollande förälder) och stannar
                längst upp i kortet medan dagens rader rullar upp under över-
                kanten — och knuffas sedan ut av nästa dags rubrik, eftersom
                sticky-elementet hålls kvar av sin egen lista (samma grepp som
                stadssidornas <section> per dag). Låg alla dagar i EN lista
                lade rubrikerna sig ovanpå varandra i stället för att bytas.
                pt-5 lyfter rubriken under drag-strecken (absolut överst i
                kortet, 8–20 px) när rubriken sitter fast; i flödet blir samma
                luft avgränsaren mellan dagarna. */}
            {dayBuckets.map(day => (
                <ul key={day.key} className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {showDays && (
                        // Samma rubrik som listan under eventkortet (EventCard:
                        // blått streck i vänstermarginalen, dagtexten i linje med
                        // radernas innehåll). top-[60px]: pinnas under den
                        // klistrade PLATSRUBRIKEN (7/10) — medvetet några px in
                        // under dess botten (z-20 < 30) så fontmetrik-skillnader
                        // aldrig öppnar en glipa mellan dem.
                        <li className="sticky top-[60px] z-20 bg-slate-50/95 dark:bg-zinc-900/90 backdrop-blur-sm px-4 pt-3 pb-2 border-b border-border flex items-center gap-2">
                            <span aria-hidden className="shrink-0 -ml-3 h-4 w-1 rounded-full bg-[#006AA7] dark:bg-sky-400" />
                            <span className="text-sm font-black text-slate-900 dark:text-zinc-100">{day.label}</span>
                        </li>
                    )}
                    {day.events.map(ev => row(ev, false))}
                </ul>
            ))}
            {/* Historik: det som redan varit ligger hopfällt längst ner — egen
                lista, så den inte hamnar under sista dagens klistrade rubrik. */}
            {past.length > 0 && (
                <ul className="border-t border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
                    <li>
                        <button
                            type="button"
                            onClick={() => setPastOpen(o => !o)}
                            aria-expanded={pastOpen}
                            className="w-full px-4 py-2 flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-[#006AA7] transition-colors"
                        >
                            <span aria-hidden>🕐</span>
                            {past.length} har redan varit · {pastOpen ? 'Dölj' : 'Visa'}
                        </button>
                    </li>
                    {pastOpen && pastOrdered.map(ev => row(ev, true))}
                </ul>
            )}
            {/* Arrangörsraden + stadssideknappen (7/10) — inuti wrappern så
                platsrubriken står kvar tills de scrollat förbi (se ovan). */}
            {moreRows}
        </div>
    );
}
