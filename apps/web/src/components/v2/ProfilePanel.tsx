'use client';

import { useEffect, useRef, useState } from 'react';
import { LinkEvent } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import { storageService } from '@/services/storageService';
import EventListRow from './EventListRow';
import { X, Pencil, Check, Heart, KeyRound, LogOut, Trash2, ChevronRight, ChevronDown, Settings, ShieldCheck, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfilePanelProps {
    open: boolean;
    onClose: () => void;
    /** Användarens egna skapade event (filtrerade ur eventlistan i page). */
    myEvents: LinkEvent[];
    onPickEvent: (evt: LinkEvent) => void;
    onDeleteEvent: (id: string) => void;
    savedCount: number;
    /** Byt till sparat-panelen (stänger profilen). */
    onOpenSaved: () => void;
    /** Spelarens valda Reviret-färg (färgton 0–359), null = standard (per uid).
     *  Väljaren är gömd just nu, men propsen behålls (page → karta-färg). */
    reviretHue: number | null;
    /** Anropas när spelaren väljer en ny färg (page sparar + speglar). Gömd just nu. */
    onChangeHue: (hue: number) => void;
}

/**
 * Hela kontot på ett ställe, utan att lämna kartan: namn (redigerbart),
 * e-post, egna event, sparat-genväg, lösenordsbyte, logga ut och radera
 * konto. Ersätter gamla profilmenyn + v1-profilsidan.
 */
export default function ProfilePanel({ open, onClose, myEvents, onPickEvent, onDeleteEvent, savedCount, onOpenSaved }: ProfilePanelProps) {
    const { user, logout, updateDisplayName, updatePhotoURL, resetPassword, deleteAccount } = useAuth();
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // tillåt att välja samma fil igen
        if (!file || !user) return;
        if (!file.type.startsWith('image/')) { toast.error('Välj en bildfil.'); return; }
        setUploadingPhoto(true);
        try {
            // Skriv över samma sökväg (ingen avslutande /) → en bild per användare.
            const url = await storageService.uploadFile(`users/${user.uid}/profile_pic`, file);
            // Cache-bust så <img> hämtar den nya bilden direkt (samma URL annars).
            const busted = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
            await updatePhotoURL(busted);
            await userService.updatePhotoURL(user.uid, busted).catch(() => {});
            toast.success('Profilbild uppdaterad!');
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte ladda upp bilden. Försök igen.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // Nollställ delstate när panelen stängs/öppnas så inget "fastnar".
    useEffect(() => {
        if (!open) { setEditingName(false); setConfirmingDelete(false); setSettingsOpen(false); }
    }, [open]);

    if (!open || !user) return null;

    const displayName = user.displayName || 'VADKUL-användare';
    const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();

    const startEditName = () => {
        setNameDraft(user.displayName || '');
        setEditingName(true);
    };

    const saveName = async () => {
        const name = nameDraft.trim();
        if (!name || name === user.displayName) { setEditingName(false); return; }
        setSavingName(true);
        try {
            await updateDisplayName(name);
            // Spegla även till users-dokumentet (visas i chatt/profiler).
            await userService.updateDisplayName(user.uid, name).catch(() => { /* doc-spegling är best effort */ });
            toast.success('Namnet är uppdaterat!');
            setEditingName(false);
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte byta namn. Försök igen.');
        } finally {
            setSavingName(false);
        }
    };

    const handleResetPassword = async () => {
        try {
            await resetPassword();
            toast.success(`Återställningslänk skickad till ${user.email}`);
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte skicka återställningslänken.');
        }
    };

    const handleLogout = async () => {
        await logout();
        onClose();
        toast.success('Du är utloggad.');
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            // Dokumentet först (kräver inloggning) — best effort, Auth-raderingen
            // är det viktiga. Sen försvinner sessionen av sig själv.
            await userService.deleteUserDoc(user.uid).catch(err =>
                console.warn('Kunde inte radera users-dokumentet:', err));
            await deleteAccount();
            onClose();
            toast.success('Ditt konto är raderat.');
        } catch (err: any) {
            console.error(err);
            if (String(err?.code).includes('requires-recent-login')) {
                toast.error('Av säkerhetsskäl: logga ut, logga in igen och radera kontot direkt efteråt.');
            } else {
                toast.error('Kunde inte radera kontot. Försök igen.');
            }
        } finally {
            setDeleting(false);
            setConfirmingDelete(false);
        }
    };

    const actionRow = 'w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800/60 transition-colors text-left';

    return (
        <>
            {/* Klick utanför stänger panelen */}
            <div className="fixed inset-0 z-[1030]" onClick={onClose} />
            <div className="absolute top-[4.6rem] left-4 right-4 sm:right-auto sm:w-[420px] z-[1040] pointer-events-auto">
                <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-white/60 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[min(70vh,34rem)] animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* Identitet */}
                    <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 shrink-0">
                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoPick}
                            className="hidden"
                            aria-hidden
                        />
                        <button
                            type="button"
                            onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
                            disabled={uploadingPhoto}
                            aria-label="Byt profilbild"
                            title="Byt profilbild"
                            className="relative w-11 h-11 rounded-full shrink-0 group overflow-visible"
                        >
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-11 h-11 rounded-full object-cover" />
                            ) : (
                                <span className="w-11 h-11 rounded-full bg-[#006AA7] text-white font-black text-lg flex items-center justify-center">
                                    {initial}
                                </span>
                            )}
                            {/* Kamera-badge i hörnet visar att bilden är klickbar/bytbar. */}
                            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center shadow-sm">
                                {uploadingPhoto
                                    ? <span className="w-3 h-3 rounded-full border-2 border-[#006AA7] border-t-transparent animate-spin" />
                                    : <Camera size={11} className="text-[#006AA7]" />}
                            </span>
                        </button>
                        <div className="flex-1 min-w-0">
                            {editingName ? (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={nameDraft}
                                        onChange={e => setNameDraft(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                                        maxLength={50}
                                        autoFocus
                                        className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-white focus:border-[#006AA7] focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={saveName}
                                        disabled={savingName}
                                        aria-label="Spara namnet"
                                        className="p-1.5 rounded-full bg-[#006AA7] text-white hover:bg-[#005590] disabled:opacity-50 transition-colors shrink-0"
                                    >
                                        <Check size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="font-black text-base text-black dark:text-white truncate">{displayName}</p>
                                    <button
                                        type="button"
                                        onClick={startEditName}
                                        aria-label="Byt namn"
                                        title="Byt namn"
                                        className="p-1 text-slate-400 hover:text-[#006AA7] transition-colors shrink-0"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                </div>
                            )}
                            <p className="text-xs font-semibold text-slate-500 truncate">{user.email}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Stäng"
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1 shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar">
                        {/* Sparade event — genväg till hjärt-panelen */}
                        <button type="button" onClick={onOpenSaved} className={actionRow}>
                            <Heart size={16} className="text-rose-500 shrink-0" fill={savedCount > 0 ? 'currentColor' : 'none'} />
                            <span className="flex-1">Sparade event</span>
                            <span className="text-xs font-black text-slate-400 tabular-nums">{savedCount}</span>
                            <ChevronRight size={15} className="text-slate-400 shrink-0" />
                        </button>

                        {/* Min spelfärg (Reviret) är gömd för tillfället — färg-plumbningen
                            finns kvar (page → karta), men väljaren visas inte här just nu. */}

                        {/* Mina event */}
                        <div className="border-t border-slate-100 dark:border-slate-800">
                            <div className="px-4 pt-3 pb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Mina event · {myEvents.length}
                                </span>
                            </div>
                            {myEvents.length === 0 ? (
                                <p className="px-4 pb-3 text-xs text-slate-400 font-semibold">
                                    Du har inte skapat några event än — tryck på + uppe till höger på kartan.
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {myEvents.map(evt => (
                                        <EventListRow
                                            key={evt.id}
                                            evt={evt}
                                            onPick={onPickEvent}
                                            right={
                                                <button
                                                    type="button"
                                                    onClick={() => { if (confirm(`Ta bort "${evt.title}" permanent?`)) onDeleteEvent(evt.id); }}
                                                    title="Ta bort eventet"
                                                    aria-label="Ta bort eventet"
                                                    className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            }
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Inställningar — utfällbar mapp: klick visar de 3 alternativen */}
                        <div className="border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setSettingsOpen(o => !o)}
                                aria-expanded={settingsOpen}
                                className={actionRow}
                            >
                                <Settings size={16} className="text-slate-500 shrink-0" />
                                <span className="flex-1">Inställningar</span>
                                <ChevronDown
                                    size={16}
                                    className={`text-slate-400 shrink-0 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                            {settingsOpen && (
                                <div className="bg-slate-50/70 dark:bg-slate-800/30">
                                    <button type="button" onClick={handleResetPassword} className={actionRow}>
                                        <KeyRound size={16} className="text-[#006AA7] shrink-0" />
                                        <span className="flex-1">Byt lösenord</span>
                                        <span className="text-[10px] font-bold text-slate-400">via e-post</span>
                                    </button>
                                    <a href="/integritet" target="_blank" rel="noopener" className={actionRow}>
                                        <ShieldCheck size={16} className="text-slate-500 shrink-0" />
                                        <span className="flex-1">Integritet</span>
                                        <ChevronRight size={15} className="text-slate-400 shrink-0" />
                                    </a>
                                    {confirmingDelete ? (
                                        <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 flex flex-col gap-2">
                                            <p className="text-xs font-bold text-red-600">
                                                Säker? Kontot och din profil raderas permanent.
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleDeleteAccount}
                                                    disabled={deleting}
                                                    className="px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-black disabled:opacity-50 transition-colors"
                                                >
                                                    {deleting ? 'Raderar…' : 'Ja, radera kontot'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingDelete(false)}
                                                    className="px-3.5 py-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 text-xs font-bold transition-colors"
                                                >
                                                    Avbryt
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmingDelete(true)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                                        >
                                            <Trash2 size={16} className="shrink-0" />
                                            <span className="flex-1">Radera konto</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Logga ut — under mappen, egen rad */}
                        <div className="border-t border-slate-100 dark:border-slate-800">
                            <button type="button" onClick={handleLogout} className={actionRow}>
                                <LogOut size={16} className="text-slate-500 shrink-0" />
                                <span className="flex-1">Logga ut</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
