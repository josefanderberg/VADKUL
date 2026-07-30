'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { MessageCircle, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { LinkEvent } from '@/types';

/** Innehållet i latestActivity/latestComment — speglas av chattens sendMessage. */
interface LatestComment {
    senderId: string;
    senderName: string;
    text: string;
    eventId: string;
    eventTitle: string;
    createdAt?: Timestamp;
}

interface Props {
    /** HELA event-poolen (alla dagar) — bubblan visas bara när kommentarens
     *  event går att slå upp här, så klicket alltid har någonstans att landa. */
    events: LinkEvent[];
    /** Hoppa till eventet (byter dag + väljer det — samma som sök/sparat). */
    onPick: (evt: LinkEvent) => void;
}

/**
 * Bubbla längst upp på kartan med den SENASTE chattkommentaren på sajten och
 * vilket event den hör till. Klick → hoppa till det eventet. Krysset döljer
 * just den kommentaren; nästa nya kommentar väcker bubblan igen.
 */
export default function LatestCommentBubble({ events, onPick }: Props) {
    const [comment, setComment] = useState<LatestComment | null>(null);
    // Millis för den senast BORTKRYSSADE kommentaren — nyare väcker bubblan igen.
    const [dismissedAt, setDismissedAt] = useState<number | null>(null);

    useEffect(() => {
        const unsubscribe = onSnapshot(
            doc(db, 'latestActivity', 'latestComment'),
            (snap) => setComment(snap.exists() ? (snap.data() as LatestComment) : null),
            // Saknad behörighet/offline får aldrig störa kartan — bubblan uteblir bara.
            () => setComment(null)
        );
        return () => unsubscribe();
    }, []);

    const event = useMemo(
        () => (comment ? events.find(e => e.id === comment.eventId) ?? null : null),
        [comment, events]
    );

    if (!comment || !event) return null;
    const createdMs = comment.createdAt?.toMillis?.() ?? 0;
    if (dismissedAt !== null && createdMs <= dismissedAt) return null;

    return (
        <div className="fixed top-[4.5rem] inset-x-0 z-[1040] flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1 max-w-sm rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg border border-white/50 dark:border-slate-700 pl-3 pr-1.5 py-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <button
                    type="button"
                    onClick={() => onPick(event)}
                    className="flex items-center gap-2 min-w-0 text-left"
                >
                    <MessageCircle size={14} className="shrink-0 text-[#006AA7]" />
                    <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                            <span className="font-black text-[#006AA7] dark:text-sky-300">{comment.senderName}:</span>{' '}
                            {comment.text}
                        </span>
                        <span className="block text-[10px] font-bold text-slate-400 truncate">
                            {event.title}
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setDismissedAt(createdMs)}
                    aria-label="Dölj senaste kommentaren"
                    className="shrink-0 w-6 h-6 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 flex items-center justify-center transition-colors"
                >
                    <X size={13} />
                </button>
            </div>
        </div>
    );
}
