// src/utils/categories.ts

export const EVENT_CATEGORIES = {
    party: {
      id: 'party',
      label: 'Fest & Krök',
      emoji: '🍻',
      color: 'bg-indigo-100 text-indigo-600',
      markerColor: 'bg-indigo-500', // <--- NY: Stark färg för kartan
      description: 'Allt från förfest till utgång'
    },
    study: {
      id: 'study',
      label: 'Plugg & Tenta',
      emoji: '📚',
      color: 'bg-blue-100 text-blue-600',
      markerColor: 'bg-blue-500', // <--- NY
      description: 'Plugga tillsammans inför tentan'
    },
    campus: {
      id: 'campus',
      label: 'Nation & Kår',
      emoji: '🎓',
      color: 'bg-red-100 text-red-600',
      markerColor: 'bg-red-500', // <--- NY
      description: 'Sittningar, pubar och kåraktiviteter'
    },
    social: {
      id: 'social',
      label: 'Häng & Fika',
      emoji: '☕',
      color: 'bg-amber-100 text-amber-600',
      markerColor: 'bg-amber-500', // <--- NY
      description: 'Avslappnat häng eller en kaffe'
    },
    game: {
      id: 'game',
      label: 'Spel & Gaming',
      emoji: '🎮',
      color: 'bg-purple-100 text-purple-600',
      markerColor: 'bg-purple-500', // <--- NY
      description: 'Brädspel, LAN eller quiz'
    },
    sport: {
      id: 'sport',
      label: 'Sport & Träning',
      emoji: '⚽',
      color: 'bg-emerald-100 text-emerald-600',
      markerColor: 'bg-emerald-500', // <--- NY
      description: 'Fotboll, gym eller löprunda'
    },
    food: {
      id: 'food',
      label: 'Matlag & Bak',
      emoji: '🍕',
      color: 'bg-pink-100 text-pink-600',
      markerColor: 'bg-pink-500', // <--- NY
      description: 'Laga mat ihop eller korridorsmiddag'
    },
    market: {
      id: 'market',
      label: 'Köp & Sälj',
      emoji: '💸',
      color: 'bg-lime-100 text-lime-700',
      markerColor: 'bg-lime-600', // <--- NY
      description: 'Kurslitteratur eller möbler'
    },
    other: {
      id: 'other',
      label: 'Övrigt',
      emoji: '✨',
      color: 'bg-slate-100 text-slate-600',
      markerColor: 'bg-slate-500', // <--- NY
      description: 'Allt annat mellan himmel och jord'
    }
  } as const;
  
  export type EventCategoryType = keyof typeof EVENT_CATEGORIES;
  export const CATEGORY_LIST = Object.values(EVENT_CATEGORIES);