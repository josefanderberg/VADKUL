'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, MapPin, Map as MapIcon, Share2, Ticket, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { LinkEvent } from '@/types';
import { fetchDeepLinkEvent } from '@/utils/eventSeed';
import { eventShareSlug } from '@/utils/eventShareSlug';
import { isTicketmasterEvent } from '@/utils/ticketmasterEvent';
import { descriptionText, eventOutlink, hostFaviconUrl, pickDescription } from '@/utils/eventExpand';
import { recordEventClick } from '@/services/eventStatsService';
import type { ListedEvent } from './DayFilteredList';

// Det UTFÄLLDA eventet på stads-/kategorisidorna (Josef 2/9): ett klick på en
// rad öppnar eventet HÄR — beskrivning, när & var, och samma knappar som
// eventkortet på kartan (Anmäl/Boka, Visa på kartan, Dela) — i stället för
// att hoppa till kartan. Kartan är fortfarande ett klick bort ("Karta"-
// knappen bär samma ?event=-länk + sessionStorage-seed som raden gjorde).
//
// Beskrivningen: stadssidans serverrenderade text är kapad vid ~300 tecken
// (schema.org-trimmen i cityData). Den visas DIREKT, och /api/event?id= —
// samma ~1 kB-uppslag som kartans djuplänk använder — fyller på med hela
// texten och kortets utlänk (för Ticketmaster: affiliate-redirecten, som id:t
// saknar). Ingen Firestore-läsning från klienten.

