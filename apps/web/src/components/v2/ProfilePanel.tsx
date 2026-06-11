'use client';

import { useEffect, useState } from 'react';
import { LinkEvent } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import EventListRow from './EventListRow';
import { X, Pencil, Check, Heart, KeyRound, LogOut, Trash2, ChevronRight, ShieldCheck } from 'lucide-react';
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
}

/**
 * Hela kontot på ett ställe, utan att lämna kartan: namn (redigerbart),
 * e-post, egna event, sparat-genväg, lösenordsbyte, logga ut och radera
 * konto. Ersätter gamla profilmenyn + v1-profilsidan.
 */
export default function ProfilePanel({ open, onClose, myEvents, onPickEvent, onDeleteEvent, savedCount, onOpenSaved }: ProfilePanelProps) {
    const { user, logout, updateDisplayName, resetPassword, deleteAccount } = useAuth();
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Nollställ delstate när panelen stängs/öppnas så inget "fastnar".
    useEffect(() => {
        if (!open) { setEditingName(false); setConfirmingDelete(false); }
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
                        <span className="w-11 h-11 rounded-full bg-[#006AA7] text-white font-black text-lg flex items-center justify-center shrink-0">
                            {initial}
                        </span>
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

                        {/* Konto-åtgärder */}
                        <div className="border-t border-slate-100 dark:border-slate-800">
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
                            <button type="button" onClick={handleLogout} className={actionRow}>
                                <LogOut size={16} className="text-slate-500 shrink-0" />
                                <span className="flex-1">Logga ut</span>
                            </button>
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
                    </div>
                </div>
            </div>
        </>
    );
}
