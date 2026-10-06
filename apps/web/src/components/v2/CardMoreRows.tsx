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
     *  användarskapad) — raden visas ändå, utan sidlänken. */
    slug: string | null;
    name: string;
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
export default function CardMoreRows({ organizerRow, onSelect, cityLink, searchQ }: CardMoreRowsProps) {
    const q = searchQ?.trim();
    const cityHref = q
        ? `${cityLink.href}${cityLink.href.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`
        : cityLink.href;
    return (
        <div className="border-t border-border">
            {organizerRow && (
                <div className="px-4 md:px-6 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 truncate">
                            Fler från {organizerRow.name}
                        </span>
                        {organizerRow.slug && (
                            <a
                                href={organizerHref(organizerRow.slug)}
                                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#006AA7] dark:text-sky-400 hover:underline"
                            >
                                Arrangörssidan
                                <ArrowRight size={11} aria-hidden />
                            </a>
                        )}
                    </div>
                    {/* -mx/px: raden rullar ända ut till kortets kanter, som
                        tid/plats-raden. data-hscroll (inuti HScrollRow) låter
                        kortets gestlogik släppa vågräta svep hit. */}
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
                </div>
            )}
            <a
                href={cityHref}
                className="flex items-center justify-between gap-2 px-4 md:px-6 py-2.5 border-t border-border text-xs font-black text-[#006AA7] dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
                <span className="truncate">
                    {cityLink.label}
                    {q ? ` — sök "${q}"` : ''}
                </span>
                <ArrowRight size={14} aria-hidden className="shrink-0" />
            </a>
        </div>
    );
}
