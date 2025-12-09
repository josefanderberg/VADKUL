// src/components/home/EventFilters.tsx

import { List, Map as MapIcon, Calendar, RefreshCw } from 'lucide-react';
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
  visible
}: EventFiltersProps) {

  const selectedCategory = EVENT_CATEGORIES[filterType as EventCategoryType] || null;
  const categoryColorClass = selectedCategory
    ? selectedCategory.color
    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white';

  const hasActiveFilters = filterType !== 'all' || filterFree || filterToday || filterAge !== 'all';

  return (
    <div
      className={`sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm transition-transform duration-300 ease-in-out ${visible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-3">

        {/* RAD 1: Kategori och Vy */}
        <div className="flex justify-between items-center w-full">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`flex-grow md:flex-grow-0 md:w-64 font-bold rounded-xl text-sm p-3 outline-none cursor-pointer border-2 border-transparent transition-colors mr-3 ${categoryColorClass}`}
          >
            <option value="all" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Alla kategorier</option>
            {CATEGORY_LIST.map(cat => (
              <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                {cat.label} {cat.emoji}
              </option>
            ))}
          </select>

          <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex shrink-0">
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setView('map')}
              className={`p-2 rounded-md transition-all ${view === 'map' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
            >
              <MapIcon size={20} />
            </button>
          </div>
        </div>

        {/* RAD 2: Filterknappar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 overflow-x-auto no-scrollbar items-center pb-1">

            <button
              onClick={() => setFilterToday(!filterToday)}
              className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1 transition-colors border-2 shrink-0 ${filterToday ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-200'}`}
            >
              <Calendar size={14} /> Idag
            </button>

            <button
              onClick={() => setFilterFree(!filterFree)}
              className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1 transition-colors border-2 shrink-0 ${filterFree ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-200'}`}
            >
              Gratis
            </button>

            {/* Avgränsare */}
            <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>

            {/* Ålder - Nu direkt synlig */}
            <div className="flex items-center bg-slate-50 dark:bg-slate-700/50 rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Ålder</span>
              <select
                value={filterAge}
                onChange={(e) => setFilterAge(e.target.value)}
                className="bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer text-xs py-1"
              >
                <option value="all">Alla</option>
                <option value="family">Familj</option>
                <option value="13+">Ungdomar</option>
                <option value="18+">Vuxna</option>
                <option value="seniors">Seniorer</option>
              </select>
            </div>

          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1 shrink-0 ml-3 pl-3 border-l border-slate-200 dark:border-slate-700 h-full"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}