'use client';

// Utkast-docken (19/8) — flytande panel nere till höger, synlig i ALLA flikar.
// Svaret på "går det inte i bakgrunden så man kan klicka ner och se dem
// senare?": docken listar allt i DraftStore (skriver/klart/fel) och varje rad
// fälls ut till hela utkastet med kopiera-knappar — man behöver aldrig leta
// upp rätt flik och rätt rad igen för att hämta ett färdigt utkast.

import { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, NotebookPen, X } from 'lucide-react';
import { useDrafts, type DraftState } from './DraftStore';
import { DraftResultView } from './DraftGenerator';

const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

export default function DraftDock() {
    const { drafts } = useDrafts();
    const [open, setOpen] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    // Skrivande överst (senast startad först), sedan klara (färskast först), sist fel.
    const entries = Object.entries(drafts).sort(([, a], [, b]) => {
        const rank = (s: DraftState) => s.status === 'loading' ? 0 : s.status === 'done' ? 1 : 2;
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        const t = (s: DraftState) => s.status === 'loading' ? s.startedAt : s.status === 'done' ? s.generatedAt : 0;
        return t(b) - t(a);
    });
    if (entries.length === 0) return null;

    const writing = entries.filter(([, s]) => s.status === 'loading').length;
    const done = entries.filter(([, s]) => s.status === 'done').length;
    const failed = entries.filter(([, s]) => s.status === 'error').length;

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)}
                className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#006AA7] text-white text-xs font-black shadow-lg hover:bg-[#005590] transition-colors">
                {writing > 0
                    ? <><Loader2 size={13} className="animate-spin" /> {writing} skriver…</>
                    : <><NotebookPen size={13} /> {done} utkast</>}
                {failed > 0 && <span className="text-rose-200">· {failed} fel</span>}
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-[26rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
                <NotebookPen size={14} className="text-[#006AA7]" />
                <p className="text-xs font-black text-slate-700 flex-1">
                    Utkast
                    <span className="ml-2 font-bold text-slate-400">
                        {writing > 0 && `${writing} skriver · `}{done} klara{failed > 0 && ` · ${failed} fel`}
                    </span>
                </p>
                <button type="button" onClick={() => setOpen(false)} title="Minimera"
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                    <X size={14} />
                </button>
            </div>

            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {entries.map(([contactId, s]) => (
                    <li key={contactId}>
                        <button type="button"
                            onClick={() => setExpanded(v => v === contactId ? null : contactId)}
                            className="w-full text-left px-3.5 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors">
                            {s.status === 'loading' && <Loader2 size={13} className="animate-spin text-[#006AA7] shrink-0" />}
                            {s.status === 'done' && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                            {s.status === 'error' && <AlertCircle size={13} className="text-rose-500 shrink-0" />}
                            <span className="text-xs font-bold text-slate-700 truncate flex-1">{s.contactName}</span>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                {s.status === 'loading' ? 'skriver…'
                                    : s.status === 'done' ? fmtTime(s.generatedAt)
                                    : 'fel'}
                            </span>
                            {s.status === 'done' && (
                                <ChevronDown size={13} className={`shrink-0 text-slate-300 transition-transform ${expanded === contactId ? 'rotate-180' : ''}`} />
                            )}
                        </button>
                        {expanded === contactId && s.status === 'done' && (
                            <div className="px-3.5 pb-3">
                                <DraftResultView result={s.result} mode={s.result.meta.postingMode} generatedAt={s.generatedAt} />
                            </div>
                        )}
                        {expanded === contactId && s.status === 'error' && (
                            <p className="px-3.5 pb-3 text-[11px] font-bold text-rose-600">{s.error}</p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
