'use client';

import { ArrowRight } from 'lucide-react';
import HScrollRow from '@/components/ui/HScrollRow';
import { getDayLabel } from '@/components/v2/FloatingNavbar';
import { EVENT_CATEGORIES, type EventCategoryType } from '@/utils/categories';
import { organizerHref } from '@/utils/organizerPages';
import { usableImageUrl } from '@/lib/deepLinkEventIndex';
import type { LinkEvent } from '@/types';

export interface OrganizerRowData {
    /** null = arrangören har ingen arrangörssida (biljettplattform/opt-in/
     *  användarskapad) — raden visas ändå, utan sidknappen. */
    slug: string | null;
    name: string;
    /** Kan vara TOM när arrangören har en sida men inga FLER laddade event
     *  (7/10 kväll: vägen till arrangörssidan ska finnas ändå). */
    rows: LinkEvent[];
}

interface CardMoreRowsProps {
    /** "Fler från samma arrangör" — null när eventet saknar arrangörssida
     *  eller arrangören inte har fler kommande event i lagret. */
    organizerRow: OrganizerRowData | null;
    onSelect: (evt: LinkEvent) => void;
    /** Stadssidelänken (samma som topplattans) — "Allt som händer i X". */
    cityLink: { href: string; label: string };
    /** Kortsökets aktiva term följer med till stadssidan som ?q= (6/10:
     *  "ett sök kan välja att behållas när man kommer till sidan"). */
    searchQ?: string;
    /** Antal event i kartans ruta den kommande månaden (EventCards
     *  Månaden-flik, samma tal) — visas i stadssideknappen (7/10, Josef:
     *  "mer av en knapp som visar hur många de är kommande månaden i den
     *  staden"). Utelämnad/0 → knappen utan siffra. */
    cityCount?: number;
}

