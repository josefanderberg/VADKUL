'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { linkEventService } from '../../../services/linkEventService';
import { useAuth } from '../../../context/AuthContext';
import Layout from '../../../components/layout/Layout';
import type { LinkEvent } from '../../../types';
import toast from 'react-hot-toast';
import { ExternalLink, Trash2, MapPin, ArrowLeft, Upload, Eye } from 'lucide-react';
import { parseImportJSON, mapToLinkEvent, compareEvents, type SyncComparison } from '../../../utils/eventImport';

export default function LinkEventsAdminPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [linkEvents, setLinkEvents] = useState<LinkEvent[]>([]);
    const [loading, setLoading] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [locationName, setLocationName] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [hostName, setHostName] = useState('');

    // JSON Sync state
    const [jsonInput, setJsonInput] = useState('');
    const [preview, setPreview] = useState<SyncComparison | null>(null);
    const [syncing, setSyncing] = useState(false);

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
            const events = await linkEventService.getAll();
            setLinkEvents(events);
        } catch (error) {
            console.error('Failed to fetch link events:', error);
            toast.error('Kunde inte hämta länk-events');
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
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

            await linkEventService.create({
                title,
                url,
                time: dateTime,
                locationName,
                lat: latitude,
                lng: longitude,
                hostName
            });

            toast.success('Länk-event skapat!');

            // Reset form
            setTitle('');
            setUrl('');
            setDate('');
            setTime('');
            setLocationName('');
            setLat('');
            setLng('');
            setHostName('');

            // Refresh list
            await fetchLinkEvents();
        } catch (error: any) {
            console.error('Failed to create link event:', error);
            toast.error('Kunde inte skapa länk-event');
        } finally {
            setLoading(false);
        }
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

            toast.success(`Förhandsgranskning klar! ${comparison.toAdd.length} nya, ${comparison.toKeep.length} bevarade, ${comparison.toRemove.length} tas bort`);
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

        // Confirm if removing events
        if (preview.toRemove.length > 0) {
            const confirmed = confirm(
                `Detta kommer att ta bort ${preview.toRemove.length} event(s). Är du säker?`
            );
            if (!confirmed) return;
        }

        setSyncing(true);
        try {
            // Delete events that are not in JSON
            if (preview.toRemove.length > 0) {
                await linkEventService.bulkDelete(preview.toRemove.map(e => e.id));
            }

            // Create new events from JSON
            if (preview.toAdd.length > 0) {
                await linkEventService.bulkCreate(preview.toAdd);
            }

            toast.success(`Synkronisering klar! +${preview.toAdd.length} nya, -${preview.toRemove.length} borttagna`);

            // Reset and refresh
            setJsonInput('');
            setPreview(null);
            await fetchLinkEvents();
        } catch (error: any) {
            console.error('Sync error:', error);
            toast.error('Kunde inte synkronisera events');
        } finally {
            setSyncing(false);
        }
    };

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
                        <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                            Klistra in JSON med events för att synkronisera. Events som inte finns i JSON kommer tas bort.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    JSON Data
                                </label>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm"
                                    placeholder='{"city": "Växjö", "events": [...]}'
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
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition disabled:opacity-50"
                                    >
                                        <Upload size={18} />
                                        {syncing ? 'Synkroniserar...' : 'Synkronisera'}
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

                            <form onSubmit={handleCreate} className="space-y-4">
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
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Latitud</label>
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
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Longitud</label>
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

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-bold transition disabled:opacity-50 shadow-md"
                                >
                                    {loading ? 'Skapar...' : 'Skapa Länk-Event'}
                                </button>
                            </form>
                        </div>

                        {/* Right: Event List */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                                Befintliga Länk-Events ({linkEvents.length})
                            </h2>

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
                                            <button
                                                onClick={() => handleDelete(event.id, event.title || 'Okänt event')}
                                                disabled={loading}
                                                className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition disabled:opacity-50 flex items-center gap-1"
                                            >
                                                <Trash2 size={14} />
                                                Ta bort
                                            </button>
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
