'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { linkEventService } from '../../../services/linkEventService';
import { useAuth } from '../../../context/AuthContext';
import Layout from '../../../components/layout/Layout';
import type { LinkEvent } from '../../../types';
import toast from 'react-hot-toast';
import { ExternalLink, Trash2, MapPin, ArrowLeft, Upload, Eye, Edit } from 'lucide-react';
import { parseImportJSON, mapToLinkEvent, compareEvents, type SyncComparison } from '../../../utils/eventImport';
import { CATEGORY_LIST } from '../../../utils/categories';
import type { EventCategoryType } from '../../../utils/categories';
import dynamic from 'next/dynamic';

const AdminLocationPickerMap = dynamic(() => import('../../../components/admin/AdminLocationPickerMap'), {
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full flex items-center justify-center bg-slate-100 rounded-xl border border-slate-300">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    )
});

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

    // JSON Sync state
    const [jsonInput, setJsonInput] = useState('');
    const [preview, setPreview] = useState<SyncComparison | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncMode, setSyncMode] = useState<'replace' | 'merge'>('merge');

    // Strikt admin check
    if (!user || user.email !== 'admin@admin.com') {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                    <h1 className="text-2xl font-bold mb-2">Åtkomst nekad</h1>
                    <p className="text-muted-foreground mb-6">
                        Du har inte behörighet att se denna sida.
                    </p>
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

    const fetchLinkEvents = async () => {
        try {
            // Get ALL events for admin (past and future)
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

        if (!confirm(`VARNING: Detta kommer att ta bort ALLA ${linkEvents.length} länk-event permanent. Är du säker?`)) {
            return;
        }

        setLoading(true);
        try {
            const eventIds = linkEvents.map(e => e.id);
            await linkEventService.bulkDelete(eventIds);
            toast.success(`${eventIds.length} events rensade!`);

            // Clear inputs and refresh
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

        // Validate URL
        try {
            new URL(url);
        } catch {
            toast.error('Ogiltig URL!');
            return;
        }

        // Validate coordinates
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        if (isNaN(latitude) || isNaN(longitude)) {
            toast.error('Ogiltiga koordinater!');
            return;
        }

        setLoading(true);
        try {
            const dateTime = new Date(`${date}T${time}`);

            const eventPayload = {
                title,
                url,
                time: dateTime,
                locationName,
                lat: latitude,
                lng: longitude,
                hostName,
                ...(category ? { category: category as EventCategoryType } : {})
            };

            if (editingEventId) {
                await linkEventService.update(editingEventId, eventPayload);
                toast.success('Länk-event uppdaterat!');
            } else {
                await linkEventService.create(eventPayload);
                toast.success('Länk-event skapat!');
            }

            // Reset form
            setTitle('');
            setUrl('');
            setDate('');
            setTime('');
            setLocationName('');
            setLat('');
            setLng('');
            setHostName('');
            setCategory('');
            setEditingEventId(null);

            // Refresh list
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
        // Time adjustment for Sweden timezone simply by taking the local time string HH:MM
        setTime(event.time.toTimeString().substring(0, 5));
        setLocationName(event.locationName);
        setLat(event.lat.toString());
        setLng(event.lng.toString());
        setHostName(event.hostName);
        setCategory(event.category || '');
        setEditingEventId(event.id);

        // Scroll to the top where the form is
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setTitle('');
        setUrl('');
        setDate('');
        setTime('');
        setLocationName('');
        setLat('');
        setLng('');
        setHostName('');
        setCategory('');
        setEditingEventId(null);
    };

    const handleDelete = async (id: string, title: string) => {
        // Add defensive check
        if (!id) {
            toast.error('Ogiltigt event ID');
            return;
        }

        const eventTitle = title || 'detta event';
        if (!confirm(`Ta bort "${eventTitle}"?`)) return;

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
            // Parse JSON
            const data = parseImportJSON(jsonInput);

            // Map to LinkEvent format
            const mapped = data.events
                .map(mapToLinkEvent)
                .filter(e => e !== null) as Omit<LinkEvent, 'id' | 'createdAt'>[];

            if (mapped.length === 0) {
                toast.error('Inga giltiga events hittades i JSON');
                return;
            }

            // Compare with existing events
            const comparison = compareEvents(linkEvents, mapped);
            setPreview(comparison);

            const msg = syncMode === 'replace'
                ? `Förhandsgranskning klar! %N% nya, %K% bevarade, %R% tas bort`
                : `Förhandsgranskning klar! Hittade %N% nya events att lägga till.`;

            toast.success(msg
                .replace('%N%', comparison.toAdd.length.toString())
                .replace('%K%', comparison.toKeep.length.toString())
                .replace('%R%', comparison.toRemove.length.toString())
            );
        } catch (error: any) {
            console.error('Preview error:', error);
            toast.error(error.message || 'Kunde inte tolka JSON');
            setPreview(null);
        }
    };

    const handleSync = async () => {
        if (!preview) {
            toast.error('Klicka på "Förhandsgranska" först!');
            return;
        }

        // Confirm if removing events in replace mode
        if (syncMode === 'replace' && preview.toRemove.length > 0) {
            const confirmed = confirm(
                `VARNING: Detta kommer att ta bort ${preview.toRemove.length} befintliga event. Är du säker?`
            );
            if (!confirmed) return;
        } else if (syncMode === 'merge' && preview.toAdd.length === 0) {
            toast.success('Alla events i JSON finns redan!');
            setPreview(null);
            setJsonInput('');
            return;
        }

        setSyncing(true);
        try {
            // Delete events ONLY if mode is 'replace'
            if (syncMode === 'replace' && preview.toRemove.length > 0) {
                await linkEventService.bulkDelete(preview.toRemove.map(e => e.id));
            }

            // Create new events from JSON
            if (preview.toAdd.length > 0) {
                await linkEventService.bulkCreate(preview.toAdd);
            }

            const successMsg = syncMode === 'replace'
                ? `Synkronisering klar! +${preview.toAdd.length} nya, -${preview.toRemove.length} borttagna`
                : `Klart! Lade till ${preview.toAdd.length} nya events.`;

            toast.success(successMsg);

            // Reset and refresh (JSON input is kept)
            setPreview(null);
            await fetchLinkEvents();
        } catch (error: any) {
            console.error('Sync error:', error);
            toast.error('Kunde inte synkronisera events');
        } finally {
            setSyncing(false);
        }
    };

    const hasAutoLoaded = useRef(false);

    const handleLoadExisting = (silent = false) => {
        if (linkEvents.length === 0) {
            if (!silent) toast.error('Inga befintliga events att ladda');
            return;
        }

        console.log(`[Admin] Formatting ${linkEvents.length} events for JSON`);
        const data = {
            stad: 'Växjö',
            period: 'Nuvarande',
            evenemang: linkEvents.map(event => ({
                datum: event.time.toISOString().split('T')[0],
                tid: event.time.toTimeString().substring(0, 5),
                evenemang: event.title,
                plats: event.locationName,
                arrangor: event.hostName,
                webbplats: event.url,
                kategori: event.category
            }))
        };

        const jsonString = JSON.stringify(data, null, 2);
        setJsonInput(jsonString);
        setPreview(null);
        if (!silent) toast.success('Befintliga events laddade till JSON!');
    };

    // Auto-load existing events once when they are first fetched
    useEffect(() => {
        if (linkEvents.length > 0 && !jsonInput) {
            console.log('[Admin] Proactive auto-load triggering');
            handleLoadExisting(true);
        }
    }, [linkEvents.length, !!jsonInput]);

    return (
        <Layout>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => router.push('/admin')}
                            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-4 transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span>Tillbaka till Admin Dashboard</span>
                        </button>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Länk-Events Hantering</h1>
                        <p className="text-slate-500 dark:text-slate-400">Skapa och hantera externa event som visas på startsidan</p>
                    </div>

                    {/* JSON Sync Section */}
                    <div className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                        <h2 className="text-xl font-bold mb-2 text-blue-900 dark:text-blue-300 flex items-center gap-2">
                            <Upload className="text-blue-600" />
                            JSON Synkronisering
                        </h2>
                        <div className="space-y-4">
                            {/* Sync Mode Toggle */}
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
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                                    JSON Data
                                </label>
                                <button
                                    onClick={() => handleLoadExisting()}
                                    className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-2 py-1 rounded transition flex items-center gap-1 text-slate-700 dark:text-slate-300"
                                >
                                    <Eye size={12} />
                                    Ladda befintliga
                                </button>
                            </div>

                            {/* Visibility Notice */}
                            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                                <p className="font-bold mb-1">💡 Tips om synlighet</p>
                                <p>Endast event med datum **idag eller framåt** visas på startsidan. Gamla event sparas i databasen men döljs automatiskt för användarna.</p>
                            </div>

                            <div>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm"
                                    placeholder='{"city": "Växjö", "evenemang": [...]}'
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handlePreview}
                                    disabled={!jsonInput || syncing}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
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

                            {/* Preview Results */}
                            {preview && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                                    {/* New Events */}
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                        <h3 className="font-bold text-green-900 dark:text-green-300 mb-2 flex items-center gap-2">
                                            <span className="text-xl">+</span>
                                            Nya ({preview.toAdd.length})
                                        </h3>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {preview.toAdd.length === 0 ? (
                                                <p className="text-xs text-green-700 dark:text-green-400 italic">Inga nya events</p>
                                            ) : (
                                                preview.toAdd.map((evt, i) => (
                                                    <p key={i} className="text-xs text-green-800 dark:text-green-300 truncate">
                                                        • {evt.title}
                                                    </p>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Keep Events */}
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                        <h3 className="font-bold text-yellow-900 dark:text-yellow-300 mb-2 flex items-center gap-2">
                                            <span className="text-xl">•</span>
                                            Bevarade ({preview.toKeep.length})
                                        </h3>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {preview.toKeep.length === 0 ? (
                                                <p className="text-xs text-yellow-700 dark:text-yellow-400 italic">Inga bevarade events</p>
                                            ) : (
                                                preview.toKeep.map((evt) => (
                                                    <p key={evt.id} className="text-xs text-yellow-800 dark:text-yellow-300 truncate">
                                                        • {evt.title}
                                                    </p>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Remove Events */}
                                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                        <h3 className="font-bold text-red-900 dark:text-red-300 mb-2 flex items-center gap-2">
                                            <span className="text-xl">−</span>
                                            Tas bort ({preview.toRemove.length})
                                        </h3>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {preview.toRemove.length === 0 ? (
                                                <p className="text-xs text-red-700 dark:text-red-400 italic">Inga events tas bort</p>
                                            ) : (
                                                preview.toRemove.map((evt) => (
                                                    <p key={evt.id} className="text-xs text-red-800 dark:text-red-300 truncate">
                                                        • {evt.title}
                                                    </p>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left: Create Form */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800">
                            <h2 className="text-xl font-bold mb-4 text-purple-900 dark:text-purple-300 flex items-center gap-2">
                                <ExternalLink className="text-purple-600" />
                                Skapa Nytt Länk-Event
                            </h2>

                            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Titel</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="T.ex. Black Friday Rea!"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">URL</label>
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="https://example.com"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Datum</label>
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tid</label>
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Värdnamn</label>
                                    <input
                                        type="text"
                                        value={hostName}
                                        onChange={(e) => setHostName(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="T.ex. Vadkul, Vårkul, etc."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori (valfritt)</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as EventCategoryType | '')}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                    >
                                        <option value="">— Ingen kategori —</option>
                                        {CATEGORY_LIST.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.emoji} {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                        <MapPin size={14} />
                                        Platsnamn
                                    </label>
                                    <input
                                        type="text"
                                        value={locationName}
                                        onChange={(e) => setLocationName(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="T.ex. Växjö Centrum"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                            Latitud
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={lat}
                                            onChange={(e) => setLat(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                            placeholder="56.8796"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                            Longitud
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={lng}
                                            onChange={(e) => setLng(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                            placeholder="14.8094"
                                        />
                                    </div>
                                </div>

                                <div className="my-4">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                        Välj plats på karta (valfritt)
                                    </label>
                                    <p className="text-xs text-slate-500 mb-2">Klicka på kartan för att flytta markören och hämta koordinater automatiskt.</p>
                                    <AdminLocationPickerMap
                                        initialLat={lat ? parseFloat(lat) : 56.8796} // Default Växjö
                                        initialLng={lng ? parseFloat(lng) : 14.8094}
                                        onLocationChange={(newLat, newLng) => {
                                            setLat(newLat.toFixed(6));
                                            setLng(newLng.toFixed(6));
                                        }}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    {editingEventId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-800 py-3 px-4 rounded-lg font-bold transition shadow-md"
                                        >
                                            Avbryt
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`${editingEventId ? 'w-2/3' : 'w-full'} bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-bold transition disabled:opacity-50 shadow-md`}
                                    >
                                        {loading ? 'Sparar...' : (editingEventId ? 'Spara Ändringar' : 'Skapa Länk-Event')}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Right: Event List */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                    Befintliga Länk-Events ({linkEvents.length})
                                </h2>
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

                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {linkEvents.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-8">
                                        Inga länk-events än. Skapa ditt första event!
                                    </p>
                                ) : (
                                    linkEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{event.title || 'Okänt event'}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    <ExternalLink size={12} />
                                                    <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                                        {event.url || 'Ingen URL'}
                                                    </a>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    <MapPin size={12} />
                                                    <span className="truncate">{event.locationName}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 mt-2">
                                                    <span>📅 {event.time.toLocaleDateString('sv-SE')}</span>
                                                    <span>🕐 {event.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span>👤 {event.hostName || 'Okänd'}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => handleEdit(event)}
                                                    disabled={loading}
                                                    className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition disabled:opacity-50 flex items-center gap-1 justify-center whitespace-nowrap"
                                                >
                                                    <Edit size={14} />
                                                    Redigera
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(event.id, event.title || 'Okänt event')}
                                                    disabled={loading}
                                                    className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition disabled:opacity-50 flex items-center gap-1 justify-center whitespace-nowrap"
                                                >
                                                    <Trash2 size={14} />
                                                    Ta bort
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
