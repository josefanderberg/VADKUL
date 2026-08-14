'use client';

// Kopiera-knapp med "✓ Kopierad"-kvitto. Delad av TodayPanel och SharePanel —
// hela konsolen bygger på att text flyttas till urklipp och klistras in för
// hand, så kvittot är inte kosmetik: utan det vet man inte om klicket tog.

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ text, title, label }: { text: string; title: string; label?: string }) {
    const [done, setDone] = useState(false);
    return (
        <button type="button" title={title}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    setDone(true);
                    setTimeout(() => setDone(false), 1500);
                } catch { /* clipboard nekad — inget att göra */ }
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border transition-colors shrink-0 ${
                done ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                     : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {done ? <><Check size={11} /> Kopierad</> : <><Copy size={11} /> {label ?? 'Kopiera'}</>}
        </button>
    );
}
