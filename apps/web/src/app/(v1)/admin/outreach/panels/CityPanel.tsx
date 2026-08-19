'use client';

// Städer — konsolens enda grupplista sedan 18/8 (ersatte Kön-fliken, som
// visade samma data i en annan layout). Två nivåer + en vy-toggle:
//
//   1. KORTVYN: ett kompakt kort per stad (namn, utbud, hur många grupper som
//      är redo/i karens), sorterat på bästa mogna score — samma ordning som
//      gamla Kön gav, så toppkortet ÄR nästa ställe att posta.
//   2. STADSVYN (klick på kortet): stadens grupper med Öppna gruppen-knapp
//      och utkastgeneratorn direkt i raden — kort → generera → posta, klart.
//   3. KARTAN (lista/karta-togglen, ersatte Karta-fliken 19/8): samma städer
//      som nålar + heatmap + vitfläckar — MapPanel, oförändrad inuti.
//
// Bygger helt på kö-svaret (queue + blocked = SAMTLIGA grupper).

import { useMemo, useState } from 'react';
import type { QueueItem, QueueResponse } from '@/types/outreach';
import { AlertTriangle, ArrowLeft, ExternalLink, LayoutGrid, Lock, MapPin, Plus, Search, Map as MapIcon } from 'lucide-react';
import { DraftGenerator, PostConfirm } from './DraftGenerator';
import { useDrafts } from './DraftStore';
import AddGroupForm from './AddGroupForm';
import MapPanel from './MapPanel';

interface CityBucket {
    name: string;
    citySlug: string | null;      // någon grupps stadssida — länken i stadsvyn
    supply?: number;              // eventutbudet denna vecka (max över grupperna)
    items: QueueItem[];           // mogna först (score desc), sedan blockerade
    readyCount: number;
    bestScore: number;            // bästa MOGNA score — kortens sorteringsnyckel
    earliestFree?: number;        // helblockerad stad: när öppnar första gruppen?
}

const fmtDate = (ms?: number) =>
    ms ? new Date(ms).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : null;

function buildBuckets(items: QueueItem[]): CityBucket[] {
    const byCity = new Map<string, QueueItem[]>();
    for (const item of items) {
        const key = item.contact.city?.trim() || 'Ort saknas';
        const list = byCity.get(key);
        if (list) list.push(item); else byCity.set(key, [item]);
    }
    const buckets: CityBucket[] = [];
    for (const [name, list] of byCity) {
        const ready = list.filter(i => !i.blocked).sort((a, b) => b.score - a.score);
        const blocked = list.filter(i => i.blocked)
            .sort((a, b) => (a.contact.nextAllowedAt ?? 0) - (b.contact.nextAllowedAt ?? 0));
        const supplies = list.map(i => i.contact.eventSupplyThisWeek).filter((v): v is number => v !== undefined);
        const nextFree = blocked.map(i => i.contact.nextAllowedAt).filter((v): v is number => !!v);
        buckets.push({
            name,
            citySlug: list.find(i => i.contact.citySlug)?.contact.citySlug ?? null,
            supply: supplies.length ? Math.max(...supplies) : undefined,
            items: [...ready, ...blocked],
            readyCount: ready.length,
            bestScore: ready.length ? ready[0].score : -1,
            earliestFree: nextFree.length ? Math.min(...nextFree) : undefined,
        });
    }
    // Städer med postbara grupper först (bästa score överst — kön-ordningen);
    // helblockerade sist, närmast frisläpp först.
    buckets.sort((a, b) => {
        if ((a.readyCount > 0) !== (b.readyCount > 0)) return a.readyCount > 0 ? -1 : 1;
        if (a.readyCount > 0) return b.bestScore - a.bestScore;
        return (a.earliestFree ?? Infinity) - (b.earliestFree ?? Infinity);
    });
    return buckets;
}