function eventEmoji(evt: LinkEvent): string {
    if (evt.emoji) return evt.emoji;
    const cat = (evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other') as EventCategoryType;
    return EVENT_CATEGORIES[cat].emoji;
}

function dayAndTime(evt: LinkEvent): string {
    if (!evt.time) return '';
    const midnight = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
    const offset = Math.round((midnight(evt.time) - midnight(new Date())) / 86_400_000);
    const day = getDayLabel(offset);
    if (evt.hasSpecificTime === false) return day;
    return `${day} ${evt.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Raderna under eventinfon (ägarbeslut 6/10): "FLER FRÅN {ARRANGÖR}" som
 * SIDLEDSRULLANDE rad (HScrollRow — "en sådan som går åt sidan") med
 * emoji-brickor ("ikoner för event"), direktlänk till ARRANGÖRSSIDAN
 * (värdnamnets klick filtrerar fortfarande kartan, 29/9-beslutet står kvar —
 * länken hit är en EGEN väg), och en rad till STADSSIDAN där kortsökets term
 * följer med som ?q=.
 */
export default function CardMoreRows({ organizerRow, onSelect, cityLink, searchQ, cityCount }: CardMoreRowsProps) {
    const q = searchQ?.trim();
    const cityHref = q
        ? `${cityLink.href}${cityLink.href.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`
        : cityLink.href;
    return (
        <div className="border-t border-border">
            {organizerRow && (organizerRow.rows.length > 0 || organizerRow.slug) && (
                <div className="px-4 md:px-6 py-3">
                    {organizerRow.rows.length > 0 && (
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 truncate">
                            Fler från {organizerRow.name}
                        </span>
                        {/* (Den lilla "Arrangörssidan →"-textlänken som stod
                            här är ERSATT av knappen under raden - 7/10 kväll,
                            Josef: "jag måste ju kunna gå till alla som är på
                            arrangörssidan ifrån eventkortet".) */}
                    </div>
                    )}
                    {/* -mx/px: raden rullar ända ut till kortets kanter, som
                        tid/plats-raden. data-hscroll (inuti HScrollRow) låter
                        kortets gestlogik släppa vågräta svep hit. */}
                    {organizerRow.rows.length > 0 && (
                    <HScrollRow className="-mx-4 md:-mx-6 px-4 md:px-6 gap-2">
                        {organizerRow.rows.map(evt => {
                            // Bild i brickan (Josef 6/10: "det ska ju vara
                            // bilder i dem också om det finns, fast i en
                            // fyrkant åt vänster") — emoji-fyrkant som reserv.
                            const img = usableImageUrl(evt.coverImage);
                            return (
                                <button
                                    key={evt.id}
                                    type="button"
                                    onClick={() => onSelect(evt)}
                                    className="shrink-0 w-56 text-left rounded-xl border border-border bg-slate-50 dark:bg-zinc-800/60 p-2 flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition"
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
                                        <span aria-hidden className="shrink-0 w-12 h-12 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-border flex items-center justify-center text-xl leading-none">
                                            {eventEmoji(evt)}
                                        </span>
                                    )}
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
                                            {dayAndTime(evt)}
                                        </span>
                                        <span className="block mt-0.5 text-xs font-bold text-slate-800 dark:text-zinc-100 leading-snug line-clamp-2">
                                            {evt.title}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </HScrollRow>
                    )}
                    {/* ARRANGÖRSSIDE-KNAPPEN (7/10 kväll, Josef: "jag måste
                        ju kunna gå till alla som är på arrangörssidan ifrån
                        eventkortet"): en riktig knapp till arrangörssidan med
                        ALLA deras event - sekundär (kontur) så den blå
                        stadssideknappen under behåller tyngden. Visas även
                        när raden är tom (sidan finns ju ändå). Värdnamnets
                        klick filtrerar fortfarande kartan (29/9-beslutet) -
                        det här är den egna vägen till sidan. */}
                    {organizerRow.slug && (
                        <a
                            href={organizerHref(organizerRow.slug)}
                            className={`group/arr flex items-center justify-center gap-2 w-full py-2.5 rounded-full border-2 border-[#006AA7]/30 text-[#006AA7] dark:text-sky-400 dark:border-sky-400/30 text-xs font-black uppercase tracking-wider hover:bg-[#006AA7]/5 hover:border-[#006AA7]/50 dark:hover:border-sky-400/50 transition-all active:scale-[0.98] ${organizerRow.rows.length > 0 ? 'mt-2.5' : ''}`}
                        >
                            <span className="truncate normal-case tracking-normal text-sm">Alla event från {organizerRow.name}</span>
                            <ArrowRight size={14} aria-hidden className="shrink-0 transition-transform group-hover/arr:translate-x-1" />
                        </a>
                    )}
                </div>
            )}
            {/* STADSSIDEKNAPPEN (7/10, Josef: "mer av en knapp som visar hur
                många de är kommande månaden i den staden") — ersätter den
                tunna textraden: blå knapp i kortets CTA-formspråk med
                månadens antal som underrad (samma tal som Månaden-fliken). */}
            <div className="px-4 md:px-6 py-3 border-t border-border">
                <a
                    href={cityHref}
                    className="group/stad flex flex-col items-center gap-0.5 w-full py-3 rounded-full bg-gradient-to-r from-[#0077BC] to-[#005590] text-white shadow-md shadow-sky-900/20 ring-1 ring-inset ring-white/25 hover:from-[#0083CE] hover:to-[#00619F] hover:shadow-lg transition-all active:scale-[0.98]"
                >
                    <span className="flex max-w-full items-center gap-2 px-4 text-sm font-black">
                        <span className="truncate">
                            {cityLink.label}
                            {q ? ` — sök "${q}"` : ''}
                        </span>
                        <ArrowRight size={15} aria-hidden className="shrink-0 transition-transform group-hover/stad:translate-x-1" />
                    </span>
                    {typeof cityCount === 'number' && cityCount > 0 && (
                        <span className="text-[11px] font-bold text-white/80 tabular-nums">
                            {cityCount} event kommande månaden
                        </span>
                    )}
                </a>
            </div>
        </div>
    );
}
