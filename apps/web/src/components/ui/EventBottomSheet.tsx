'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { AppEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { calculateDistance, loadLocationFromLocalStorage } from '../../utils/mapUtils';
import { ArrowRight, Clock, MapPin, X, CheckCircle2 } from 'lucide-react';
import { EVENT_CATEGORIES, type EventCategoryType } from '../../utils/categories';

// Two snap points: peek shows ~45% of screen, full shows ~88%
const PEEK_VH = 45;
const FULL_VH = 88;

interface EventBottomSheetProps {
    event: AppEvent | null;
    onClose: () => void;
}

export function EventBottomSheet({ event, onClose }: EventBottomSheetProps) {
    const router = useRouter();
    const [heightVh, setHeightVh] = useState(PEEK_VH);
    const [isAnimating, setIsAnimating] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [distance, setDistance] = useState<number | null>(null);

    // Use refs for drag state to avoid stale closures
    const isDragging = useRef(false);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(PEEK_VH);
    const heightRef = useRef(PEEK_VH);

    const applyHeight = (vh: number) => {
        heightRef.current = vh;
        setHeightVh(vh);
    };

    useEffect(() => { setIsMounted(true); }, []);

    // Reset to peek when a new event opens
    useEffect(() => {
        if (event) {
            applyHeight(PEEK_VH);
            setIsAnimating(true);

            const userLoc = loadLocationFromLocalStorage();
            if (userLoc && event.lat && event.lng) {
                setDistance(calculateDistance(userLoc.lat, userLoc.lng, event.lat, event.lng));
            } else {
                setDistance(null);
            }
        }
    }, [event?.id]);

    // Lock page scroll while sheet is open
    useEffect(() => {
        if (event) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [event]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // --- Drag logic ---
    const startDrag = (clientY: number) => {
        isDragging.current = true;
        dragStartY.current = clientY;
        dragStartHeight.current = heightRef.current;
        setIsAnimating(false);
    };

    const moveDrag = (clientY: number) => {
        if (!isDragging.current) return;
        const deltaY = dragStartY.current - clientY; // positive = dragging up
        const deltaVh = (deltaY / window.innerHeight) * 100;
        const newH = Math.max(8, Math.min(95, dragStartHeight.current + deltaVh));
        applyHeight(newH);
    };

    const endDrag = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        setIsAnimating(true);

        const h = heightRef.current;
        if (h < 20) {
            onClose();
        } else if (h < (PEEK_VH + FULL_VH) / 2) {
            applyHeight(PEEK_VH);
        } else {
            applyHeight(FULL_VH);
        }
    };

    // Mouse drag (desktop)
    const onHandleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        startDrag(e.clientY);
        const onMove = (ev: MouseEvent) => moveDrag(ev.clientY);
        const onUp = () => {
            endDrag();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    if (!isMounted || !event) return null;

    const category = EVENT_CATEGORIES[event.type as EventCategoryType] || EVENT_CATEGORIES.other;
    const rawCoverImage = event.coverImage || category.defaultImage;
    const coverImage = typeof rawCoverImage === 'string' ? rawCoverImage : rawCoverImage.src;

    const confirmedAttendees = event.attendees.filter(a => a.status !== 'pending');
    const spotsLeft = event.maxParticipants - confirmedAttendees.length;
    const isFull = confirmedAttendees.length >= event.maxParticipants;
    const isGuaranteed = confirmedAttendees.length >= event.minParticipants;

    const formatDistance = (d: number) =>
        d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40"
                style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className="relative bg-background rounded-t-[2rem] shadow-[0_-8px_40px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden"
                style={{
                    height: `${heightVh}vh`,
                    transition: isAnimating ? 'height 0.35s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
                }}
            >
                {/* Drag handle */}
                <div
                    className="flex-shrink-0 flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
                    onMouseDown={onHandleMouseDown}
                    onTouchStart={(e) => startDrag(e.touches[0].clientY)}
                    onTouchMove={(e) => { e.preventDefault(); moveDrag(e.touches[0].clientY); }}
                    onTouchEnd={endDrag}
                >
                    <div className="w-12 h-1.5 bg-foreground/20 rounded-full" />
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {/* Cover image */}
                    <div className="relative w-full h-52 bg-muted flex-shrink-0">
                        <Image
                            unoptimized
                            src={coverImage}
                            alt={event.title}
                            fill
                            sizes="100vw"
                            className="object-cover"
                        />
                        {/* Gradient overlay at bottom of image */}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="px-5 pt-2 pb-10">
                        {/* Category badge */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${category.color}`}>
                                {category.emoji} {category.label}
                            </span>
                            {isGuaranteed && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 size={10} strokeWidth={3} /> Blir av!
                                </span>
                            )}
                        </div>

                        <h2 className="text-2xl font-black text-foreground leading-tight mb-3">
                            {event.title}
                        </h2>

                        {/* Time & location */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-sm font-semibold text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Clock size={14} className="text-primary" />
                                <span>{formatEventDate(event.time, (event as any).hasSpecificTime !== false)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin size={14} className="text-primary" />
                                <span>{event.location.name}</span>
                                {distance !== null && (
                                    <span className="text-[11px] text-muted-foreground/70 font-normal">• {formatDistance(distance)} bort</span>
                                )}
                            </div>
                        </div>

                        {/* Host + spots */}
                        <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Värd:</span>
                                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-border overflow-hidden">
                                    {event.host.photoURL ? (
                                        <img src={event.host.photoURL} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="font-bold text-[8px]">{event.host.initials}</span>
                                    )}
                                </div>
                                <span className="text-xs font-black text-foreground">{event.host.name}</span>
                            </div>
                            <span className="text-xs font-bold text-muted-foreground">
                                {isFull ? '🔴 Fullt' : `🟢 ${spotsLeft} platser kvar`}
                            </span>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words mb-6">
                            {event.description || 'Ingen beskrivning tillgänglig.'}
                        </p>

                        {/* CTA */}
                        <button
                            onClick={() => router.push(`/event/${event.id}`)}
                            className="flex items-center justify-center gap-3 w-full py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-black rounded-2xl shadow-lg transition-all active:scale-[0.97]"
                        >
                            <span>GÅ TILL EVENT</span>
                            <ArrowRight size={22} />
                        </button>
                    </div>
                </div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>,
        document.body
    );
}
