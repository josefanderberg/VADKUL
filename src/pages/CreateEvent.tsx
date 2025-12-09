// src/pages/CreateEvent.tsx

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  ChevronLeft, ChevronRight, Calendar as CalIcon, 
  MapPin, Check,Users, Info 
} from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { userService } from '../services/userService'; 
import type { AppEvent, UserProfile } from '../types'; 
// OBS: Vi importerar nu även EVENT_CATEGORIES för att få färgerna till markören
import { CATEGORY_LIST, EVENT_CATEGORIES, type EventCategoryType } from '../utils/categories';
import { loadLocationFromLocalStorage } from '../utils/mapUtils';

const AGE_CATEGORIES = [
  { id: 'family', label: 'Familj', min: 0, max: 99 },
  { id: 'youth', label: 'Ungdom', min: 13, max: 17 },
  { id: 'adults', label: 'Vuxna', min: 18, max: 99 },
  { id: 'seniors', label: 'Seniorer', min: 65, max: 99 },
];

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

// --- HUVUDKOMPONENT ---

export default function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Hämta sparad plats vid start
  const savedLocation = useMemo(() => loadLocationFromLocalStorage(), []);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const totalSteps = 6;

  // Form Data State
  const [formData, setFormData] = useState({
    type: '',
    title: '',
    description: '',
    lat: savedLocation ? savedLocation.lat : 56.8790, 
    lng: savedLocation ? savedLocation.lng : 14.8059,
    locationName: '',
    date: new Date(),
    timeStr: '18:00', 
    ageCategory: 'adults',
    minAge: 18,
    maxAge: 99,
    minParticipants: 2,
    maxParticipants: 10,
    price: 0
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!savedLocation && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            setFormData(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        });
    }
  }, [savedLocation]);
  
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

  // --- LOGIK ---

  const handleNext = () => {
      if (!validateStep(step)) return;
      setStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
      setStep(prev => Math.max(prev - 1, 1));
  };

  const validateStep = (currentStep: number) => {
      switch(currentStep) {
          case 1: 
            if (!formData.type) { toast.error("Välj en kategori först!"); return false; }   
            return true;
          // ÄNDRAT: Steg 2 är nu kartan (behöver oftast ingen validering då default finns)
          case 2:
              return true; 
          // ÄNDRAT: Steg 3 är nu Titel & Info
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
      if (!user || !user.email || !userProfile) return;
      setLoading(true);

      const finalDate = new Date(formData.date);
      const [h, m] = formData.timeStr.split(':').map(Number);
      finalDate.setHours(h, m);

      try {
          const newEvent: Omit<AppEvent, 'id'> = {
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
              host: {
                  uid: user.uid,
                  name: user.displayName || user.email,
                  initials: (user.displayName || user.email).substring(0, 2).toUpperCase(),
                  email: user.email,
                  verified: userProfile.isVerified, 
                  rating: 5.0,
                  photoURL: userProfile.verificationImage || user.photoURL || null 
              },
              attendees: [{
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Värd',
                photoURL: userProfile.verificationImage || user.photoURL || null 
              }]
        };

          await eventService.create(newEvent);
          toast.success('Eventet är publicerat! 🎉'); 
          navigate('/'); 
      } catch (error) {
          console.error("Fel vid skapande:", error);
          toast.error("Kunde inte skapa eventet. Försök igen.");
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


  return (
    <Layout>
      <div className="max-w-lg mx-auto pb-20 px-4">
        
        {/* HEADER */}
        <div className="flex items-center justify-between py-6">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                Skapa Event 
                <span className="text-base text-indigo-500 ml-2">Steg {step}/{totalSteps}</span>
            </h1>
            <button onClick={() => navigate('/')} className="text-sm font-semibold text-slate-500 hover:text-red-500">
                Avbryt
            </button>
        </div>

        {/* PROGRESS BAR */}
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>

        {/* --- STEP 1: TYPE --- */}
        {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-bold mb-4 dark:text-white">Vad vill du hitta på?</h3>
                <div className="flex flex-wrap gap-3 justify-center">
                {CATEGORY_LIST.map(cat => {
                    const isSelected = formData.type === cat.id;
                    
                    const bg = isSelected 
                    ? `${cat.activeColor} text-white shadow-lg scale-105` 
                    : `${cat.color} border-transparent hover:scale-105`;

                    return (
                        <button
                            key={cat.id}
                            onClick={() => setFormData({ ...formData, type: cat.id })}
                            className={`px-4 py-3 rounded-full font-bold transition-all duration-200 flex items-center gap-2 border-2 ${bg}`}
                        >
                            <span>{cat.emoji}</span>
                            <span>{cat.label}</span>
                        </button>
                    );
                })}
                </div>
            </div>
        )}

        {/* --- STEP 2: LOCATION (Här var tidigare Info) --- */}
        {step === 2 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                <h3 className="text-lg font-bold dark:text-white">Var ska ni ses?</h3>
                <p className="text-sm text-slate-500">Klicka på kartan för att flytta markören.</p>
                
                <div className="h-72 w-full rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 shadow-inner relative z-0">
                    <MapContainer center={[formData.lat, formData.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationPicker 
                            position={[formData.lat, formData.lng]} 
                            onLocationSelect={(lat, lng) => setFormData({...formData, lat, lng})} 
                            selectedType={formData.type} 
                        />
                    </MapContainer>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Platsnamn (Valfritt)</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            value={formData.locationName}
                            onChange={e => setFormData({...formData, locationName: e.target.value})}
                            className="w-full pl-10 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="T.ex. Vid fontänen"
                        />
                    </div>
                </div>
             </div>
        )}

        {/* --- STEP 3: INFO (Här var tidigare Location) --- */}
        {step === 3 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                <h3 className="text-lg font-bold dark:text-white">Beskriv ditt event</h3>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titel</label>
                    <input 
                        type="text" 
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="T.ex. Fotboll i parken"
                        autoFocus
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Beskrivning (Valfritt)</label>
                    <textarea 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full p-3 h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        placeholder="Berätta lite mer..."
                    />
                </div>
             </div>
        )}

        {/* --- STEP 4: DATE & TIME --- */}
        {step === 4 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                <h3 className="text-lg font-bold dark:text-white">När händer det?</h3>

                {/* KALENDER */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold capitalize text-slate-700 dark:text-slate-200">
                            {currentMonth.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}
                        </span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronLeft size={20}/></button>
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronRight size={20}/></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['M','T','O','T','F','L','S'].map((d,i) => <span key={i} className="text-xs font-bold text-slate-400">{d}</span>)}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((date, i) => {
                            if (!date) return <div key={i}></div>;
                            
                            const isSelected = date.toDateString() === new Date(formData.date).toDateString();
                            const isPast = date < new Date(new Date().setHours(0,0,0,0));
                            
                            return (
                                <button
                                    key={i}
                                    disabled={isPast}
                                    onClick={() => setFormData({...formData, date: date})}
                                    className={`
                                        aspect-square rounded-full text-sm flex items-center justify-center transition-colors
                                        ${isSelected ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300'}
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
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Klockslag</label>
                    <div className="relative">
                        <CalIcon className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                            type="time" 
                            value={formData.timeStr}
                            onChange={e => setFormData({...formData, timeStr: e.target.value})}
                            className="w-full pl-10 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>
             </div>
        )}

        {/* --- STEP 5: AGE & CATEGORY --- */}
        {step === 5 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                <h3 className="text-lg font-bold dark:text-white">Vem passar det för?</h3>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kategori</label>
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
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {AGE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Ålder</label>
                        <input 
                            type="number" 
                            value={formData.minAge}
                            onChange={e => setFormData({...formData, minAge: parseInt(e.target.value)})}
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Ålder</label>
                        <input 
                            type="number" 
                            value={formData.maxAge}
                            onChange={e => setFormData({...formData, maxAge: parseInt(e.target.value)})}
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center"
                        />
                    </div>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl flex gap-3 text-indigo-800 dark:text-indigo-200 text-sm">
                    <Info className="shrink-0" size={20} />
                    <p>Detta är bara rekommendationer så att rätt personer hittar ditt event.</p>
                </div>
             </div>
        )}

       {/* --- STEP 6: PRICE & PARTICIPANTS --- */}
       {step === 6 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                <h3 className="text-lg font-bold dark:text-white">Sista detaljerna</h3>
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    
                    {/* PRIS SEKTION */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pris</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={formData.price}
                                onChange={e => setFormData({...formData, price: parseInt(e.target.value)})}
                                className="w-full p-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {/* Texten "kr" som ligger inuti rutan */}
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">kr</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Sätt 0 för gratis.</p>
                    </div>

                    {/* DELTAGARE SEKTION */}
                    <div>
                        {/* Rubrik med ikon för att tydliggöra att det handlar om personer */}
                        <div className="flex items-center gap-2 mb-3 border-t border-slate-100 dark:border-slate-700 pt-4">
                             <Users size={18} className="text-indigo-500" />
                             <label className="block text-xs font-bold text-slate-500 uppercase mt-0.5">Antal Deltagare</label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Minst antal</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        min="2"
                                        value={formData.minParticipants}
                                        onChange={e => setFormData({...formData, minParticipants: parseInt(e.target.value)})}
                                        className="w-full p-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white text-center outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {/* Texten "pers" inuti rutan */}
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">pers</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Max antal</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        min="2"
                                        value={formData.maxParticipants}
                                        onChange={e => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                                        className="w-full p-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white text-center outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {/* Texten "pers" inuti rutan */}
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">pers</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {formData.price === 0 && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg font-bold text-sm justify-center">
                        <Check size={18} />
                        Detta event blir gratis!
                    </div>
                )}
             </div>
        )}

        {/* --- NAVIGATION BUTTONS --- */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 z-50">
            <div className="max-w-lg mx-auto flex gap-3">
                <button 
                    onClick={handleBack}
                    disabled={step === 1}
                    className="px-6 py-3 rounded-xl font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                
                {step < totalSteps ? (
                    <button 
                        onClick={handleNext}
                        className="flex-grow py-3 rounded-xl font-bold bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        Nästa <ChevronRight size={20} />
                    </button>
                ) : (
                    <button 
                        onClick={handleSubmit}
                        disabled={loading || !userProfile}
                        className="flex-grow py-3 rounded-xl font-bold bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {loading ? 'Publicerar...' : 'Publicera Event'} <Check size={20} />
                    </button>
                )}
            </div>
        </div>
      </div>
    </Layout>
  );
}