// src/components/home/EventFilters.tsx
import { useState, useEffect } from 'react';
import { SlidersHorizontal, List, Map as MapIcon, Search, X, ChevronDown } from 'lucide-react';
import { CATEGORY_LIST, EVENT_CATEGORIES, type EventCategoryType } from '../../utils/categories';

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
  setSearchQuery
}: EventFiltersProps) {

  const selectedCategory = EVENT_CATEGORIES[filterType as EventCategoryType] || null;
  const categoryColorClass = selectedCategory
    ? selectedCategory.color
    : 'bg-muted text-foreground';

  const hasActiveFilters = filterType !== 'all' || filterFree || filterToday || filterAge !== 'all' || searchQuery.length > 0;

  // 0 = Basic (Idag + Gratis), 1 = Age (Ålder)
  const [filterMode] = useState<0 | 1>(0);
  const [showFilters, setShowFilters] = useState(false);

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
        <div className="max-w-6xl mx-auto px-4 py-3 pb-2 flex gap-3 items-center">
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
          className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${showFilters ? 'max-h-[60px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="max-w-6xl mx-auto px-4 pb-3 pt-0 flex items-center justify-between gap-2">

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
                  <button
                    onClick={() => setFilterToday(!filterToday)}
                    className={`px-3 py-2 rounded-full text-xs font-bold transition-all border ${filterToday ? 'bg-primary text-primary-foreground border-primary scale-105' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                  >
                    Idag
                  </button>
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