'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { linkEventService } from '../../../services/linkEventService';
import { useAuth } from '../../../context/AuthContext';
import Layout from '../../../components/layout/Layout';
import type { LinkEvent } from '../../../types';
import toast from 'react-hot-toast';
import { ExternalLink, Trash2, MapPin, ArrowLeft, Upload, Eye, Edit, Map, LayoutGrid, List, Terminal } from 'lucide-react';
import { parseImportJSON, mapToLinkEvent, compareEvents, type SyncComparison } from '../../../utils/eventImport';
import { CATEGORY_LIST } from '../../../utils/categories';
import type { EventCategoryType } from '../../../utils/categories';
import dynamic from 'next/dynamic';
import LinkEventCard from '../../../components/ui/LinkEventCard';

const AdminLocationPickerMap = dynamic(() => import('../../../components/admin/AdminLocationPickerMap'), {
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full flex items-center justify-center bg-slate-100 rounded-xl border border-slate-300">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    )
});

const AdminLinkEventsMap = dynamic(() => import('../../../components/admin/AdminLinkEventsMap'), {
    ssr: false,
    loading: () => (
        <div className="h-[500px] w-full flex items-center justify-center bg-slate-100 rounded-xl border border-slate-300">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-slate-500 text-sm">Laddar karta...</span>
        </div>
    )
});

interface ScraperLog {
    type: 'start' | 'info' | 'log' | 'warn' | 'error' | 'done';
    message: string;
    exitCode?: number;
}

