// src/components/home/EventFilters.tsx
import { useState, useEffect } from 'react';
import { SlidersHorizontal, List, Map as MapIcon, Search, X, ChevronDown } from 'lucide-react';
import { CATEGORY_LIST, EVENT_CATEGORIES, type EventCategoryType } from '../../utils/categories';
import type { AppEvent } from '../../types';

interface EventFiltersProps {
  filterType: string;
  setFilterType: (val: string) => void;
  view: 'list' | 'map';
  setView: (val: 'list' | 'map') => void;
  filterToday: boolean;
  setFilterToday: (val: boolean) => void;
  filterFree: boolean;
  setFilterFree: (val: boolean) => void;
  filterAge: string;
  setFilterAge: (val: string) => void;
  resetFilters: () => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  availableEvents: AppEvent[];
}

export default function EventFilters({
  filterType,
  setFilterType,
  view,
  setView,
  filterToday,
  setFilterToday,
  filterFree,
  setFilterFree,
  filterAge,
  setFilterAge,
  resetFilters,
  searchQuery,
  setSearchQuery,
  availableEvents
}: EventFiltersProps) {

  const selectedCategory = EVENT_CATEGORIES[filterType as EventCategoryType] || null;
  const categoryColorClass = selectedCategory
    ? selectedCategory.color
    : 'bg-muted text-foreground';

  const hasActiveFilters = filterType !== 'all' || filterFree || filterToday || filterAge !== 'all' || searchQuery.length > 0;

  // 0 = Basic (Idag + Gratis), 1 = Age (Ålder)
  const [filterMode] = useState<0 | 1>(0);
  const [showFilters, setShowFilters] = useState(false);

  // --- TODAY CLOUD HINT ---
  const [showTodayHint, setShowTodayHint] = useState(false);
  const [hintLeaving, setHintLeaving] = useState(false);

  // Show the cloud hint shortly after mount (only once per session)
  // Also auto-open the filter row so the "Idag" button is visible
  useEffect(() => {
    const already = sessionStorage.getItem('vadkul_today_hint_seen');
    if (already) return;
    const t = setTimeout(() => {
      setShowFilters(true);  // open the filter row so Idag button is visible
      setShowTodayHint(true);
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  const dismissTodayHint = () => {
    setHintLeaving(true);
    setTimeout(() => {
      setShowTodayHint(false);
      setHintLeaving(false);
      setShowFilters(false);  // close filter row after hint is dismissed
      sessionStorage.setItem('vadkul_today_hint_seen', '1');
    }, 400);
  };

  // --- SCROLL LOGIC ---
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show immediately if scrolling UP or at the very top
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      }
      // Hide if scrolling DOWN and not at the top
      else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // --- AUTOCOMPLETE LOGIC ---
  const [suggestions, setSuggestions] = useState<AppEvent[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const filtered = availableEvents
        .filter(e => 
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.location.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, availableEvents]);


  // Navbar är normalt 64px (h-16). Vi sätter top-16 för att hamna precis under den.
  // Transform används för att skjuta upp den under navbaren.
  const visibilityClass = isVisible
    ? 'translate-y-0 opacity-100'
    : '-translate-y-full opacity-0 pointer-events-none';

  return (
    <div className={`fixed top-16 left-0 right-0 z-30 transition-all duration-300 ease-in-out transform ${visibilityClass}`}>

      {/* --- CONTAINER: Bakgrund & Blur --- */}
      <div className="bg-background/80 backdrop-blur-md border-b border-border shadow-sm">

        {/* RAD 1: SÖK + FILTER BUTTON + VIEW */}
        <div className="w-full   py-3 pb-2 flex gap-3 items-center">
          {/* Sökfält */}
          <div className="flex-grow relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök på event..."
              className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-muted/50 border border-border focus:bg-background focus:ring-2 focus:ring-ring outline-none text-sm transition-all text-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}

            {/* AUTOCOMPLETE DROPDOWN */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSearchQuery(s.title);
                      setShowSuggestions(false);
                    }}
                    className="w-full  py-3 text-left hover:bg-muted flex flex-col gap-0.5 border-b border-border/50 last:border-0"
                  >
                    <span className="text-sm font-bold text-foreground">{s.title}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{s.location.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Toggle Button */}
          <div className="flex items-center gap-2">
            {!showFilters && hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 animate-in fade-in zoom-in duration-200"
                title="Rensa filter"
              >
                <X size={20} />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl transition-all border border-border ${showFilters ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
            >
              <SlidersHorizontal size={20} />
            </button>
          </div>

          {/* View Toggle */}
          <div className="bg-muted/50 p-1 rounded-xl flex shrink-0 border border-border">
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setView('map')}
              className={`p-2 rounded-lg transition-all ${view === 'map' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <MapIcon size={20} />
            </button>
          </div>
        </div>

        {/* RAD 2: FILTER (Kollapsar) */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-[60px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="w-full   pb-3 pt-0 flex items-center justify-between gap-2">

            {/* VÄNSTER SIDA: Filterval */}
            <div className="flex items-center gap-2 flex-grow">

              {/* KATEGORIER */}
              <div className="relative shrink-0">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className={`appearance-none font-bold rounded-full text-xs py-2 pl-3 pr-8 outline-none cursor-pointer border hover:border-input transition-colors ${categoryColorClass}`}
                >
                  <option value="all" className="bg-background text-foreground">Kategorier</option>
                  {CATEGORY_LIST.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-background text-foreground">
                      {cat.label} {cat.emoji}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={14} />
              </div>

              <div className="w-[1px] h-5 bg-border mx-1"></div>

              {/* VÄXLANDE INNEHÅLL */}
              {filterMode === 0 ? (
                <>
                  {/* MODE 0: TID & PRIS */}
                  <div className="relative inline-flex items-center">
                    <button
                      onClick={() => setFilterToday(!filterToday)}
                      className={`px-3 py-2 rounded-full text-xs font-bold transition-all border ${filterToday ? 'bg-primary text-primary-foreground border-primary scale-105' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                    >
                      Idag
                    </button>


                    {/* Cloud hint bubble */}
                    {showTodayHint && (
                      <div
                        onClick={dismissTodayHint}
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 cursor-pointer z-50
                          transition-all duration-400
                          ${hintLeaving ? 'opacity-0 scale-75 translate-y-2' : 'opacity-100 scale-100 translate-y-0 animate-cloud-mini'}
                        `}
                        style={{ width: 180 }}
                      >
                        {/* Cloud SVG */}
                        <svg viewBox="0 0 180 100" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-lg">
                          <filter id="cloud-blur-mini">
                            <feGaussianBlur stdDeviation="1.5" />
                          </filter>
                          <g filter="url(#cloud-blur-mini)">
                            <ellipse cx="90" cy="82" rx="72" ry="24" fill="white" />
                            <circle cx="42" cy="62" r="26" fill="white" />
                            <circle cx="130" cy="58" r="30" fill="white" />
                            <circle cx="76" cy="48" r="34" fill="white" />
                            <circle cx="112" cy="54" r="28" fill="white" />
                            <circle cx="22" cy="74" r="18" fill="white" />
                            <circle cx="158" cy="72" r="16" fill="white" />
                          </g>
                          {/* Tail pointing down */}
                          <polygon points="85,96 95,96 90,106" fill="white" />
                        </svg>
                        {/* Text */}
                        <div className="absolute inset-0 flex items-center justify-center pb-3 px-4">
                          <p className="text-center text-slate-700 font-bold text-[10px] leading-snug">
                            Här byter du dag! Klicka för att filtrera på idag.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setFilterFree(!filterFree)}
                    className={`px-3 py-2 rounded-full text-xs font-bold transition-all border ${filterFree ? 'bg-primary text-primary-foreground border-primary scale-105' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                  >
                    Gratis
                  </button>
                </>
              ) : (
                <>
                  {/* MODE 1: ÅLDER */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-full border border-border animate-in fade-in slide-in-from-right-4 duration-300">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Ålder:</span>
                    <select
                      value={filterAge}
                      onChange={(e) => setFilterAge(e.target.value)}
                      className="bg-transparent font-bold text-foreground outline-none cursor-pointer text-xs"
                    >
                      <option value="all">Alla</option>
                      <option value="family">Familj</option>
                      <option value="13+">Ungdom</option>
                      <option value="18+">Vuxen</option>
                      <option value="seniors">Senior</option>
                    </select>
                  </div>
                </>
              )}

            </div>

            {/* HÖGER SIDA: Reset */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-bold text-destructive hover:bg-destructive/10 px-2 py-1 rounded-md transition-colors"
              >
                Rensa
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}