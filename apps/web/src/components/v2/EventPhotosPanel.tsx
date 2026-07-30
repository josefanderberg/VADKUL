'use client';

import { useState, useEffect } from 'react';
import { Camera, ImagePlus, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { eventPhotoService, photoScore } from '@/services/eventPhotoService';
import type { EventPhoto } from '@/types';
import toast from 'react-hot-toast';

interface Props {
    eventId: string;
    eventTitle: string;
    /** Öppna inloggningsmodalen (utan att lämna sidan). */
    onRequireLogin: () => void;
}

/**
 * Livebilder från ett event — bor i eventkortets utfällda läge, ovanför chatten.
 * Alla kan titta och se poängen; ladda upp och rösta kräver konto (CTA öppnar
 * auth-modalen). Sorteras poäng-fallande så de bästa bilderna ligger överst.
 */
export default function EventPhotosPanel({ eventId, eventTitle, onRequireLogin }: Props) {
    const { user } = useAuth();
    const [photos, setPhotos] = useState<EventPhoto[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const unsubscribe = eventPhotoService.subscribeToPhotos(eventId, setPhotos);
        return () => unsubscribe();
    }, [eventId]);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !user || uploading) return;
        if (!file.type.startsWith('image/')) { toast.error('Välj en bildfil.'); return; }
        setUploading(true);
        try {
            await eventPhotoService.addPhoto(eventId, eventTitle, user, file);
            toast.success('Bilden är uppe! 📸');
        } catch (error) {
            console.error(error);
            toast.error('Kunde inte ladda upp bilden.');
        } finally {
            setUploading(false);
        }
    };

    const handleVote = async (photo: EventPhoto, dir: 1 | -1) => {
        if (!user) { onRequireLogin(); return; }
        const current = photo.voters?.[user.uid];
        try {
            // Samma knapp igen = ångra rösten, annars byt/sätt.
            await eventPhotoService.vote(photo.id, user.uid, current === dir ? null : dir);
        } catch (error) {
            console.error(error);
            toast.error('Kunde inte rösta.');
        }
    };

    const handleDelete = async (photo: EventPhoto) => {
        try {
            await eventPhotoService.deletePhoto(photo.id);
            toast.success('Bilden är borttagen.');
        } catch (error) {
            console.error(error);
            toast.error('Kunde inte ta bort bilden.');
        }
    };

    return (
        <div className="flex flex-col rounded-xl border border-border bg-slate-50 dark:bg-slate-900/40 overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-white/60 dark:bg-slate-900/60">
                <Camera size={14} className="text-[#006AA7]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Livebilder {photos.length > 0 && `· ${photos.length}`}
                </span>
            </div>

            {photos.length === 0 ? (
                <p className="text-center text-xs font-semibold text-slate-400 px-3 py-4">
                    Inga bilder än — dela den första från eventet! 📸
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-2 p-3">
                    {photos.map((photo) => {
                        const myVote = user ? photo.voters?.[user.uid] : undefined;
                        const score = photoScore(photo);
                        return (
                            <figure key={photo.id} className="relative rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-border shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photo.url}
                                    alt={`Livebild av ${photo.userName || 'deltagare'}`}
                                    loading="lazy"
                                    className="w-full aspect-square object-cover"
                                />
                                {user?.uid === photo.uid && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(photo)}
                                        aria-label="Ta bort min bild"
                                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 transition-colors"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                                <figcaption className="flex items-center justify-between px-2 py-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 truncate mr-1">
                                        {photo.userName || 'Deltagare'}
                                    </span>
                                    <span className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleVote(photo, 1)}
                                            aria-label="Rösta upp"
                                            aria-pressed={myVote === 1}
                                            className={`p-1 rounded-full transition-colors ${myVote === 1 ? 'bg-[#006AA7] text-white' : 'text-slate-400 hover:text-[#006AA7] hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                        >
                                            <ThumbsUp size={13} />
                                        </button>
                                        <span className={`text-[11px] font-black tabular-nums min-w-[1.25rem] text-center ${score > 0 ? 'text-[#006AA7]' : score < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                            {score > 0 ? `+${score}` : score}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleVote(photo, -1)}
                                            aria-label="Rösta ned"
                                            aria-pressed={myVote === -1}
                                            className={`p-1 rounded-full transition-colors ${myVote === -1 ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                        >
                                            <ThumbsDown size={13} />
                                        </button>
                                    </span>
                                </figcaption>
                            </figure>
                        );
                    })}
                </div>
            )}

            {user ? (
                <label className={`m-2 px-4 py-2 rounded-full bg-[#006AA7] text-white text-xs font-bold text-center transition-colors ${uploading ? 'opacity-50' : 'cursor-pointer hover:bg-[#005590]'}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
                    <span className="inline-flex items-center gap-1.5">
                        <ImagePlus size={14} />
                        {uploading ? 'Laddar upp…' : 'Dela en bild från eventet'}
                    </span>
                </label>
            ) : (
                <button
                    type="button"
                    onClick={onRequireLogin}
                    className="m-2 px-4 py-2 rounded-full bg-[#006AA7] text-white text-xs font-bold hover:bg-[#005590] transition-colors"
                >
                    Logga in för att dela bilder
                </button>
            )}
        </div>
    );
}