export default function LinkEventsAdminPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [linkEvents, setLinkEvents] = useState<LinkEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [locationName, setLocationName] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [hostName, setHostName] = useState('');
    const [category, setCategory] = useState<EventCategoryType | ''>('');
    const [coverImage, setCoverImage] = useState('');
    const [price, setPrice] = useState('');

    // JSON Sync state
    const [jsonInput, setJsonInput] = useState('');
    const [preview, setPreview] = useState<SyncComparison | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncMode, setSyncMode] = useState<'replace' | 'merge'>('merge');

    // Scraper state
    const [isScraping, setIsScraping] = useState(false);
    const [scraperLogs, setScraperLogs] = useState<ScraperLog[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // View state
    const [showMap, setShowMap] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

    // Strikt admin check
    if (!user || user.email !== 'admin@admin.com') {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                    <h1 className="text-2xl font-bold mb-2">Åtkomst nekad</h1>
                    <p className="text-muted-foreground mb-6">Du har inte behörighet att se denna sida.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
                    >
                        Gå till startsidan
                    </button>
                </div>
            </Layout>
        );
    }

    useEffect(() => {
        fetchLinkEvents();
    }, []);

    // Auto-scroll terminal logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [scraperLogs]);

    const fetchLinkEvents = async () => {
        try {
            const events = await linkEventService.getAll(false);
            setLinkEvents(events);
        } catch (error) {
            console.error('Failed to fetch link events:', error);
            toast.error('Kunde inte hämta länk-events');
        }
    };

    const handleClearAll = async () => {
        if (linkEvents.length === 0) {
            toast.error('Inga events att rensa');
            return;
        }
        if (!confirm(`VARNING: Detta kommer att ta bort ALLA ${linkEvents.length} länk-event permanent. Är du säker?`)) return;

        setLoading(true);
        try {
            await linkEventService.bulkDelete(linkEvents.map(e => e.id));
            toast.success(`${linkEvents.length} events rensade!`);
            setJsonInput('');
            setPreview(null);
            await fetchLinkEvents();
        } catch (error) {
            console.error('Failed to clear events:', error);
            toast.error('Kunde inte rensa events');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title || !url || !date || !time || !locationName || !lat || !lng || !hostName) {
            toast.error('Fyll i alla fält!');
            return;
        }

        try { new URL(url); } catch { toast.error('Ogiltig URL!'); return; }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        if (isNaN(latitude) || isNaN(longitude)) { toast.error('Ogiltiga koordinater!'); return; }

        setLoading(true);
        try {
            const dateTime = new Date(`${date}T${time}`);
            const parsedPrice = price === '' ? undefined : (price.toLowerCase() === 'gratis' ? 'Gratis' : parseFloat(price) || price);

            const eventPayload = {
                title,
                url,
                time: dateTime,
                locationName,
                lat: latitude,
                lng: longitude,
                hostName,
                ...(category ? { category: category as EventCategoryType } : {}),
                ...(coverImage ? { coverImage } : {}),
                ...(parsedPrice !== undefined ? { price: parsedPrice } : {})
            };

            if (editingEventId) {
                await linkEventService.update(editingEventId, eventPayload);
                toast.success('Länk-event uppdaterat!');
            } else {
                await linkEventService.create(eventPayload);
                toast.success('Länk-event skapat!');
            }

            setTitle(''); setUrl(''); setDate(''); setTime('');
            setLocationName(''); setLat(''); setLng('');
            setHostName(''); setCategory(''); setCoverImage(''); setPrice('');
            setEditingEventId(null);
            await fetchLinkEvents();
        } catch (error: any) {
            console.error('Failed to save link event:', error);
            toast.error('Kunde inte spara länk-event');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (event: LinkEvent) => {
        setTitle(event.title);
        setUrl(event.url);
        setDate(event.time.toISOString().split('T')[0]);
        setTime(event.time.toTimeString().substring(0, 5));
        setLocationName(event.locationName);
        setLat(event.lat.toString());
        setLng(event.lng.toString());
        setHostName(event.hostName);
        setCategory(event.category || '');
        setCoverImage(event.coverImage || '');
        setPrice(event.price !== undefined ? String(event.price) : '');
        setEditingEventId(event.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setTitle(''); setUrl(''); setDate(''); setTime('');
        setLocationName(''); setLat(''); setLng('');
        setHostName(''); setCategory(''); setCoverImage(''); setPrice('');
        setEditingEventId(null);
    };

    const handleDelete = async (id: string, title: string) => {
        if (!id) { toast.error('Ogiltigt event ID'); return; }
        if (!confirm(`Ta bort "${title || 'detta event'}"?`)) return;

        setLoading(true);
        try {
            await linkEventService.delete(id);
            toast.success('Länk-event borttaget!');
            await fetchLinkEvents();
        } catch (error: any) {
            console.error('Failed to delete link event:', error);
            toast.error('Kunde inte ta bort länk-event');
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = () => {
        try {
            const data = parseImportJSON(jsonInput);
            const mapped = data.events.map(mapToLinkEvent).filter(e => e !== null) as Omit<LinkEvent, 'id' | 'createdAt'>[];
            if (mapped.length === 0) { toast.error('Inga giltiga events hittades i JSON'); return; }
            const comparison = compareEvents(linkEvents, mapped);
            setPreview(comparison);
            const msg = syncMode === 'replace'
                ? `Förhandsgranskning klar! ${comparison.toAdd.length} nya, ${comparison.toKeep.length} bevarade, ${comparison.toRemove.length} tas bort`
                : `Förhandsgranskning klar! Hittade ${comparison.toAdd.length} nya events.`;
            toast.success(msg);
        } catch (error: any) {
            console.error('Preview error:', error);
            toast.error(error.message || 'Kunde inte tolka JSON');
            setPreview(null);
        }
    };

    const handleSync = async () => {
        if (!preview) { toast.error('Klicka på "Förhandsgranska" först!'); return; }

        if (syncMode === 'replace' && preview.toRemove.length > 0) {
            if (!confirm(`VARNING: Detta kommer att ta bort ${preview.toRemove.length} befintliga event. Är du säker?`)) return;
        } else if (syncMode === 'merge' && preview.toAdd.length === 0) {
            toast.success('Alla events i JSON finns redan!');
            setPreview(null);
            setJsonInput('');
            return;
        }

        setSyncing(true);
        try {
            if (syncMode === 'replace' && preview.toRemove.length > 0) {
                await linkEventService.bulkDelete(preview.toRemove.map(e => e.id));
            }
            if (preview.toAdd.length > 0) {
                await linkEventService.bulkCreate(preview.toAdd);
            }
            const successMsg = syncMode === 'replace'
                ? `Synkronisering klar! +${preview.toAdd.length} nya, -${preview.toRemove.length} borttagna`
                : `Klart! Lade till ${preview.toAdd.length} nya events.`;
            toast.success(successMsg);
            setPreview(null);
            await fetchLinkEvents();
        } catch (error: any) {
            console.error('Sync error:', error);
            toast.error('Kunde inte synkronisera events');
        } finally {
            setSyncing(false);
        }
    };

    const handleRunScrapers = async () => {
        setIsScraping(true);
        setScraperLogs([]);
        setShowLogs(true);

        try {
            const response = await fetch('/api/admin/scrape/stream', { method: 'POST' });

            if (!response.body) throw new Error('No response body from scrape endpoint');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split('\n\n');
                buffer = chunks.pop() || '';

                for (const chunk of chunks) {
                    if (chunk.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(chunk.slice(6)) as ScraperLog;
                            setScraperLogs(prev => [...prev, data]);
                        } catch { /* ignore parse errors */ }
                    }
                }
            }

            await fetchLinkEvents();
        } catch (error) {
            console.error('Error running scrapers:', error);
            setScraperLogs(prev => [...prev, { type: 'error', message: `Anslutningsfel: ${String(error)}` }]);
            toast.error('Kunde inte ansluta till skrap-botens API.');
        } finally {
            setIsScraping(false);
        }
    };

    const hasAutoLoaded = useRef(false);

    const handleLoadExisting = (silent = false) => {
        if (linkEvents.length === 0) {
            if (!silent) toast.error('Inga befintliga events att ladda');
            return;
        }
        const data = {
            stad: 'Växjö',
            period: 'Nuvarande',
            evenemang: linkEvents.map(event => ({
                datum: event.time.toISOString().split('T')[0],
                tid: event.time.toTimeString().substring(0, 5),
                evenemang: event.title,
                plats: event.locationName,
                latitud: event.lat,
                longitud: event.lng,
                arrangor: event.hostName,
                webbplats: event.url,
                kategori: event.category,
                bild: event.coverImage,
                pris: event.price
            }))
        };
        setJsonInput(JSON.stringify(data, null, 2));
        setPreview(null);
        if (!silent) toast.success('Befintliga events laddade till JSON!');
    };

    useEffect(() => {
        if (linkEvents.length > 0 && !jsonInput) {
            handleLoadExisting(true);
        }
    }, [linkEvents.length, !!jsonInput]);

    // Format price for display
    const formatPrice = (p: number | string | undefined) => {
        if (p === undefined || p === null) return 'Okänt';
        if (p === 0 || String(p).toLowerCase() === 'gratis') return 'Gratis';
        if (typeof p === 'number') return `${p} kr`;
        return String(p);
    };

    return (
        <Layout>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
                <div className="max-w-6xl mx-auto">

                    {/* Header */}
                    <div className="mb-6">
                        <button
                            onClick={() => router.push('/admin')}
                            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-4 transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span>Tillbaka till Admin Dashboard</span>
                        </button>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Länk-Events Hantering</h1>
                                <p className="text-slate-500 dark:text-slate-400 mt-1">
                                    {linkEvents.length} event totalt
                                    {linkEvents.filter(e => e.lat && e.lng).length < linkEvents.length && (
                                        <span className="text-amber-500 ml-2">
                                            · {linkEvents.length - linkEvents.filter(e => e.lat && e.lng).length} saknar koordinater
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleRunScrapers}
                                    disabled={isScraping}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition disabled:opacity-50 text-sm"
                                >
                                    {isScraping ? (
                                        <>
                                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                            Skrapar...
                                        </>
                                    ) : (
                                        <>▶ Kör Skrapor Nu</>
                                    )}
                                </button>
                                {(scraperLogs.length > 0 || showLogs) && (
                                    <button
                                        onClick={() => setShowLogs(!showLogs)}
                                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition text-sm"
                                    >
                                        <Terminal size={16} />
                                        {showLogs ? 'Dölj logg' : 'Visa logg'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ─── Scraper Terminal ─── */}
                    {showLogs && (
                        <div className="mb-6 bg-slate-950 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="text-slate-400 text-xs font-mono ml-2">scraper-terminal — npm start</span>
                                    {isScraping && (
                                        <span className="text-xs text-green-400 font-mono animate-pulse ml-2">● kör</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowLogs(false)}
                                    className="text-slate-500 hover:text-white text-xs transition"
                                >
                                    ✕ Stäng
                                </button>
                            </div>
                            <div className="p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-0.5">
                                {scraperLogs.length === 0 && (
                                    <div className="text-slate-600 italic">Inga loggar än...</div>
                                )}
                                {scraperLogs.map((log, i) => (
                                    <div key={i} className={`leading-relaxed whitespace-pre-wrap ${log.type === 'error' ? 'text-red-400' :
                                            log.type === 'warn' ? 'text-yellow-400' :
                                                log.type === 'done' ? 'text-green-400 font-bold' :
                                                    log.type === 'start' ? 'text-cyan-400 font-bold' :
                                                        log.type === 'info' ? 'text-blue-400' :
                                                            'text-slate-300'
                                        }`}>
                                        {(log.type === 'log') ? `> ${log.message}` : log.message}
                                    </div>
                                ))}
                                {isScraping && (
                                    <div className="text-green-400 animate-pulse">▌</div>
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    )}

                    {/* ─── Map Section ─── */}
                    <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Map size={18} className="text-blue-600" />
                                Karta — alla {linkEvents.filter(e => e.lat && e.lng).length} event
                            </h2>
                            <button
                                onClick={() => setShowMap(!showMap)}
                                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                            >
                                {showMap ? 'Dölj karta' : 'Visa karta'}
                            </button>
                        </div>
                        {showMap && (
                            <div className="p-4">
                                <AdminLinkEventsMap
                                    linkEvents={linkEvents}
                                    onDeleteEvent={fetchLinkEvents}
                                />
                            </div>
                        )}
                    </div>

                    {/* ─── JSON Sync Section ─── */}
                    <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                        <h2 className="text-xl font-bold mb-2 text-blue-900 dark:text-blue-300 flex items-center gap-2">
                            <Upload className="text-blue-600" />
                            JSON Synkronisering
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 mb-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Synk-läge:</label>
                                <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                                    <button
                                        onClick={() => { setSyncMode('merge'); setPreview(null); }}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${syncMode === 'merge' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        Lägg till nya
                                    </button>
                                    <button
                                        onClick={() => { setSyncMode('replace'); setPreview(null); }}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${syncMode === 'replace' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500'}`}
                                    >
                                        Full Synk (Ersätt)
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">JSON Data</label>
                                <button
                                    onClick={() => handleLoadExisting()}
                                    className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-2 py-1 rounded transition flex items-center gap-1 text-slate-700 dark:text-slate-300"
                                >
                                    <Eye size={12} />
                                    Ladda befintliga
                                </button>
                            </div>

                            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                                <p className="font-bold mb-1">Tips om synlighet</p>
                                <p>Endast event med datum idag eller framåt visas på startsidan. Gamla event sparas i databasen men döljs automatiskt.</p>
                            </div>

                            <textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm"
                                placeholder='{"city": "Växjö", "evenemang": [...]}'
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={handlePreview}
                                    disabled={!jsonInput || syncing}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50"
                                >
                                    <Eye size={18} />
                                    Förhandsgranska
                                </button>
                                {preview && (
                                    <button
                                        onClick={handleSync}
                                        disabled={syncing}
                                        className={`flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg transition disabled:opacity-50 ${syncMode === 'replace' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        <Upload size={18} />
                                        {syncing ? 'Synkroniserar...' : (syncMode === 'replace' ? 'Full synk (Ersätt allt)' : 'Lägg till nya')}
                                    </button>
                                )}
                            </div>

                            {preview && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                        <h3 className="font-bold text-green-900 dark:text-green-300 mb-2">+ Nya ({preview.toAdd.length})</h3>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {preview.toAdd.length === 0
                                                ? <p className="text-xs text-green-700 dark:text-green-400 italic">Inga nya events</p>
                                                : preview.toAdd.map((evt, i) => <p key={i} className="text-xs text-green-800 dark:text-green-300 truncate">• {evt.title}</p>)
                                            }
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                        <h3 className="font-bold text-yellow-900 dark:text-yellow-300 mb-2">• Bevarade ({preview.toKeep.length})</h3>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {preview.toKeep.length === 0
                                                ? <p className="text-xs text-yellow-700 dark:text-yellow-400 italic">Inga bevarade events</p>
                                                : preview.toKeep.map((evt) => <p key={evt.id} className="text-xs text-yellow-800 dark:text-yellow-300 truncate">• {evt.title}</p>)
                                            }
                                        </div>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                        <h3 className="font-bold text-red-900 dark:text-red-300 mb-2">− Tas bort ({preview.toRemove.length})</h3>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {preview.toRemove.length === 0
                                                ? <p className="text-xs text-red-700 dark:text-red-400 italic">Inga events tas bort</p>
                                                : preview.toRemove.map((evt) => <p key={evt.id} className="text-xs text-red-800 dark:text-red-300 truncate">• {evt.title}</p>)
                                            }
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Form + Event List Grid ─── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Left: Create/Edit Form */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800">
                            <h2 className="text-xl font-bold mb-4 text-purple-900 dark:text-purple-300 flex items-center gap-2">
                                <ExternalLink className="text-purple-600" />
                                {editingEventId ? 'Redigera Länk-Event' : 'Skapa Nytt Länk-Event'}
                            </h2>

                            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Titel</label>
                                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="T.ex. Konsert i Konserthuset" />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">URL</label>
                                    <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="https://example.com" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Datum</label>
                                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tid</label>
                                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Värdnamn</label>
                                    <input type="text" value={hostName} onChange={(e) => setHostName(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="T.ex. Upplev Växjö" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Pris</label>
                                        <input type="text" value={price} onChange={(e) => setPrice(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                            placeholder="T.ex. 150 eller Gratis" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
                                        <select value={category} onChange={(e) => setCategory(e.target.value as EventCategoryType | '')}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                                            <option value="">— Ingen —</option>
                                            {CATEGORY_LIST.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.emoji} {cat.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Bild-URL (valfritt)</label>
                                    <input type="url" value={coverImage} onChange={(e) => setCoverImage(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="https://example.com/image.jpg" />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                        <MapPin size={14} />
                                        Platsnamn
                                    </label>
                                    <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="T.ex. Vida Arena" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Latitud</label>
                                        <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                            placeholder="56.8796" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Longitud</label>
                                        <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                            placeholder="14.8094" />
                                    </div>
                                </div>

                                <div className="my-4">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Välj plats på karta</label>
                                    <p className="text-xs text-slate-500 mb-2">Klicka på kartan för att sätta koordinater automatiskt.</p>
                                    <AdminLocationPickerMap
                                        initialLat={lat ? parseFloat(lat) : 56.8796}
                                        initialLng={lng ? parseFloat(lng) : 14.8094}
                                        onLocationChange={(newLat, newLng) => {
                                            setLat(newLat.toFixed(6));
                                            setLng(newLng.toFixed(6));
                                        }}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    {editingEventId && (
                                        <button type="button" onClick={handleCancelEdit}
                                            className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-800 py-3 px-4 rounded-lg font-bold transition">
                                            Avbryt
                                        </button>
                                    )}
                                    <button type="submit" disabled={loading}
                                        className={`${editingEventId ? 'w-2/3' : 'w-full'} bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-bold transition disabled:opacity-50`}>
                                        {loading ? 'Sparar...' : (editingEventId ? 'Spara Ändringar' : 'Skapa Länk-Event')}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Right: Event List */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                    Befintliga ({linkEvents.length})
                                </h2>
                                <div className="flex items-center gap-2">
                                    {/* View mode toggle */}
                                    <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg">
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-1.5 rounded transition ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow' : 'text-slate-500'}`}
                                            title="Listvy"
                                        >
                                            <List size={14} />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('cards')}
                                            className={`p-1.5 rounded transition ${viewMode === 'cards' ? 'bg-white dark:bg-slate-600 shadow' : 'text-slate-500'}`}
                                            title="Kortvy"
                                        >
                                            <LayoutGrid size={14} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleRunScrapers}
                                        disabled={isScraping}
                                        className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {isScraping ? (
                                            <>
                                                <div className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full" />
                                                Skrapar...
                                            </>
                                        ) : (
                                            <>▶ Skrapa</>
                                        )}
                                    </button>
                                    {linkEvents.length > 0 && (
                                        <button
                                            onClick={handleClearAll}
                                            disabled={loading}
                                            className="text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition disabled:opacity-50"
                                        >
                                            Rensa alla
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* List View */}
                            {viewMode === 'list' && (
                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {linkEvents.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic text-center py-8">
                                            Inga länk-events än.
                                        </p>
                                    ) : (
                                        linkEvents.map((event) => (
                                            <div key={event.id}
                                                className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                                            >
                                                {event.coverImage && (
                                                    <div className="hidden sm:block w-16 h-12 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden shrink-0">
                                                        <img src={event.coverImage} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{event.title || 'Okänt event'}</p>
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                                                            📅 {event.time.toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
                                                            📍 {event.locationName || 'Okänd plats'}
                                                        </span>
                                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                                                            🌐 {event.lat ? `${event.lat.toFixed(4)},${event.lng?.toFixed(4)}` : 'Saknar koordinater'}
                                                        </span>
                                                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                                                            💰 {formatPrice(event.price)}
                                                        </span>
                                                        {event.category && (
                                                            <span className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-mono">
                                                                🏷️ {event.category}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                                                            👤 {event.hostName}
                                                        </span>
                                                    </div>
                                                    <a href={event.url} target="_blank" rel="noopener noreferrer"
                                                        className="text-[10px] text-blue-500 hover:underline truncate block mt-1">
                                                        {event.url}
                                                    </a>
                                                </div>
                                                <div className="flex flex-col gap-1.5 shrink-0">
                                                    <button onClick={() => handleEdit(event)} disabled={loading}
                                                        className="px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-xs font-bold hover:bg-blue-100 transition flex items-center gap-1">
                                                        <Edit size={12} />Redigera
                                                    </button>
                                                    <button onClick={() => handleDelete(event.id, event.title || 'Okänt event')} disabled={loading}
                                                        className="px-2 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded text-xs font-bold hover:bg-red-100 transition flex items-center gap-1">
                                                        <Trash2 size={12} />Ta bort
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Cards View */}
                            {viewMode === 'cards' && (
                                <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-1">
                                    {linkEvents.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic text-center py-8">Inga länk-events än.</p>
                                    ) : (
                                        linkEvents.map((event) => (
                                            <LinkEventCard
                                                key={event.id}
                                                linkEvent={event}
                                                isAdmin={true}
                                                onDelete={fetchLinkEvents}
                                            />
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Full-width Cards Grid ─── */}
                    {linkEvents.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <LayoutGrid size={20} className="text-purple-600" />
                                    Alla event som kort — {linkEvents.length} st
                                </h2>
                                <span className="text-xs text-slate-500">Som det ser ut på startsidan</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {linkEvents.map((event) => (
                                    <LinkEventCard
                                        key={event.id}
                                        linkEvent={event}
                                        isAdmin={true}
                                        onDelete={fetchLinkEvents}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
