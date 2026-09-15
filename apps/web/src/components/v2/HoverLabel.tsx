'use client';

/**
 * Namn-etikett som tonar in vid hover/fokus — exakt samma formspråk som
 * kategoricirklarnas etiketter hade. Måste ligga som peer-syskon EFTER knappen
 * i DOM (krav för peer-selektorn); raden runtomkring avgör sedan om den hamnar
 * till höger (flex-row) eller vänster (flex-row-reverse) om knappen. Ligger
 * kvar i flödet men är pointer-events-none, och raden runt om är också
 * pointer-events-none så den osynliga etikettytan inte slukar kartklick.
 * `show` håller den framme utan hover (visningsrundan efter veckoblinken).
 */
export default function HoverLabel({ children, show = false }: { children: React.ReactNode; show?: boolean }) {
    return (
        <span
            aria-hidden
            className={`pointer-events-none ${show ? 'opacity-100' : 'opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100'} transition-opacity duration-150 whitespace-nowrap rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-slate-700 shadow-lg border border-white/50`}
        >
            {children}
        </span>
    );
}
