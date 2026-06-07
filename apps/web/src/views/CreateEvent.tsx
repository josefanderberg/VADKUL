'use client';

// src/pages/CreateEvent.tsx

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
    ChevronLeft, ChevronRight, Calendar as CalIcon,
    MapPin, Check, Users, Info, Image as ImageIcon, X, KeyRound
} from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/layout/Layout';
import PromoCodeModal from '../components/events/PromoCodeModal';
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { userService } from '../services/userService';
import { storageService } from '../services/storageService';
import type { AppEvent, UserProfile } from '../types';
// OBS: Vi importerar nu även EVENT_CATEGORIES för att få färgerna till markören
import { CATEGORY_LIST, EVENT_CATEGORIES, AGE_CATEGORIES, type EventCategoryType } from '../utils/categories';
import { loadLocationFromLocalStorage } from '../utils/mapUtils';

// --- SUB-KOMPONENT: KARTVÄLJARE MED ANPASSAD MARKÖR ---
function LocationPicker({
    position,
    onLocationSelect,
    selectedType
}: {
    position: [number, number],
    onLocationSelect: (lat: number, lng: number) => void,
    selectedType: string
}) {
    const map = useMapEvents({
        click(e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    useEffect(() => {
        map.setView(position);
    }, [position, map]);

    // Hämta stil och emoji baserat på vald kategori (samma logik som Home.tsx)
    const category = EVENT_CATEGORIES[selectedType as EventCategoryType] || EVENT_CATEGORIES.other;
    const emoji = category.emoji;
    const bgClass = category.markerColor; // T.ex. 'bg-amber-500'

    const markerIcon = L.divIcon({
        className: 'custom-marker-teardrop ',
        html: `
    <div class="relative group rotate-45">
        <div class="w-12 h-12 ${bgClass} border-[3px] border-white shadow-md rounded-full rounded-br-none transform  flex items-center justify-center overflow-hidden">

            <div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent"></div>

            <div class="transform -rotate-45 text-2xl filter drop-shadow-sm">
                ${emoji}
            </div>
        </div>
    </div>
    `,
        iconSize: [48, 65],
        iconAnchor: [24, 58]
    });

    return position ? <Marker position={position} icon={markerIcon} /> : null;
}

function LoginAlertModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const router = useRouter();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                        <KeyRound size={32} />
                    </div>
                    <h3 className="text-xl font-bold">Du behöver logga in</h3>
                    <p className="text-muted-foreground">
                        För att publicera ett event behöver du vara inloggad.
                    </p>
                    <button
                        onClick={() => router.push('/login?redirect=/create')}
                        className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-transform active:scale-95"
                    >
                        Logga in / Registrera
                    </button>
                    <button
                        onClick={onClose}
                        className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                    >
                        Avbryt
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- HUVUDKOMPONENT ---

export default function CreateEvent() {
    const params = useParams();
    const id = params?.id as string | undefined;
    const isEditMode = !!id;

    const router = useRouter();
    const { user } = useAuth();

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Hämta sparad plats vid start (Endast om vi INTE redigerar)
    const savedLocation = useMemo(() => loadLocationFromLocalStorage(), []);

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const totalSteps = 6;

    // Form Data State - INITIERA MED SPARAD DATA OM FINNS
    const [formData, setFormData] = useState(() => {
        // Försök hämta från sessionStorage först
        if (!isEditMode) {
            try {
                const saved = sessionStorage.getItem('create_event_backup');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // Återställ datumobjekt som blir strängar i JSON
                    if (parsed.date) parsed.date = new Date(parsed.date);
                    return parsed;
                }
            } catch (e) {
                console.error("Kunde inte läsa sparad form data", e);
            }
        }

        return {
            type: '',
            title: '',
            description: '',
            lat: 56.8790, // Default till Växjö
            lng: 14.8059,
            locationName: '',
            date: new Date(),
            timeStr: '18:00',
            ageCategory: 'adults',
            minAge: 18,
            maxAge: 99,
            minParticipants: 2,
            maxParticipants: 10,
            price: 0,
            requiresApproval: false,
            coverImage: '', // URL till bilden
            customCategory: ''
        };
    });

    // NY: State för filuppladdning
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(formData.coverImage || null);

    const [currentMonth, setCurrentMonth] = useState(new Date(formData.date));

    // NY: Kod för exklusiva kategorier
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [showLoginAlert, setShowLoginAlert] = useState(false);

    // LIMIT CHECK STATE
    const [hasActiveLimitValues, setHasActiveLimitValues] = useState<{ count: number; isPremium: boolean } | null>(null);
    const [showLimitModal, setShowLimitModal] = useState(false);

    // CHECK LIMIT ON MOUNT
    useEffect(() => {
        if (!user) return;

        async function checkLimit() {
            if (!user) return; // Repetated check for type narrowing in async closure
            setLoading(true);
            try {
                // 1. Check verified/premium status
                const p = await userService.getUserProfile(user.uid);
                const isVerified = p?.isVerified || (p?.redeemedCodes?.length || 0) > 0;

                // 2. Check active events
                const hosted = await eventService.getHostedEvents(user.uid);
                const now = new Date();
                const activeCount = hosted.filter(e => new Date(e.time) >= now).length;

                setHasActiveLimitValues({ count: activeCount, isPremium: isVerified });

                // New logic: 1 base, 3 if verified
                const limit = isVerified ? 3 : 1;
                if (activeCount >= limit && !isEditMode) {
                    setShowLimitModal(true);
                }
            } catch (e) {
                console.error("Failed to check limit", e);
            } finally {
                setLoading(false);
            }
        }
        checkLimit();
    }, [user, isEditMode]);

    // --- CLEANUP & PERSISTENCE ---

    // Spara till sessionStorage vid ändring (om ej edit mode)
    useEffect(() => {
        if (!isEditMode) {
            const dataToSave = { ...formData };
            // Vi kan inte spara File-objektet i session storage enkelt, men resten går bra.
            // URL:er till bilder sparas ok om de är strängar.
            sessionStorage.setItem('create_event_backup', JSON.stringify(dataToSave));
        }
    }, [formData, isEditMode]);

    // Rensa vid unmount om man lämnar sidan helt (valfritt, men kanske bra om man avbryter)
    // Dock: Om användaren går till Login vill vi ha kvar det. Så vi rensar INTE på unmount.
    // Vi rensar BARA vid lyckad publicering.

    const handlePromoSuccess = (_code: string, customName: string) => {
        setFormData({ ...formData, type: 'other', customCategory: customName });
        toast.success(`Kategori inställd: ${customName} `);
    };

    // --- LADDA EVENT OM REDIGERING ---
    useEffect(() => {
        if (isEditMode && id) {
            setLoading(true);
            eventService.getById(id).then(event => {
                if (event) {
                    // Kontrollera att det är rätt ägare
                    if (user && event.host.uid !== user.uid) {
                        toast.error("Du får inte redigera detta event!");
                        router.push('/');
                        return;
                    }

                    // Fyll i formuläret
                    // Hantera om time är en Timestamp (från Firebase SDK direkt) eller Date (från vår Service)
                    // @ts-ignore - Ibland kommer det som timestamp trots typningen
                    const eventDate = event.time.seconds ? new Date(event.time.seconds * 1000) : new Date(event.time);

                    setFormData({
                        type: event.type,
                        title: event.title,
                        description: event.description || '',
                        lat: event.lat,
                        lng: event.lng,
                        locationName: event.location.name,
                        date: eventDate,
                        timeStr: eventDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                        ageCategory: event.ageCategory,
                        minAge: event.minAge,
                        maxAge: event.maxAge,
                        minParticipants: event.minParticipants,
                        maxParticipants: event.maxParticipants,
                        price: event.price,
                        requiresApproval: event.requiresApproval || false,
                        coverImage: event.coverImage || '',
                        customCategory: event.customCategory || '' // <--- NY: Ladda in anpassad kategori
                    });

                    if (event.coverImage) {
                        setPreviewUrl(event.coverImage);
                    }

                    // Sätt kalendern till rätt månad
                    setCurrentMonth(new Date(eventDate));
                }
                setLoading(false);
            });
        }
    }, [id, isEditMode, user]);


    useEffect(() => {
        // Endast sätt position från saved/GPS om vi INTE redigerar och inte har laddat data än
        if (!isEditMode && !formData.type && savedLocation) {
            setFormData((prev: any) => ({ ...prev, lat: savedLocation.lat, lng: savedLocation.lng }));
        } else if (!isEditMode && !formData.type && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                setFormData((prev: any) => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
            });
        }
    }, [savedLocation, isEditMode]);

    useEffect(() => {
        if (user) {
            userService.getUserProfile(user.uid)
                .then(profile => {
                    if (profile) {
                        setUserProfile(profile);
                    }
                })
                .catch(error => {
                    console.error("Kunde inte hämta UserProfile:", error);
                });
        }
    }, [user]);



    // --- BILD HANTERING ---
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCoverImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const clearImage = () => {
        setCoverImageFile(null);
        setPreviewUrl(null);
        setFormData({ ...formData, coverImage: '' });
    };

    // --- LOGIK ---

    const handleNext = () => {
        if (!validateStep(step)) return;
        setStep(prev => Math.min(prev + 1, totalSteps));
    };

    const handleBack = () => {
        setStep(prev => Math.max(prev - 1, 1));
    };

    const validateStep = (currentStep: number) => {
        switch (currentStep) {
            case 1:
                if (!formData.type) { toast.error("Välj en kategori först!"); return false; }
                return true;
            case 2:
                return true;
            case 3:
                if (!formData.title) { toast.success("Ange en titel!"); return false; }
                return true;
            case 4:
                const combinedDate = new Date(formData.date);
                const [hours, minutes] = formData.timeStr.split(':').map(Number);
                combinedDate.setHours(hours, minutes);

                if (combinedDate < new Date()) {
                    toast.error("Tiden måste vara i framtiden!");
                    return false;
                }
                return true;
            case 6:
                if (formData.maxParticipants < formData.minParticipants) {
                    toast.error("Max antal kan inte vara mindre än minsta antal.");
                    return false;
                }
                return true;
            default: return true;
        }
    };

    const handleSubmit = async () => {
        if (!user) {
            setShowLoginAlert(true);
            return;
        }
        if (!userProfile) {
            toast.error("Vänta, laddar din profil...");
            return;
        }
        if (!user.email) return;
        setLoading(true);

        // --- SUBMIT-TIME LIMIT CHECK (Double Check) ---
        if (!isEditMode) {
            try {
                const p = await userService.getUserProfile(user.uid);
                const isVerified = p?.isVerified || (p?.redeemedCodes?.length || 0) > 0;
                const limit = isVerified ? 3 : 1;

                const hosted = await eventService.getHostedEvents(user.uid);
                const now = new Date();
                const activeCount = hosted.filter(e => new Date(e.time) >= now).length;

                if (activeCount >= limit) {
                    setShowLimitModal(true);
                    setLoading(false);
                    return;
                }
            } catch (checkErr) {
                console.error("Limit double-check failed", checkErr);
                // Vi låter det passera om checken failar (fail open) eller blockar? Fail safe (block) kanske bättre men irriterande.
                // Låt oss logga och fortsätta för nu, eller blocka?
                // Vi kör vidare för att inte blockera vid nätverksfel, men loggar.
            }
        }

        const finalDate = new Date(formData.date);
        const [h, m] = formData.timeStr.split(':').map(Number);
        finalDate.setHours(h, m);

        try {
            // Gemensam data
            const commonData = {
                title: formData.title,
                description: formData.description,
                location: {
                    name: formData.locationName || "Vald plats",
                    distance: 0
                },
                lat: formData.lat,
                lng: formData.lng,
                time: finalDate,
                type: formData.type as EventCategoryType,
                price: Number(formData.price),
                minParticipants: Number(formData.minParticipants),
                maxParticipants: Number(formData.maxParticipants),
                minAge: Number(formData.minAge),
                maxAge: Number(formData.maxAge),
                ageCategory: formData.ageCategory,

                requiresApproval: formData.requiresApproval,
                coverImage: formData.coverImage, // Börja med befintlig URL (tom eller gammal)
                customCategory: formData.customCategory // <--- NY: Spara anpassad kategori
            };

            // Om vi har en ny fil, ladda upp den och uppdatera URL
            if (coverImageFile) {
                const path = `event - images / ${user.uid}/${Date.now()}_${coverImageFile.name}`;
                const url = await storageService.uploadFile(path, coverImageFile);
                commonData.coverImage = url;
            }

            if (isEditMode && id) {
                // --- UPPDATERA BEFINTLIGT EVENT ---
                // Vi behöver hämta hela eventet först för att inte tappa bort deltagare/host
                const existingEvent = await eventService.getById(id);
                if (!existingEvent) throw new Error("Event not found");

                const updatedEvent: AppEvent = {
                    ...existingEvent,
                    ...commonData
                };

                await eventService.update(updatedEvent);

                // Rensa hem-cachen så att ändringen syns
                sessionStorage.removeItem('vadkul_events_cache');
                sessionStorage.removeItem('vadkul_events_cache_time');

                toast.success('Eventet är uppdaterat! 🎉');
                router.push(`/event/${id}`);

            } else {
                // --- SKAPA NYTT EVENT ---
                const newEvent: Omit<AppEvent, 'id'> = {
                    ...commonData,
                    views: 0,
                    host: {
                        uid: user.uid,
                        name: user.displayName || user.email,
                        initials: (user.displayName || user.email).substring(0, 2).toUpperCase(),
                        email: user.email,
                        verified: userProfile.isVerified,
                        rating: 5.0,
                        photoURL: userProfile.photoURL || user.photoURL || null
                    },
                    attendees: [{
                        uid: user.uid,
                        email: user.email || '',
                        displayName: user.displayName || 'Värd',
                        photoURL: userProfile.photoURL || user.photoURL || null,
                        status: 'confirmed'
                    }]
                };

                await eventService.create(newEvent);
                sessionStorage.removeItem('create_event_backup');

                // Rensa hem-cachen så att det nya eventet syns
                sessionStorage.removeItem('vadkul_events_cache');
                sessionStorage.removeItem('vadkul_events_cache_time');

                toast.success('Eventet är publicerat! 🎉');
                router.push('/');
            }

        } catch (error) {
            console.error("Fel vid sparande:", error);
            toast.error("Kunde inte spara eventet. Försök igen.");
        } finally {
            setLoading(false);
        }
    };

    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let startDay = firstDayOfMonth.getDay();
        startDay = (startDay + 6) % 7;

        const days = [];
        for (let i = 0; i < startDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

        return days;
    }, [currentMonth]);


    // --- LIMIT BLOCKING UI ---
    if (showLimitModal && hasActiveLimitValues) {
        return (
            <Layout>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <KeyRound size={32} />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Maxgräns nådd!</h2>
                        <p className="text-muted-foreground mb-6">
                            Du har {hasActiveLimitValues.count} aktiv{hasActiveLimitValues.count === 1 ? '' : 'a'} event{hasActiveLimitValues.count === 1 ? '' : 's'}. <br />
                            {hasActiveLimitValues.isPremium 
                                ? "Du har nått maxgränsen för verifierade användare (3 st)." 
                                : "Som ny användare kan du ha 1 event aktivt åt gången. Verifiera dig för att låsa upp fler!"}
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => router.push('/profile')}
                                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                            >
                                Jag har en kod! (Gå till Profil)
                            </button>
                            <button
                                onClick={() => router.push('/')}
                                className="block w-full text-sm font-semibold text-muted-foreground hover:text-foreground py-2"
                            >
                                Gå tillbaka till startsidan
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }


    return (
        <Layout>
            <div className="max-w-lg mx-auto pb-20 px-4">

                {/* HEADER */}
                <div className="flex items-center justify-between py-6">
                    <h1 className="text-2xl font-extrabold text-foreground">
                        {isEditMode ? 'Redigera Event' : 'Skapa Event'}
                        <span className="text-base text-primary ml-2">Steg {step}/{totalSteps}</span>
                    </h1>
                    <button onClick={() => router.push('/')} className="text-sm font-semibold text-muted-foreground hover:text-destructive">
                        Avbryt
                    </button>
                </div>

                {/* PROGRESS BAR */}
                <div className="h-1.5 w-full bg-muted rounded-full mb-8 overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
                </div>

                {/* --- STEP 1: TYPE --- */}
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <h3 className="text-lg font-bold mb-4 text-foreground">Vad vill du hitta på?</h3>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {CATEGORY_LIST
                                .filter(cat => cat.id !== 'campus') // Dölj "Nation & Kår" från listan
                                .map(cat => {
                                    const isSelected = formData.type === cat.id;

                                    const bg = isSelected
                                        ? `${cat.activeColor} text-white shadow-lg scale-105`
                                        : `bg-card text-foreground border-border ${cat.hoverBorder} hover:scale-105`;

                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setFormData({ ...formData, type: cat.id, customCategory: '' })}
                                            className={`px-4 py-3 rounded-full font-bold transition-all duration-200 flex items-center gap-2 border-2 ${bg}`}
                                        >
                                            <span>{cat.emoji}</span>
                                            <span>{cat.label}</span>
                                        </button>
                                    );
                                })}
                        </div>

                        {/* EXCLUSIVE CODE SECTION */}
                        <div className="mt-8 flex flex-col items-center">
                            <button
                                onClick={() => setShowPromoModal(true)}
                                className="text-sm font-semibold text-muted-foreground hover:text-primary underline mb-3 flex items-center gap-2"
                            >
                                <KeyRound size={16} /> Har du en kod?
                            </button>
                        </div>
                    </div>
                )}

                {/* --- STEP 2: LOCATION (Här var tidigare Info) --- */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                        <h3 className="text-lg font-bold text-foreground">Var ska ni ses?</h3>
                        <p className="text-sm text-muted-foreground">Klicka på kartan för att flytta markören.</p>

                        <div className="h-72 w-full rounded-xl overflow-hidden border border-border shadow-inner relative z-0">
                            <MapContainer center={[formData.lat, formData.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <LocationPicker
                                    position={[formData.lat, formData.lng]}
                                    onLocationSelect={(lat, lng) => setFormData({ ...formData, lat, lng })}
                                    selectedType={formData.type}
                                />
                            </MapContainer>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Platsnamn (Valfritt)</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    value={formData.locationName}
                                    onChange={e => setFormData({ ...formData, locationName: e.target.value })}
                                    className="w-full pl-10 p-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="T.ex. Vid fontänen"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- STEP 3: INFO (Här var tidigare Location) --- */}
                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                        <h3 className="text-lg font-bold text-foreground">Beskriv ditt event</h3>

                        {/* BILD UPLOAD */}
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Omslagsbild (Valfritt)</label>

                            <div className="relative w-full h-40 bg-muted rounded-xl overflow-hidden border-2 border-dashed border-border group cursor-pointer hover:border-primary transition-colors">
                                {previewUrl || (formData.type && EVENT_CATEGORIES[formData.type as EventCategoryType]?.defaultImage) ? (
                                    <>
                                        <img
                                            src={
                                                previewUrl ||
                                                (() => {
                                                    const img = EVENT_CATEGORIES[formData.type as EventCategoryType]?.defaultImage;
                                                    return typeof img === 'string' ? img : img?.src;
                                                })()
                                            }
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                                                <ImageIcon size={20} /> Byt bild
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                                        <ImageIcon size={32} className="mb-2 opacity-50" />
                                        <span className="text-sm font-medium">Klicka för att ladda upp</span>
                                    </div>
                                )}

                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>

                            {(previewUrl || formData.coverImage) && (
                                <button
                                    onClick={clearImage}
                                    className="text-xs text-destructive hover:underline mt-1 flex items-center gap-1"
                                >
                                    <X size={12} /> Återställ till standardbild
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Titel</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full p-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none"
                                placeholder="T.ex. Fotboll i parken"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Beskrivning (Valfritt)</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full p-3 h-32 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="Berätta lite mer..."
                            />
                        </div>
                    </div>
                )}

                {/* --- STEP 4: DATE & TIME --- */}
                {step === 4 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                        <h3 className="text-lg font-bold text-foreground">När händer det?</h3>

                        {/* KALENDER */}
                        <div className="bg-card dark:bg-neutral-900 p-4 rounded-xl border border-border shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold capitalize text-foreground">
                                    {currentMonth.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-1 hover:bg-muted rounded text-foreground"><ChevronLeft size={20} /></button>
                                    <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-1 hover:bg-muted rounded text-foreground"><ChevronRight size={20} /></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((d, i) => <span key={i} className="text-xs font-bold text-muted-foreground">{d}</span>)}
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((date, i) => {
                                    if (!date) return <div key={i}></div>;

                                    const isSelected = date.toDateString() === new Date(formData.date).toDateString();
                                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                                    return (
                                        <button
                                            key={i}
                                            disabled={isPast}
                                            onClick={() => setFormData({ ...formData, date: date })}
                                            className={`
                                        aspect-square rounded-full text-sm flex items-center justify-center transition-colors
                                        ${isSelected ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-primary/10 text-foreground'}
                                        ${isPast ? 'opacity-30 cursor-not-allowed' : ''}
                                    `}
                                        >
                                            {date.getDate()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* TID */}
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Klockslag</label>
                            <div className="relative">
                                <CalIcon className="absolute left-3 top-3 text-muted-foreground" size={18} />
                                <input
                                    type="time"
                                    value={formData.timeStr}
                                    onChange={e => setFormData({ ...formData, timeStr: e.target.value })}
                                    className="w-full pl-10 p-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- STEP 5: AGE & CATEGORY --- */}
                {step === 5 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                        <h3 className="text-lg font-bold text-foreground">Vem passar det för?</h3>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Kategori</label>
                            <select
                                value={formData.ageCategory}
                                onChange={e => {
                                    const cat = AGE_CATEGORIES.find(c => c.id === e.target.value);
                                    setFormData({
                                        ...formData,
                                        ageCategory: e.target.value,
                                        minAge: cat ? cat.min : 0,
                                        maxAge: cat ? cat.max : 99
                                    });
                                }}
                                className="w-full p-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-primary outline-none"
                            >
                                {AGE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Min Ålder</label>
                                <input
                                    type="number"
                                    value={formData.minAge}
                                    onChange={e => setFormData({ ...formData, minAge: parseInt(e.target.value) })}
                                    className="w-full p-3 rounded-xl border border-border bg-card text-foreground text-center"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Max Ålder</label>
                                <input
                                    type="number"
                                    value={formData.maxAge}
                                    onChange={e => setFormData({ ...formData, maxAge: parseInt(e.target.value) })}
                                    className="w-full p-3 rounded-xl border border-border bg-card text-foreground text-center"
                                />
                            </div>
                        </div>

                        <div className="bg-primary/10 p-4 rounded-xl flex gap-3 text-primary text-sm">
                            <Info className="shrink-0" size={20} />
                            <p>Detta är bara rekommendationer så att rätt personer hittar ditt event.</p>
                        </div>
                    </div>
                )}

                {/* --- STEP 6: PRICE & PARTICIPANTS --- */}
                {step === 6 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                        <h3 className="text-lg font-bold text-foreground">Sista detaljerna</h3>

                        <div className="bg-card dark:bg-neutral-900 p-6 rounded-xl border border-border shadow-sm space-y-6">

                            {/* GODKÄNNANDE */}
                            <div className="flex items-center justify-between border-b border-border pb-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-foreground">Kräv godkännande</span>
                                    <span className="text-xs text-muted-foreground">Du måste godkänna deltagare manuellt</span>
                                </div>
                                <button
                                    onClick={() => setFormData({ ...formData, requiresApproval: !formData.requiresApproval })}
                                    className={`
                                w-12 h-6 rounded-full transition-colors relative
                                ${formData.requiresApproval ? 'bg-primary' : 'bg-muted'}
                            `}
                                >
                                    <div className={`
                                w-4 h-4 rounded-full bg-background shadow-sm absolute top-1 transition-transform
                                ${formData.requiresApproval ? 'left-7' : 'left-1'}
                            `} />
                                </button>
                            </div>

                            {/* PRIS SEKTION */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Pris</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) })}
                                        className="w-full p-3 pr-10 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    {/* Texten "kr" som ligger inuti rutan */}
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">kr</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Sätt 0 för gratis.</p>
                            </div>

                            {/* DELTAGARE SEKTION */}
                            <div>
                                {/* Rubrik med ikon för att tydliggöra att det handlar om personer */}
                                <div className="flex items-center gap-2 mb-3 border-t border-border pt-4">
                                    <Users size={18} className="text-primary" />
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mt-0.5">Antal Deltagare</label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Minst antal</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="2"
                                                value={formData.minParticipants}
                                                onChange={e => setFormData({ ...formData, minParticipants: parseInt(e.target.value) })}
                                                className="w-full p-3 pr-12 rounded-xl border border-border bg-muted/50 text-foreground text-center outline-none focus:ring-2 focus:ring-primary"
                                            />
                                            {/* Texten "pers" inuti rutan */}
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs pointer-events-none">pers</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Max antal</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="2"
                                                value={formData.maxParticipants}
                                                onChange={e => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                                                className="w-full p-3 pr-12 rounded-xl border border-border bg-muted/50 text-foreground text-center outline-none focus:ring-2 focus:ring-primary"
                                            />
                                            {/* Texten "pers" inuti rutan */}
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs pointer-events-none">pers</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {formData.price === 0 && (
                            <div className="flex items-center gap-2 text-green-600 bg-green-500/20 p-3 rounded-lg font-bold text-sm justify-center">
                                <Check size={18} />
                                Detta event blir gratis!
                            </div>
                        )}
                    </div>
                )}

                {/* --- NAVIGATION BUTTONS --- */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-card dark:bg-neutral-900 border-t border-border z-50">
                    <div className="max-w-lg mx-auto flex gap-3">
                        <button
                            onClick={handleBack}
                            disabled={step === 1}
                            className="px-6 py-3 rounded-xl font-bold bg-muted text-muted-foreground disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>

                        {step < totalSteps ? (
                            <button
                                onClick={handleNext}
                                className="flex-grow py-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                Nästa <ChevronRight size={20} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex-grow py-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {loading ? (isEditMode ? 'Sparar...' : 'Publicerar...') : (isEditMode ? 'Spara ändringar' : 'Publicera Event')} <Check size={20} />
                            </button>
                        )}
                    </div>
                </div>
                <PromoCodeModal
                    isOpen={showPromoModal}
                    onClose={() => setShowPromoModal(false)}
                    onSuccess={handlePromoSuccess}
                />
                <LoginAlertModal
                    isOpen={showLoginAlert}
                    onClose={() => setShowLoginAlert(false)}
                />
            </div>
        </Layout>
    );
}