// src/components/home/EventFilters.tsx
import { useState, useEffect, useRef } from 'react';
import { List, Map as MapIcon, Calendar, RefreshCw, Search, X, ChevronDown } from 'lucide-react';
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
  visible: boolean; // För scroll-effekten
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
  visible,
  searchQuery,
  setSearchQuery
}: EventFiltersProps) {

  const selectedCategory = EVENT_CATEGORIES[filterType as EventCategoryType] || null;
  const categoryColorClass = selectedCategory
    ? selectedCategory.color
    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white';

  const hasActiveFilters = filterType !== 'all' || filterFree || filterToday || filterAge !== 'all' || searchQuery.length > 0;

  // 0 = Basic (Idag + Gratis), 1 = Age (Ålder)
  const [filterMode, setFilterMode] = useState<0 | 1>(0);
  const prevVisible = useRef(visible);

  useEffect(() => {
    // Om vi precis blev synliga (scrollade upp), byt läge!
    // Men bara om vi faktiskt var osynliga innan.
    if (visible && !prevVisible.current) {
      setFilterMode(prev => (prev === 0 ? 1 : 0));
    }
    prevVisible.current = visible;
  }, [visible]);

  return (
    <div className="sticky top-0 z-40 transition-all duration-300">

      {/* --- CONTAINER: Bakgrund & Blur (Håller båda raderna) --- */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm transition-all duration-300">

        {/* RAD 1: SÖK + VIEW (Alltid synlig) */}
        <div className="max-w-6xl mx-auto px-4 py-3 pb-2 flex gap-3 items-center">
          {/* Sökfält */}
          <div className="flex-grow relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök på event..."
              className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl flex shrink-0 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setView('map')}
              className={`p-2 rounded-lg transition-all ${view === 'map' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              <MapIcon size={20} />
            </button>
          </div>
        </div>

        {/* RAD 2: FILTER (Kollapsar) */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${visible ? 'max-h-[60px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="max-w-6xl mx-auto px-4 pb-3 pt-0 flex items-center justify-between gap-2">

            {/* VÄNSTER SIDA: Filterval */}
            <div className="flex items-center gap-2 flex-grow">

              {/* Alltid synlig: KATEGORIER */}
              <div className="relative shrink-0">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className={`appearance-none font-bold rounded-full text-xs py-2 pl-3 pr-8 outline-none cursor-pointer border hover:border-slate-300 dark:hover:border-slate-500 transition-colors ${categoryColorClass}`}
                >
                  <option value="all" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Kategorier</option>
                  {CATEGORY_LIST.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      {cat.label} {cat.emoji}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={14} />
              </div>

              <div className="w-[1px] h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

              {/* VÄXLANDE INNEHÅLL */}
              {filterMode === 0 ? (
                <>
                  {/* MODE 0: TID & PRIS */}
                  <button
                    onClick={() => setFilterToday(!filterToday)}
                    className={`px-3 py-2 rounded-full text-xs font-bold transition-all border ${filterToday ? 'bg-indigo-600 text-white border-indigo-600 scale-105' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'}`}
                  >
                    Idag
                  </button>
                  <button
                    onClick={() => setFilterFree(!filterFree)}
                    className={`px-3 py-2 rounded-full text-xs font-bold transition-all border ${filterFree ? 'bg-indigo-600 text-white border-indigo-600 scale-105' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'}`}
                  >
                    Gratis
                  </button>
                </>
              ) : (
                <>
                  {/* MODE 1: ÅLDER */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-right-4 duration-300">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Ålder:</span>
                    <select
                      value={filterAge}
                      onChange={(e) => setFilterAge(e.target.value)}
                      className="bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer text-xs"
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
                className="text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 px-2 py-1 rounded-md transition-colors"
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