// src/utils/categories.ts

export const EVENT_CATEGORIES = {
  // --- SOCIAL & MINGEL ---

  social: {
    id: 'social',
    label: 'Häng & Fika',
    emoji: '☕',
    color: 'bg-amber-100 text-amber-600',
    markerColor: 'bg-amber-500', 
    description: 'Avslappnat häng, kaffe, lunch eller en pratstund'
  },
    party: {
    id: 'party',
    label: 'Förfest & Fest',
    emoji: '🍻',
    color: 'bg-indigo-100 text-indigo-600',
    markerColor: 'bg-indigo-500', 
    description: 'Allt från förfest till utgång och danstajm'
  },
  // Ny: Mer strukturerat mingel
  mingle: {
      id: 'mingle',
      label: 'Nätverka & Mingel',
      emoji: '🤝',
      color: 'bg-teal-100 text-teal-600',
      markerColor: 'bg-teal-500',
      description: 'Professionellt nätverkande, after work eller snabbmingel'
  },
  // Ny: Film och serier
  movie: {
      id: 'movie',
      label: 'Film & Serier',
      emoji: '🎬',
      color: 'bg-cyan-100 text-cyan-600',
      markerColor: 'bg-cyan-500',
      description: 'Biobesök, filmkvällar eller maraton av en TV-serie'
  },
  
  // --- AKTIVITETER & INTRESSEN ---
  game: {
    id: 'game',
    label: 'Spel & Gaming',
    emoji: '🎮',
    color: 'bg-purple-100 text-purple-600',
    markerColor: 'bg-purple-500', 
    description: 'Brädspel, LAN, konsol-gaming, quiz eller kortspel'
  },
  sport: {
    id: 'sport',
    label: 'Sport & Träning',
    emoji: '⚽',
    color: 'bg-emerald-100 text-emerald-600',
    markerColor: 'bg-emerald-500', 
    description: 'Fotboll, gym, löprunda, yoga, klättring eller hejarklack'
  },
  food: {
    id: 'food',
    label: 'Matlag & Bak',
    emoji: '🍕',
    color: 'bg-pink-100 text-pink-600',
    markerColor: 'bg-pink-500', 
    description: 'Laga mat ihop, baka, korridorsmiddag eller restaurangbesök'
  },
  // Ny: Utomhus och natur
  outdoor: {
      id: 'outdoor',
      label: 'Utomhus & Äventyr',
      emoji: '🌳',
      color: 'bg-green-100 text-green-600',
      markerColor: 'bg-green-500',
      description: 'Vandring, picknick, cykling, fiske eller utflykter i naturen'
  },
  // Ny: Kreativt och pyssel
  creative: {
      id: 'creative',
      label: 'Kreativt & Pyssel',
      emoji: '🎨',
      color: 'bg-orange-100 text-orange-600',
      markerColor: 'bg-orange-500',
      description: 'Måla, rita, handarbete, skriva eller DIY-projekt'
  },
  // Ny: Musik och kultur
  culture: {
      id: 'culture',
      label: 'Kultur & Musik',
      emoji: '🎻',
      color: 'bg-fuchsia-100 text-fuchsia-600',
      markerColor: 'bg-fuchsia-500',
      description: 'Konserter, museum, teater, bokklubbar eller jamma ihop'
  },

  // --- AKADEMISKT & CAMPUSRELATERAT ---
  study: {
    id: 'study',
    label: 'Plugg & Tenta',
    emoji: '📚',
    color: 'bg-blue-100 text-blue-600',
    markerColor: 'bg-blue-500', 
    description: 'Plugga tillsammans inför tentan eller arbeta med projekt'
  },
  campus: {
    id: 'campus',
    label: 'Nation & Kår',
    emoji: '🎓',
    color: 'bg-red-100 text-red-600',
    markerColor: 'bg-red-500', 
    description: 'Sittningar, pubar, kåraktiviteter och föreningsmöten'
  },
  // Ny: Workshops och lärande
  workshop: {
      id: 'workshop',
      label: 'Workshop & Lärande',
      emoji: '🧠',
      color: 'bg-sky-100 text-sky-600',
      markerColor: 'bg-sky-500',
      description: 'Lär dig en ny färdighet, programmeringskväll eller språkcafé'
  },

  // --- ÖVRIGT ---
  market: {
    id: 'market',
    label: 'Köp & Sälj',
    emoji: '💸',
    color: 'bg-emerald-100 text-emerald-700',
    markerColor: 'bg-emerald-600', 
    description: 'Kurslitteratur, möbler eller annat som byter ägare'
  },
  other: {
    id: 'other',
    label: 'Övrigt',
    emoji: '✨',
    color: 'bg-slate-100 text-slate-600',
    markerColor: 'bg-slate-500', 
    description: 'Allt annat mellan himmel och jord'
  }
} as const;

export type EventCategoryType = keyof typeof EVENT_CATEGORIES;
export const CATEGORY_LIST = Object.values(EVENT_CATEGORIES);