export default function EventExpanded({ e, isDup, dayLabel, onClose, onMapClick }: {
    e: Omit<ListedEvent, 'dups'>;
    /** Sant när det utfällda är ett av gruppradens ÖVRIGA tillfällen (dups)
     *  — då står titeln med i panelen, eftersom radens rubrik är
     *  representantens. */
    isDup?: boolean;
    /** Dagrubriken ("torsdag 9 juli") — panelens datumrad. */
    dayLabel: string;
    onClose: () => void;
    /** Karta-knappens klick — skriver sessionStorage-seeden (samma överlämning
     *  som radklicket gjorde före 2/9) så kortet på kartan öppnar direkt. */
    onMapClick: () => void;
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    // undefined = svaret väntas, null = miss/fel (kapade texten får duga).
    const [api, setApi] = useState<LinkEvent | null | undefined>(undefined);

    // Monteras om per event (key={id} i DayFilteredList) — därför behöver
    // svaret inte nollas här när man byter tillfälle inom samma grupprad.
    useEffect(() => {
        let alive = true;
        fetchDeepLinkEvent(e.id).then(r => { if (alive) setApi(r); });
        return () => { alive = false; };
    }, [e.id]);

    // Öppnas panelen nära skärmens underkant hamnar innehållet under vecket —
    // rulla upp precis så mycket att den syns, men aldrig så att knappraden
    // (överst i panelen) försvinner bakom toppnaven + dagrubriken (~120 px).
    // Mäts synkront i effekten: bildraden växer (h-28 → h-52) UTAN
    // höjdanimation just för att måttet här ska vara det slutliga — med en
    // transition mättes den gamla bildhöjden och panelen hamnade ~100 px
    // längre ner än scrollen tog höjd för. (En setTimeout som väntade in
    // animationen är prövad och riven: Chrome stryper timers i dolda flikar,
    // och ett ankare ska inte bero på en klocka.) Hoppet är OMEDELBART,
    // inte mjukt: det hör ihop med klicket som ett ankarhopp, och en mjuk
    // rullning kunde avbrytas av nästa fingerdrag halvvägs.
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const overflow = r.bottom - window.innerHeight + 16;
        if (overflow <= 0) return;
        window.scrollBy({ top: Math.min(overflow, Math.max(0, r.top - 120)), behavior: 'instant' });
    }, [e.id]);

    // Escape stänger, som kortet på kartan.
    useEffect(() => {
        const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const outlink = eventOutlink(e.id, api?.url);
    // Värdens favicon ur utlänkens domän (id:t är källans URL för skrapade
    // event, så den finns redan innan API-svaret).
    const faviconUrl = hostFaviconUrl(outlink ?? e.id);
    // Ticketmaster = biljettköp, inte anmälan (ägarbeslut 1/9): BOKA i guld.
    const tm = isTicketmasterEvent({ id: e.id, url: api?.url });
    const text = descriptionText(pickDescription(api?.description, e.description), api === undefined);

    // Vidarelänknings-statistiken (outreach-underlaget) — samma räknare som
    // kortets ANMÄL. Fire-and-forget; länken öppnas av <a> oavsett.
    const trackOutlink = () => {
        if (!outlink) return;
        recordEventClick({ id: e.id, url: outlink, title: e.title, hostName: e.hostName ?? undefined });
    };

    // Dela: native share-dialog på mobil, annars kopiera. Samma /e/<slug>-länk
    // som kortets dela-knapp — den sidan bär eventets egen delningsbild.
    const handleShare = async () => {
        const url = `${window.location.origin}/e/${eventShareSlug(e.id)}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: e.title, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            toast.success('Länk kopierad!');
        } catch {
            // Avbruten share-dialog är inget fel.
        }
    };

    const roundBtn = 'w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all active:scale-[0.95] bg-white border-slate-200 text-slate-500 hover:text-[#006AA7] hover:border-sky-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-sky-400 dark:hover:border-sky-900/50';
    const ctaGradient = tm
        ? 'bg-gradient-to-r from-[#fbbf24] to-[#d97706] text-amber-950 shadow-amber-900/30 ring-white/40 hover:from-[#fcd34d] hover:to-[#f59e0b]'
        : 'bg-gradient-to-r from-[#0077BC] to-[#005590] text-white shadow-sky-900/30 ring-white/25 hover:from-[#0083CE] hover:to-[#00619F]';

    return (
        <div
            ref={rootRef}
            className="border-t border-slate-100 dark:border-zinc-800 px-4 pt-3 pb-4 animate-in fade-in slide-in-from-top-1 duration-200"
        >
            {/* Knappraden — samma formspråk som eventkortets header: runda
                ikonknappar (Dela, Karta) och det helrundade ANMÄL/BOKA-pillret
                med glidande pil. Stäng-krysset längst till höger. */}
            <div className="flex items-center gap-2">
                <button type="button" onClick={handleShare} aria-label="Dela eventet" title="Dela eventet" className={roundBtn}>
                    <Share2 size={15} />
                </button>
                <Link
                    href={e.href}
                    onClick={onMapClick}
                    title="Visa eventet på kartan"
                    className="h-8 pl-2.5 pr-3 rounded-full border flex items-center gap-1.5 shrink-0 text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.97] bg-white border-slate-200 text-slate-600 hover:text-[#006AA7] hover:border-sky-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-sky-400 dark:hover:border-sky-900/50"
                >
                    <MapIcon size={14} />
                    Karta
                </Link>
                <span className="flex-1" />
                {outlink && (
                    <a
                        href={outlink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={trackOutlink}
                        className={`group/anmal shrink-0 h-8 pl-3.5 pr-2.5 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-md ring-1 ring-inset hover:shadow-lg active:scale-[0.97] transition-all ${ctaGradient}`}
                    >
                        {tm ? 'BOKA' : 'ANMÄL'}
                        <ArrowRight size={13} className="shrink-0 transition-transform group-hover/anmal:translate-x-0.5" />
                    </a>
                )}
                <button type="button" onClick={onClose} aria-label="Stäng" title="Stäng" className={roundBtn}>
                    <X size={15} />
                </button>
            </div>

            {/* Ett ÖVRIGT tillfälle ur en grupprad: radens rubrik är
                representantens, så det valda tillfällets titel står här. */}
            {isDup && (
                <h4 className="mt-3 text-sm font-black text-slate-900 dark:text-zinc-100 leading-snug">{e.title}</h4>
            )}

            {/* VÄRDEN ÖVERST (Josef 2/9: "värden kan vara över dagen", ingen
                "Värd"-etikett): favicon (initial som reserv) + namn, som
                kartkortets Värd-rad fast utan rubriken. Därunder när & var med
                samma ikoner som inforaden. (Kategorin står på själva raden,
                nere till höger på bilden — inte här.) */}
            <div className={`${isDup ? 'mt-1.5' : 'mt-3'} flex flex-col items-start gap-1 text-xs font-bold text-slate-600 dark:text-zinc-400`}>
                {e.hostName && (
                    <span className="mb-0.5 inline-flex items-center gap-2 min-w-0 max-w-full">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center border border-slate-200 dark:border-zinc-700 bg-white overflow-hidden shrink-0">
                            {faviconUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={faviconUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                            ) : (
                                <span className="font-bold text-[8px] text-slate-700">{e.hostName.charAt(0).toUpperCase()}</span>
                            )}
                        </span>
                        <span className="truncate text-slate-800 dark:text-zinc-100">{e.hostName}</span>
                    </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={13} className="text-[#006AA7] dark:text-sky-400 shrink-0" />
                    <span><span className="first-letter:uppercase inline-block">{dayLabel}</span>{e.clock ? ` kl ${e.clock}` : ''}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                    <MapPin size={13} className="text-[#006AA7] dark:text-sky-400 shrink-0" />
                    <span className="truncate">{e.place}</span>
                </span>
                {e.price && (
                    <span className="inline-flex items-center gap-1.5">
                        <Ticket size={13} className="text-[#006AA7] dark:text-sky-400 shrink-0" />
                        {e.price}
                    </span>
                )}
                {e.attendees > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                        <Users size={13} className="text-[#006AA7] dark:text-sky-400 shrink-0" />
                        {e.attendees} kommer
                    </span>
                )}
            </div>

            <p className="mt-3 text-sm text-slate-800 dark:text-zinc-100 whitespace-pre-wrap break-words leading-relaxed font-medium">
                {text}
            </p>

            {/* Stora CTA:n under texten — samma som kortets, i CTA-storlek:
                den som läst klart ska inte behöva leta upp lilla pillret igen. */}
            {outlink && (
                <a
                    href={outlink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={trackOutlink}
                    className={`group/anmalcta mt-4 flex items-center justify-center gap-2.5 w-full py-3 rounded-full text-base font-black uppercase tracking-widest shadow-lg ring-1 ring-inset hover:shadow-xl transition-all active:scale-[0.97] ${ctaGradient}`}
                >
                    <span>{tm ? 'Boka biljetter' : 'Anmäl dig här'}</span>
                    <ArrowRight size={18} className="shrink-0 transition-transform group-hover/anmalcta:translate-x-1" />
                </a>
            )}
        </div>
    );
}
