// src/components/home/EventFilters.tsx

import { List, Map as MapIcon, Calendar, RefreshCw, Search, X } from 'lucide-react';
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
  visible: boolean; // För scroll-effekten på rad 2
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

  return (
    <>
      {/* --- RAD 1: SÖK + VIEW TOGGLE (Alltid synlig & Sticky) --- */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/50 px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex gap-3 items-center">

          {/* Sökfält */}
          <div className="flex-grow relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök på event, plats..."
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
      </div>

      {/* --- RAD 2: FILTER (Döljs vid scroll) --- */}
      <div
        className={`sticky top-[68px] z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/50 px-4 py-3 shadow-sm transition-all duration-300 ease-in-out origin-top ${visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none -mt-[68px]'}`}
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-3">

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">

            {/* Kategori Select (Nu mindre och i rad med knapparna) */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`font-bold rounded-full text-xs py-2 px-3 pr-8 outline-none cursor-pointer border hover:border-slate-300 dark:hover:border-slate-500 transition-colors shrink-0 appearance-none bg-no-repeat bg-[right_0.5rem_center] bg-[length:1em_1em] ${categoryColorClass}`}
              style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")` }}
            >
              <option value="all" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Alla kategorier</option>
              {CATEGORY_LIST.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  {cat.label} {cat.emoji}
                </option>
              ))}
            </select>

            <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>

            <button
              onClick={() => setFilterToday(!filterToday)}
              className={`px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1 transition-colors border shrink-0 ${filterToday ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'}`}
            >
              <Calendar size={14} /> Idag
            </button>

            <button
              onClick={() => setFilterFree(!filterFree)}
              className={`px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1 transition-colors border shrink-0 ${filterFree ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'}`}
            >
              Gratis
            </button>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1.5 shrink-0 ml-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-2">Ålder</span>
              <select
                value={filterAge}
                onChange={(e) => setFilterAge(e.target.value)}
                className="bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer text-xs"
              >
                <option value="all">Alla</option>
                <option value="family">Familj</option>
                <option value="13+">Ungdomar</option>
                <option value="18+">Vuxna</option>
                <option value="seniors">Seniorer</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1 shrink-0 ml-auto pl-3"
              >
                <RefreshCw size={12} />
              </button>
            )}

          </div>
        </div>
      </div>
    </>
  );
}