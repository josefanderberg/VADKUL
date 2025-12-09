// src/utils/categories.ts

export const EVENT_CATEGORIES = {
  // --- SOCIAL & MINGEL ---
  social: {
    id: 'social',
    label: 'Häng & Fika',
    emoji: '☕',
    // Används för kart-markören
    markerColor: 'bg-amber-500',
    // Används för omarkerade knappar (CreateEvent)
    color: 'bg-amber-100 text-amber-600',
    // NY: Används för märket i EventCard (inkl dark mode)
    badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
    // NY: Ikonfärg i EventCard
    iconColor: 'text-amber-500',
    // NY: Vald status i CreateEvent
    activeColor: 'bg-amber-600 border-amber-600',
    description: 'Avslappnat häng, kaffe, lunch eller en pratstund'
  },
  party: {
    id: 'party',
    label: 'Förfest & Fest',
    emoji: '🍻',
    markerColor: 'bg-indigo-500',
    color: 'bg-indigo-100 text-indigo-600',
    badgeStyle: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30',
    iconColor: 'text-indigo-500',
    activeColor: 'bg-indigo-600 border-indigo-600',
    description: 'Allt från förfest till utgång och danstajm'
  },
  mingle: {
    id: 'mingle',
    label: 'Nätverka & Mingel',
    emoji: '🤝',
    markerColor: 'bg-teal-500',
    color: 'bg-teal-100 text-teal-600',
    badgeStyle: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30',
    iconColor: 'text-teal-500',
    activeColor: 'bg-teal-600 border-teal-600',
    description: 'Professionellt nätverkande, after work eller snabbmingel'
  },
  movie: {
    id: 'movie',
    label: 'Film & Serier',
    emoji: '🎬',
    markerColor: 'bg-cyan-500',
    color: 'bg-cyan-100 text-cyan-600',
    badgeStyle: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
    iconColor: 'text-cyan-500',
    activeColor: 'bg-cyan-600 border-cyan-600',
    description: 'Biobesök, filmkvällar eller maraton av en TV-serie'
  },

  // --- AKTIVITETER & INTRESSEN ---
  game: {
    id: 'game',
    label: 'Spel & Gaming',
    emoji: '🎮',
    markerColor: 'bg-purple-500',
    color: 'bg-purple-100 text-purple-600',
    badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
    iconColor: 'text-purple-500',
    activeColor: 'bg-purple-600 border-purple-600',
    description: 'Brädspel, LAN, konsol-gaming, quiz eller kortspel'
  },
  sport: {
    id: 'sport',
    label: 'Sport & Träning',
    emoji: '⚽',
    markerColor: 'bg-emerald-500',
    color: 'bg-emerald-100 text-emerald-600',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
    iconColor: 'text-emerald-500',
    activeColor: 'bg-emerald-600 border-emerald-600',
    description: 'Fotboll, gym, löprunda, yoga, klättring eller hejarklack'
  },
  food: {
    id: 'food',
    label: 'Matlag & Bak',
    emoji: '🍕',
    markerColor: 'bg-pink-500',
    color: 'bg-pink-100 text-pink-600',
    badgeStyle: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30',
    iconColor: 'text-pink-500',
    activeColor: 'bg-pink-600 border-pink-600',
    description: 'Laga mat ihop, baka, korridorsmiddag eller restaurangbesök'
  },
  outdoor: {
    id: 'outdoor',
    label: 'Utomhus & Äventyr',
    emoji: '🌳',
    markerColor: 'bg-green-500',
    color: 'bg-green-100 text-green-600',
    badgeStyle: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
    iconColor: 'text-green-500',
    activeColor: 'bg-green-600 border-green-600',
    description: 'Vandring, picknick, cykling, fiske eller utflykter i naturen'
  },
  creative: {
    id: 'creative',
    label: 'Kreativt & Pyssel',
    emoji: '🎨',
    markerColor: 'bg-orange-500',
    color: 'bg-orange-100 text-orange-600',
    badgeStyle: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
    iconColor: 'text-orange-500',
    activeColor: 'bg-orange-600 border-orange-600',
    description: 'Måla, rita, handarbete, skriva eller DIY-projekt'
  },
  culture: {
    id: 'culture',
    label: 'Kultur & Musik',
    emoji: '🎻',
    markerColor: 'bg-fuchsia-500',
    color: 'bg-fuchsia-100 text-fuchsia-600',
    badgeStyle: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30',
    iconColor: 'text-fuchsia-500',
    activeColor: 'bg-fuchsia-600 border-fuchsia-600',
    description: 'Konserter, museum, teater, bokklubbar eller jamma ihop'
  },

  // --- AKADEMISKT & CAMPUSRELATERAT ---
  study: {
    id: 'study',
    label: 'Plugg & Tenta',
    emoji: '📚',
    markerColor: 'bg-blue-500',
    color: 'bg-blue-100 text-blue-600',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
    iconColor: 'text-blue-500',
    activeColor: 'bg-blue-600 border-blue-600',
    description: 'Plugga tillsammans inför tentan eller arbeta med projekt'
  },
  campus: {
    id: 'campus',
    label: 'Nation & Kår',
    emoji: '🎓',
    markerColor: 'bg-red-500',
    color: 'bg-red-100 text-red-600',
    badgeStyle: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
    iconColor: 'text-red-500',
    activeColor: 'bg-red-600 border-red-600',
    description: 'Sittningar, pubar, kåraktiviteter och föreningsmöten'
  },
  workshop: {
    id: 'workshop',
    label: 'Workshop & Lärande',
    emoji: '🧠',
    markerColor: 'bg-sky-500',
    color: 'bg-sky-100 text-sky-600',
    badgeStyle: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30',
    iconColor: 'text-sky-500',
    activeColor: 'bg-sky-600 border-sky-600',
    description: 'Lär dig en ny färdighet, programmeringskväll eller språkcafé'
  },

  // --- ÖVRIGT ---
  market: {
    id: 'market',
    label: 'Köp & Sälj',
    emoji: '💸',
    markerColor: 'bg-emerald-600',
    color: 'bg-emerald-100 text-emerald-700',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
    iconColor: 'text-emerald-600',
    activeColor: 'bg-emerald-600 border-emerald-600',
    description: 'Kurslitteratur, möbler eller annat som byter ägare'
  },
  other: {
    id: 'other',
    label: 'Övrigt',
    emoji: '✨',
    markerColor: 'bg-slate-500',
    color: 'bg-slate-100 text-slate-600',
    badgeStyle: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30',
    iconColor: 'text-slate-500',
    activeColor: 'bg-slate-600 border-slate-600',
    description: 'Allt annat mellan himmel och jord'
  }
} as const;

export type EventCategoryType = keyof typeof EVENT_CATEGORIES;
export const CATEGORY_LIST = Object.values(EVENT_CATEGORIES);