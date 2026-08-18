'use client';

// "Spara grupp"-formuläret — nya FB-grupper in i outreachContacts direkt från
// konsolen. Vitfläckslistan i Kartan förifyller ort + koordinat (då kan
// utbudet räknas direkt); Städer-fliken har en tom variant. POST
// /api/admin/outreach/contact skapar kontakten med samma id-konvention som
// import-skriptet, status 'orörd' → gruppen dyker upp i Städer/Planering
// vid nästa laddning.

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Save, X } from 'lucide-react';

export default function AddGroupForm({ initial, onSaved, onClose }: {
    initial?: { city?: string; lat?: number; lng?: number };
    onSaved: () => void;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [groupUrl, setGroupUrl] = useState('');
    const [city, setCity] = useState(initial?.city ?? '');
    const [memberCount, setMemberCount] = useState('');
    const [rulesNote, setRulesNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasCoord = initial?.lat !== undefined && initial?.lng !== undefined;

    const save = async () => {
        if (!user || busy) return;
        setBusy(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const members = parseInt(memberCount.replace(/\s/g, ''), 10);
            const res = await fetch('/api/admin/outreach/contact', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, groupUrl,
                    city: city || undefined,
                    // Ortens koordinat följer bara med om ORTEN står kvar — byter
                    // man ort i fältet vore vitfläckens koordinat en lögn.
                    ...(hasCoord && city === initial?.city ? { lat: initial!.lat, lng: initial!.lng } : {}),
                    ...(Number.isFinite(members) ? { memberCount: members } : {}),
                    ...(rulesNote.trim() ? { groupRulesNote: rulesNote.trim() } : {}),
                }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error ?? `Kunde inte spara (${res.status}).`);
                return;
            }
            onSaved();
        } catch {
            setError('Nätverksfel — försök igen.');
        } finally {
            setBusy(false);
        }
    };

    const field = 'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800';

    return (
        <div className="rounded-xl border border-[#006AA7]/30 bg-sky-50/60 p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-700">Spara ny grupp</p>
                <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
            </div>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Gruppens ORDAGRANNA namn (t.ex. Vad händer i Märsta)" className={field} />
            <input type="url" value={groupUrl} onChange={e => setGroupUrl(e.target.value)}
                placeholder="https://www.facebook.com/groups/…" className={field} />
            <div className="flex flex-wrap gap-2">
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                    placeholder="Ort" className={`${field} w-40`} />
                <input type="text" inputMode="numeric" value={memberCount} onChange={e => setMemberCount(e.target.value)}
                    placeholder="Medlemmar (valfritt)" className={`${field} w-40`} />
            </div>
            <input type="text" value={rulesNote} onChange={e => setRulesNote(e.target.value)}
                placeholder="Gruppregler/ämnesbegränsning (valfritt, t.ex. endast kultur)" className={field} />
            {hasCoord && city === initial?.city && (
                <p className="text-[11px] font-bold text-slate-400">
                    Koordinaten följer med från vitfläcken ({city}) — utbudet räknas direkt.
                </p>
            )}
            {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
            <button type="button" onClick={save} disabled={busy || !name.trim() || !groupUrl.trim()}
                className="self-start inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#006AA7] text-white font-bold text-xs hover:bg-[#005590] transition-colors disabled:opacity-40">
                {busy ? <><Loader2 size={12} className="animate-spin" /> Sparar…</> : <><Save size={12} /> Spara gruppen</>}
            </button>
        </div>
    );
}
