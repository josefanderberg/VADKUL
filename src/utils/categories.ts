// src/utils/categories.ts
import mingleImage from '../assets/categories/mingle.png';
import cultureImage from '../assets/categories/culture.png';

export const EVENT_CATEGORIES = {
  // --- AKTIVITET & HÄLSA ---
  play: {
    id: 'play',
    label: 'Spel & Lek',
    emoji: '🤹',
    markerColor: 'bg-orange-500',
    color: 'bg-orange-100 text-orange-600',
    badgeStyle: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
    iconColor: 'text-orange-500',
    activeColor: 'bg-orange-600 border-orange-600',
    description: 'Kubb, brännboll, kurragömma eller vattenkrig',
    defaultImage: 'https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?auto=format&fit=crop&w=800&q=80'
  },
  sport: {
    id: 'sport',
    label: 'Sport & Tävling',
    emoji: '🏆',
    markerColor: 'bg-red-500',
    color: 'bg-red-100 text-red-600',
    badgeStyle: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
    iconColor: 'text-red-500',
    activeColor: 'bg-red-600 border-red-600',
    description: 'Fotbollsmatcher, turneringar och lagidrott',
    defaultImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80'
  },
  training: {
    id: 'training',
    label: 'Träning & Hälsa',
    emoji: '💪',
    markerColor: 'bg-emerald-500',
    color: 'bg-emerald-100 text-emerald-600',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
    iconColor: 'text-emerald-500',
    activeColor: 'bg-emerald-600 border-emerald-600',
    description: 'Gymmet, löprundan, yoga eller powerwalk',
    defaultImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80'
  },

  // --- SOCIALT & CAMPUS ---
  party: {
    id: 'party',
    label: 'Fest & Nattliv',
    emoji: '🪩',
    markerColor: 'bg-purple-600',
    color: 'bg-purple-100 text-purple-600',
    badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
    iconColor: 'text-purple-500',
    activeColor: 'bg-purple-600 border-purple-600',
    description: 'Sittningar, mellanfest, utgång eller korridorsfest',
    defaultImage: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=800&q=80'
  },
  social: {
    id: 'social',
    label: 'Fika & Häng',
    emoji: '☕',
    markerColor: 'bg-amber-500',
    color: 'bg-amber-100 text-amber-600',
    badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
    iconColor: 'text-amber-500',
    activeColor: 'bg-amber-600 border-amber-600',
    description: 'Avslappnat häng, kaffe, lunch eller en pratstund',
    defaultImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80'
  },
  campus: {
    id: 'campus',
    label: 'Nation & Kår',
    emoji: '🎓',
    markerColor: 'bg-indigo-500',
    color: 'bg-indigo-100 text-indigo-600',
    badgeStyle: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30',
    iconColor: 'text-indigo-500',
    activeColor: 'bg-indigo-600 border-indigo-600',
    description: 'Evenemang arrangerade av nationer eller kåren',
    defaultImage: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=800&q=80'
  },

  // --- SAMHÄLLE & ENGAGEMANG ---
  community: {
    id: 'community',
    label: 'Samhälle & Påverkan',
    emoji: '🌍',
    markerColor: 'bg-cyan-600',
    color: 'bg-cyan-100 text-cyan-700',
    badgeStyle: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
    iconColor: 'text-cyan-600',
    activeColor: 'bg-cyan-600 border-cyan-600',
    description: 'Diskussioner, välgörenhet, samarbeten och framtidsfrågor',
    defaultImage: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=800&q=80' // Ny bild: Volontärer/Händer
  },
  culture: {
    id: 'culture',
    label: 'Kultur & Kreativt',
    emoji: '🎭',
    markerColor: 'bg-pink-500',
    color: 'bg-pink-100 text-pink-600',
    badgeStyle: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30',
    iconColor: 'text-pink-500',
    activeColor: 'bg-pink-600 border-pink-600',
    description: 'Livemusik, teater, utställningar och jam sessions',
    defaultImage: cultureImage // Updated
  },

  // --- KUNSKAP & INTRESSE ---
  study: {
    id: 'study',
    label: 'Plugg & Fokus',
    emoji: '📚',
    markerColor: 'bg-blue-500',
    color: 'bg-blue-100 text-blue-600',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
    iconColor: 'text-blue-500',
    activeColor: 'bg-blue-600 border-blue-600',
    description: 'Tenta-P, grupparbeten eller tyst läsning',
    defaultImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80'
  },
  workshop: {
    id: 'workshop',
    label: 'Kunskap & Lärande',
    emoji: '🧠',
    markerColor: 'bg-sky-500',
    color: 'bg-sky-100 text-sky-600',
    badgeStyle: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30',
    iconColor: 'text-sky-500',
    activeColor: 'bg-sky-600 border-sky-600',
    description: 'Föreläsningar, workshops, språkcafé och nya färdigheter',
    defaultImage: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80' // Ny bild: Föreläsningssal/Workshop
  },
  creative: {
    id: 'creative',
    label: 'Skapande & DIY',
    emoji: '🎨',
    markerColor: 'bg-orange-500',
    color: 'bg-orange-100 text-orange-600',
    badgeStyle: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
    iconColor: 'text-orange-500',
    activeColor: 'bg-orange-600 border-orange-600',
    description: 'Måla, rita, handarbete, skriva eller byggprojekt',
    defaultImage: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=800&q=80' // Ny bild: Målarfärger/Penslar
  },

  // --- MAT & ÖVRIGT ---
  food: {
    id: 'food',
    label: 'Mat & Dryck',
    emoji: '🍕',
    markerColor: 'bg-amber-900', // Mörkbrun (Trä)
    color: 'bg-amber-100 text-amber-900',
    badgeStyle: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700',
    iconColor: 'text-amber-900',
    activeColor: 'bg-amber-950 border-amber-950',
    description: 'Middag, bakning, grillning eller matlag',
    defaultImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'
  },
  game: {
    id: 'game',
    label: 'Data & Gaming',
    emoji: '🎮',
    markerColor: 'bg-purple-500',
    color: 'bg-purple-100 text-purple-600',
    badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
    iconColor: 'text-purple-500',
    activeColor: 'bg-purple-600 border-purple-600',
    description: 'LAN, konsol-gaming, e-sport eller arkad',
    defaultImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80'
  },
  boardgame: {
    id: 'boardgame',
    label: 'Sällskapsspel',
    emoji: '🎲',
    markerColor: 'bg-stone-500',
    color: 'bg-stone-100 text-stone-600',
    badgeStyle: 'bg-stone-100 text-stone-800 border-stone-200 dark:bg-stone-500/20 dark:text-stone-300 dark:border-stone-500/30',
    iconColor: 'text-stone-500',
    activeColor: 'bg-stone-600 border-stone-600',
    description: 'Brädspel, kortspel, rollspel eller schack',
    defaultImage: 'https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?auto=format&fit=crop&w=800&q=80' // Ny bild: Tärningar/Brädspel
  },
  market: {
    id: 'market',
    label: 'Köp & Sälj',
    emoji: '💸',
    markerColor: 'bg-emerald-600',
    color: 'bg-emerald-100 text-emerald-700',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
    iconColor: 'text-emerald-600',
    activeColor: 'bg-emerald-600 border-emerald-600',
    description: 'Loppis, kurslitteratur eller klädbytardag',
    defaultImage: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=800&q=80' // Ny bild: Loppis/Shopping
  },
  outdoor: {
    id: 'outdoor',
    label: 'Natur & Uteliv',
    emoji: '🌲',
    markerColor: 'bg-green-500',
    color: 'bg-green-100 text-green-600',
    badgeStyle: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
    iconColor: 'text-green-500',
    activeColor: 'bg-green-600 border-green-600',
    description: 'Vandring, picknick, cykling, fiske och friluftsliv',
    defaultImage: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80'
  },
  movie: {
    id: 'movie',
    label: 'Film & Bio',
    emoji: '🎬',
    markerColor: 'bg-cyan-500',
    color: 'bg-cyan-100 text-cyan-600',
    badgeStyle: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
    iconColor: 'text-cyan-500',
    activeColor: 'bg-cyan-600 border-cyan-600',
    description: 'Biobesök, filmkvällar eller maraton av en TV-serie',
    defaultImage: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80'
  },
  mingle: {
    id: 'mingle',
    label: 'Nätverk & Mingel',
    emoji: '🤝',
    markerColor: 'bg-teal-500',
    color: 'bg-teal-100 text-teal-600',
    badgeStyle: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30',
    iconColor: 'text-teal-500',
    activeColor: 'bg-teal-600 border-teal-600',
    description: 'Professionellt nätverkande, lokala samarbeten och after work',
    defaultImage: mingleImage // Updated
  },
  other: {
    id: 'other',
    label: 'Övrigt',
    emoji: '✨',
    markerColor: 'bg-gray-400',
    color: 'bg-gray-100 text-gray-600',
    badgeStyle: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30',
    iconColor: 'text-gray-500',
    activeColor: 'bg-gray-500 border-gray-500',
    description: 'Allt som inte passar in ovan',
    defaultImage: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80' // Ny bild: Sparkler/Festligt/Partiklar
  }
} as const;

export type EventCategoryType = keyof typeof EVENT_CATEGORIES;
// Ålderskategorier för events
export const AGE_CATEGORIES = [
  { id: 'family', label: 'Familj', min: 0, max: 99 },
  { id: 'youth', label: 'Ungdom', min: 13, max: 17 },
  { id: 'adults', label: 'Vuxna', min: 18, max: 99 },
  { id: 'seniors', label: 'Seniorer', min: 65, max: 99 },
];

export const CATEGORY_LIST = Object.values(EVENT_CATEGORIES);