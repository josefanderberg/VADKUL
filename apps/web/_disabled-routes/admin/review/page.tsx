/**
 * /admin/review — manuell granskning av AI-flaggade events
 *
 * Visar lista över events som AI:n flaggat som suspect/junk + redan hidden.
 * Per event: bild, plats, beskrivning, AI-verdict + reason.
 * Knappar: Visa (gör synlig) / Dölj (sätt hidden=true) / Öppna källa.
 */

'use client';

import { useEffect, useState } from 'react';
import { getAuthHeaders } from '@/lib/authHeaders';

interface AiAudit {
    verdict: 'ok' | 'suspect' | 'junk';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    inSweden: boolean;
    at: any;
    model: string;
}

interface Event {
    firestoreId: string;
    url: string;
    title: string;
    time: string;
    locationName: string;
    extractedAddress: string;
    lat: number;
    lng: number;
    hostName: string;
    category: string;
    coverImage: string;
    description: string;
    hidden: boolean;
    isLocationVerified: boolean;
    aiAudit: AiAudit | null;
}

interface Counts {
    total: number;
    suspect: number;
    junk: number;
    hidden: number;
    foreign: number;
    auditedTotal: number;
}

type Filter = 'all' | 'suspect' | 'junk' | 'foreign' | 'hidden';

export default function ReviewPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [counts, setCounts] = useState<Counts | null>(null);
    const [filter, setFilter] = useState<Filter>('all');
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<Record<string, boolean>>({});

    async function load() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ verdict: filter });
            if (filter === 'hidden') params.set('showHidden', 'true');
            const res = await fetch(`/api/admin/review?${params}`, { headers: { ...(await getAuthHeaders()) } });
            const data = await res.json();
            setEvents(data.events || []);
            setCounts(data.counts);
        } catch (e) {
            console.error('Load failed', e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [filter]);

    async function setHidden(e: Event, hidden: boolean) {
        setUpdating(s => ({ ...s, [e.firestoreId]: true }));
        try {
            const res = await fetch(`/api/link-events?id=${encodeURIComponent(e.url || e.firestoreId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
                body: JSON.stringify({ hidden }),
            });
            if (!res.ok) throw new Error(await res.text());
            // Lokala uppdateringar utan reload
            setEvents(prev => prev.map(x => x.firestoreId === e.firestoreId ? { ...x, hidden } : x));
        } catch (err) {
            console.error('Update failed', err);
            alert('Misslyckades: ' + (err as Error).message);
        } finally {
            setUpdating(s => ({ ...s, [e.firestoreId]: false }));
        }
    }

    const formatDate = (d: string) => new Date(d).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <h1 style={{ marginTop: 0 }}>Event-granskning</h1>
            <p style={{ color: '#666' }}>
                Manuell granskning av events som AI:n flaggat som misstänkta eller junk, samt redan dolda.
            </p>

            {counts && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    <FilterBtn label={`Allt (${counts.suspect + counts.junk + counts.hidden})`} active={filter === 'all'} onClick={() => setFilter('all')} />
                    <FilterBtn label={`❓ Misstänkta (${counts.suspect})`} active={filter === 'suspect'} onClick={() => setFilter('suspect')} />
                    <FilterBtn label={`🗑️ Junk (${counts.junk})`} active={filter === 'junk'} onClick={() => setFilter('junk')} />
                    <FilterBtn label={`🌍 Utomlands (${counts.foreign})`} active={filter === 'foreign'} onClick={() => setFilter('foreign')} />
                    <FilterBtn label={`👁️ Dolda (${counts.hidden})`} active={filter === 'hidden'} onClick={() => setFilter('hidden')} />
                    <div style={{ marginLeft: 'auto', color: '#999', fontSize: '0.85rem' }}>
                        {counts.auditedTotal} / {counts.total} auditerade
                    </div>
                </div>
            )}

            {loading && <p>Laddar…</p>}
            {!loading && events.length === 0 && <p style={{ color: '#666' }}>Inga events att visa.</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {events.map(e => (
                    <div key={e.firestoreId} style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', background: e.hidden ? '#fafafa' : 'white', opacity: e.hidden ? 0.7 : 1 }}>
                        {e.coverImage ? (
                            <img src={e.coverImage} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', background: '#eee' }} onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                            <div style={{ width: '100%', height: 160, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Ingen bild</div>
                        )}
                        <div style={{ padding: '0.75rem 1rem' }}>
                            <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem' }}>{e.title || '(ingen titel)'}</h3>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                📅 {formatDate(e.time)}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>
                                📍 {e.locationName || '(saknas)'} {!e.isLocationVerified && '⚠️'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>
                                {e.hostName} · ({e.lat.toFixed(3)}, {e.lng.toFixed(3)})
                            </div>

                            {e.aiAudit && (
                                <div style={{ marginTop: '0.6rem', padding: '0.4rem 0.6rem', background: verdictBg(e.aiAudit.verdict), borderRadius: 4, fontSize: '0.8rem' }}>
                                    <strong>{verdictEmoji(e.aiAudit.verdict)} {e.aiAudit.verdict}/{e.aiAudit.confidence}{!e.aiAudit.inSweden ? ' 🌍' : ''}</strong>
                                    <div style={{ marginTop: 2 }}>{e.aiAudit.reason}</div>
                                </div>
                            )}

                            {e.description && (
                                <p style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.6rem', maxHeight: 60, overflow: 'hidden' }}>
                                    {e.description.slice(0, 200)}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                {e.hidden ? (
                                    <button onClick={() => setHidden(e, false)} disabled={updating[e.firestoreId]} style={btnPrimary}>👁️ Visa igen</button>
                                ) : (
                                    <button onClick={() => setHidden(e, true)} disabled={updating[e.firestoreId]} style={btnDanger}>🗑️ Dölj</button>
                                )}
                                <a href={e.url} target="_blank" rel="noreferrer" style={btnSecondary}>🔗 Källa</a>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            padding: '0.4rem 0.9rem',
            border: '1px solid #ccc',
            background: active ? '#222' : 'white',
            color: active ? 'white' : '#222',
            borderRadius: 999,
            cursor: 'pointer',
            fontSize: '0.85rem',
        }}>{label}</button>
    );
}

function verdictBg(v: string): string {
    if (v === 'junk') return '#fde4e4';
    if (v === 'suspect') return '#fdf4d4';
    return '#e4fde4';
}

function verdictEmoji(v: string): string {
    if (v === 'junk') return '🗑️';
    if (v === 'suspect') return '❓';
    return '✅';
}

const btnBase: React.CSSProperties = {
    padding: '0.4rem 0.8rem',
    borderRadius: 4,
    border: '1px solid',
    cursor: 'pointer',
    fontSize: '0.85rem',
    textDecoration: 'none',
    display: 'inline-block',
};
const btnPrimary: React.CSSProperties = { ...btnBase, borderColor: '#2563eb', background: '#2563eb', color: 'white' };
const btnDanger: React.CSSProperties = { ...btnBase, borderColor: '#dc2626', background: 'white', color: '#dc2626' };
const btnSecondary: React.CSSProperties = { ...btnBase, borderColor: '#ccc', background: 'white', color: '#222' };