export default function CityPanel({ data, onChanged, view, onViewChange }: {
    data: QueueResponse;
    onChanged: () => void;
    /** lista/karta-togglen — bor i OutreachConsole (Shell breddas i kartläge). */
    view: 'lista' | 'karta';
    onViewChange: (v: 'lista' | 'karta') => void;
}) {
    const [filter, setFilter] = useState('');
    const [adding, setAdding] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const buckets = useMemo(() => buildBuckets([...data.queue, ...data.blocked]), [data]);

    // Vald stad kan ha döpts om/försvunnit efter en omladdning → tillbaka till korten.
    const sel = selected ? buckets.find(b => b.name === selected) : undefined;
    if (view === 'lista' && selected && sel) {
        return <CityDetail bucket={sel} onBack={() => setSelected(null)} onChanged={onChanged} />;
    }

    const q = filter.trim().toLowerCase();
    const shown = q
        ? buckets.filter(b =>
            b.name.toLowerCase().includes(q) ||
            b.items.some(i => i.contact.name.toLowerCase().includes(q)))
        : buckets;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <ViewToggle view={view} onChange={onViewChange} />
                {view === 'lista' && (
                    <label className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="search" value={filter} onChange={e => setFilter(e.target.value)}
                            placeholder="Filtrera ort eller grupp…"
                            className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 w-60" />
                    </label>
                )}
                <button onClick={() => setAdding(v => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#006AA7] text-white font-bold text-xs hover:bg-[#005590] transition-colors">
                    <Plus size={13} /> Lägg till grupp
                </button>
                <p className="text-[11px] font-bold text-slate-400">
                    {buckets.length} orter · {data.counts.groups} grupper — bästa posteringsläget överst
                </p>
            </div>

            {/* Ny grupp utan koordinat: kör "Geokoda grupper" i kartvyn efteråt,
                eller spara via vitfläcksraden där ortens koordinat följer med. */}
            {adding && (
                <AddGroupForm
                    onSaved={() => { setAdding(false); onChanged(); }}
                    onClose={() => setAdding(false)}
                />
            )}

            {view === 'karta' ? (
                <MapPanel />
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {shown.map(b => <CityCard key={b.name} bucket={b} onOpen={() => setSelected(b.name)} />)}
                    </div>
                    {shown.length === 0 && (
                        <p className="text-sm font-semibold text-slate-400">Ingen ort eller grupp matchar filtret.</p>
                    )}
                </>
            )}
        </div>
    );
}

/** Lista ⇄ karta — kartan är en vy på Städer, inte ett eget avsnitt (19/8). */
function ViewToggle({ view, onChange }: { view: 'lista' | 'karta'; onChange: (v: 'lista' | 'karta') => void }) {
    const btn = (active: boolean) =>
        `inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black transition-colors ${
            active ? 'bg-[#006AA7] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
        }`;
    return (
        <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
            <button type="button" onClick={() => onChange('lista')} className={btn(view === 'lista')}>
                <LayoutGrid size={13} /> Lista
            </button>
            <button type="button" onClick={() => onChange('karta')} className={btn(view === 'karta')}>
                <MapIcon size={13} /> Karta
            </button>
        </div>
    );
}

/* ── Stadskortet — hela kortet är klickbart och leder till generatorn ────── */

function CityCard({ bucket, onOpen }: { bucket: CityBucket; onOpen: () => void }) {
    const ready = bucket.readyCount > 0;
    return (
        <button type="button" onClick={onOpen}
            className={`text-left rounded-xl border bg-white p-3 transition-colors hover:border-[#006AA7] hover:bg-sky-50/40 ${
                ready ? 'border-slate-200' : 'border-slate-200 opacity-60'
            }`}>
            <p className="text-sm font-black text-slate-800 truncate">{bucket.name}</p>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                {bucket.supply !== undefined ? `${bucket.supply} event` : 'utbud okänt'}
                {' · '}{bucket.items.length} {bucket.items.length === 1 ? 'grupp' : 'grupper'}
            </p>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-black ${
                ready ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
                {ready
                    ? `${bucket.readyCount} redo att posta`
                    : bucket.earliestFree ? `karens till ${fmtDate(bucket.earliestFree)}` : 'spärrad'}
            </span>
        </button>
    );
}

/* ── Stadsvyn — gruppens FB-länk + generatorn, allt på ett ställe ────────── */

function CityDetail({ bucket, onBack, onChanged }: { bucket: CityBucket; onBack: () => void; onChanged: () => void }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={onBack}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors">
                    <ArrowLeft size={13} /> Alla städer
                </button>
                <h2 className="text-base font-black text-slate-900 inline-flex items-center gap-1.5">
                    <MapPin size={15} className="text-[#006AA7]" /> {bucket.name}
                </h2>
                <span className="text-[11px] font-bold text-slate-400">
                    {bucket.supply !== undefined ? `${bucket.supply} event denna vecka` : 'utbud okänt'}
                    {' · '}{bucket.items.length} {bucket.items.length === 1 ? 'grupp' : 'grupper'}
                </span>
                {bucket.citySlug && (
                    <a href={`/evenemang/${bucket.citySlug}`} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] font-black text-[#006AA7] hover:underline">
                        /evenemang/{bucket.citySlug} ↗
                    </a>
                )}
            </div>
            <ul className="flex flex-col gap-2">
                {bucket.items.map(item => <GroupRow key={item.contact.id} item={item} onChanged={onChanged} />)}
            </ul>
        </div>
    );
}

function GroupRow({ item, onChanged }: { item: QueueItem; onChanged: () => void }) {
    const c = item.contact;
    const { drafts } = useDrafts();
    const d = drafts[c.id];
    const draft = d?.status === 'done' ? d.result : null;
    const bodyText = draft
        ? (c.postingMode === 'direct' ? draft.drafts.v2Post : draft.drafts.v1)
        : undefined;
    const hardBlocks = item.gates.filter(g => g.hard && !g.ok);
    const softWarnings = item.gates.filter(g => !g.hard && !g.ok);
    const last = c.lastPostedAt
        ? `senast ${fmtDate(c.lastPostedAt)} — ${c.lastOutcome ?? 'okänt utfall'}`
        : 'aldrig postad — jungfrugrupp';

    return (
        <li className={`rounded-xl border border-slate-200 bg-white p-3.5 ${item.blocked ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-slate-800 min-w-0 flex-1 break-words">{c.name}</p>
                {typeof c.memberCount === 'number' && (
                    <span className="text-[11px] font-bold text-slate-400 shrink-0">{c.memberCount.toLocaleString('sv-SE')} medl.</span>
                )}
                {c.groupUrl ? (
                    <a href={c.groupUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#006AA7]/40 text-[#006AA7] font-black text-[11px] hover:bg-sky-50 transition-colors shrink-0">
                        <ExternalLink size={12} /> Öppna gruppen
                    </a>
                ) : (
                    <span className="text-[11px] font-bold text-slate-300 shrink-0">URL saknas</span>
                )}
            </div>

            {/* VARFÖR-raden: förklaringssträngen ur scoring — ägaren ska aldrig
                gissa varför en grupp är värd ett inlägg. */}
            <p className="text-[11px] font-bold text-slate-400 mt-1">Varför: {item.scoreExplanation}</p>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5">{last}</p>

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge tone="slate">{c.hasCityPage ? `/evenemang/${c.citySlug}` : 'vadkul.se'}</Badge>
                <Badge tone={c.postingMode === 'direct' ? 'green' : c.postingMode === 'approval' ? 'amber' : 'slate'}>
                    {c.postingMode === 'direct' ? 'publicerar direkt → V2'
                        : c.postingMode === 'approval' ? 'kräver godkännande → V1'
                        : 'okänt läge'}
                </Badge>
                {c.groupRulesNote && <Badge tone="amber">⚠ {c.groupRulesNote}</Badge>}
            </div>

            {(hardBlocks.length > 0 || softWarnings.length > 0) && (
                <div className="mt-2 flex flex-col gap-1">
                    {hardBlocks.map(g => (
                        <p key={g.id} className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500">
                            <Lock size={11} /> {g.label}
                        </p>
                    ))}
                    {softWarnings.map(g => (
                        <p key={g.id} className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                            <AlertTriangle size={11} /> {g.label} <span className="text-slate-300">({g.evidence})</span>
                        </p>
                    ))}
                </div>
            )}

            {/* Generatorn bara för mogna grupper — ett utkast till en grupp i
                karens vore färskvara som garanterat hinner ruttna. */}
            {!item.blocked && (
                <>
                    <DraftGenerator contactId={c.id} contactName={c.name} mode={c.postingMode} />
                    {/* Löpande bandets avbockning — samma POST som i Planering:
                        loggrad + karens, kön räknas om och gruppen lämnar listan. */}
                    <div className="mt-2">
                        <PostConfirm contactId={c.id} bodyText={bodyText} onPosted={onChanged} />
                    </div>
                </>
            )}
        </li>
    );
}

function Badge({ tone, children }: { tone: 'slate' | 'green' | 'amber'; children: React.ReactNode }) {
    const cls = {
        slate: 'bg-slate-100 text-slate-600',
        green: 'bg-emerald-50 text-emerald-700',
        amber: 'bg-amber-50 text-amber-700',
    }[tone];
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${cls}`}>{children}</span>;
}
