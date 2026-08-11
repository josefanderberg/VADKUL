// src/utils/categories.ts
import mingleImage from '../assets/categories/mingle.png';
import cultureImage from '../assets/categories/culture.png';
import servicesImage from '../assets/categories/services.png';

/**
 * 11 kategorier (10 + Övrigt). Styr filter, markörfärg och legend.
 * OBS: events har dessutom en fri `emoji` (vald av LLM per event) som visas
 * på kartpinnen — kategorins emoji nedan är bara fallback/legend.
 */
export const EVENT_CATEGORIES = {
  music: {
    id: 'music',
    label: 'Musik',
    emoji: '🎵',
    markerColor: 'bg-pink-500',
    markerHex: '#ec4899',
    color: 'bg-pink-100 text-pink-600',
    badgeStyle: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30',
    iconColor: 'text-pink-500',
    activeColor: 'bg-pink-600 border-pink-600',
    hoverBorder: 'hover:border-pink-500',
    description: 'Konsert, spelning, festival, DJ, klubbmusik',
    defaultImage: cultureImage,
  },
  stage: {
    id: 'stage',
    label: 'Scen',
    emoji: '🎭',
    markerColor: 'bg-purple-600',
    markerHex: '#9333ea',
    color: 'bg-purple-100 text-purple-600',
    badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
    iconColor: 'text-purple-500',
    activeColor: 'bg-purple-600 border-purple-600',
    hoverBorder: 'hover:border-purple-600',
    description: 'Teater, standup, dans, opera, film',
    defaultImage: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=500&q=80',
  },
  art: {
    id: 'art',
    label: 'Konst',
    emoji: '🎨',
    markerColor: 'bg-orange-500',
    markerHex: '#f97316',
    color: 'bg-orange-100 text-orange-600',
    badgeStyle: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
    iconColor: 'text-orange-500',
    activeColor: 'bg-orange-600 border-orange-600',
    hoverBorder: 'hover:border-orange-500',
    description: 'Utställning, vernissage, galleri',
    defaultImage: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=500&q=80',
  },
  sport: {
    id: 'sport',
    label: 'Sport & träning',
    emoji: '⚽',
    markerColor: 'bg-red-500',
    markerHex: '#ef4444',
    color: 'bg-red-100 text-red-600',
    badgeStyle: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
    iconColor: 'text-red-500',
    activeColor: 'bg-red-600 border-red-600',
    hoverBorder: 'hover:border-red-500',
    description: 'Match, turnering, yoga, gym, löpning',
    defaultImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=500&q=80',
  },
  food: {
    id: 'food',
    label: 'Mat & dryck',
    emoji: '🍽️',
    markerColor: 'bg-amber-600',
    markerHex: '#d97706',
    color: 'bg-amber-100 text-amber-700',
    badgeStyle: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700',
    iconColor: 'text-amber-600',
    activeColor: 'bg-amber-700 border-amber-700',
    hoverBorder: 'hover:border-amber-600',
    description: 'Matfestival, provning, middag, brunch',
    defaultImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=500&q=80',
  },
  market: {
    id: 'market',
    label: 'Marknad',
    emoji: '🛍️',
    markerColor: 'bg-emerald-600',
    markerHex: '#059669',
    color: 'bg-emerald-100 text-emerald-700',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
    iconColor: 'text-emerald-600',
    activeColor: 'bg-emerald-600 border-emerald-600',
    hoverBorder: 'hover:border-emerald-600',
    description: 'Loppis, marknad, mässa',
    defaultImage: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=500&q=80',
  },
  party: {
    id: 'party',
    label: 'Fest & uteliv',
    emoji: '🎉',
    markerColor: 'bg-fuchsia-600',
    markerHex: '#c026d3',
    color: 'bg-fuchsia-100 text-fuchsia-600',
    badgeStyle: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30',
    iconColor: 'text-fuchsia-500',
    activeColor: 'bg-fuchsia-600 border-fuchsia-600',
    hoverBorder: 'hover:border-fuchsia-600',
    description: 'Fest, party, afterwork, klubb',
    defaultImage: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=500&q=80',
  },
  social: {
    id: 'social',
    label: 'Socialt & spel',
    emoji: '🤝',
    markerColor: 'bg-teal-500',
    markerHex: '#14b8a6',
    color: 'bg-teal-100 text-teal-600',
    badgeStyle: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30',
    iconColor: 'text-teal-500',
    activeColor: 'bg-teal-600 border-teal-600',
    hoverBorder: 'hover:border-teal-500',
    description: 'Mingel, nätverk, quiz, brädspel, träffar',
    defaultImage: mingleImage,
  },
  course: {
    id: 'course',
    label: 'Kurs & föreläsning',
    emoji: '📚',
    markerColor: 'bg-blue-500',
    markerHex: '#3b82f6',
    color: 'bg-blue-100 text-blue-600',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
    iconColor: 'text-blue-500',
    activeColor: 'bg-blue-600 border-blue-600',
    hoverBorder: 'hover:border-blue-500',
    description: 'Workshop, kurs, seminarium, föredrag',
    defaultImage: servicesImage,
  },
  family: {
    id: 'family',
    label: 'Familj & barn',
    // 🧸 i stället för familje-emojin (Josef 11/8): flerpersoners-glyfen blir
    // grötig i 40px-cirkeln i kategorikolumnen; nallen läses direkt.
    emoji: '🧸',
    markerColor: 'bg-cyan-500',
    markerHex: '#06b6d4',
    color: 'bg-cyan-100 text-cyan-600',
    badgeStyle: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
    iconColor: 'text-cyan-500',
    activeColor: 'bg-cyan-600 border-cyan-600',
    hoverBorder: 'hover:border-cyan-500',
    description: 'Barnteater, familjeevent, sagostund',
    defaultImage: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=500&q=80',
  },
  other: {
    id: 'other',
    label: 'Övrigt',
    emoji: '✨',
    markerColor: 'bg-gray-400',
    markerHex: '#94a3b8',
    color: 'bg-gray-100 text-gray-600',
    badgeStyle: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30',
    iconColor: 'text-gray-500',
    activeColor: 'bg-gray-500 border-gray-500',
    hoverBorder: 'hover:border-gray-400',
    description: 'Allt som inte passar in ovan',
    defaultImage: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=500&q=80',
  },
} as const;

export type EventCategoryType = keyof typeof EVENT_CATEGORIES;

/**
 * Opt-in-"kategorier" som INTE är LLM-kategorier utan KÄLLOR med väldigt många
 * event (Svenska kyrkan, PRO). De är avstängda som default och ingår INTE i
 * "visa alla" — deras event syns bara när användaren själv kryssar i dem.
 *
 * Hembygdsföreningarna låg här men är borttagna (9/8, ägarbeslut: de ska ingå
 * med resten). Där togs även SOURCE_DEFS-raden bort — utan den klassas de inte
 * som källa och faller in i sin vanliga LLM-kategori, alltid synliga.
 *
 * Korpen låg här förut men är borttaget (8/8, ägarbeslut: utbudet är i praktiken
 * Stockholmsbundet). Källan finns KVAR i SOURCE_DEFS utan knapp — då förblir
 * dess ~2 600 event dolda i stället för att falla tillbaka i "visa alla".
 *
 * Nycklarna måste matcha SOURCE_DEFS i ./sources (klassningen sker på event-
 * URL:ens värdnamn via classifySource, samma logik som markörfärgen på kartan).
 * markerHex används av filtrets cirklar (samma brick-gradient som kart-
 * markörerna); 700-nyanser så de skiljer sig från de vanliga kategoriernas
 * 500/600-kulörer (kyrkans violett vs Scens lila, PRO:s rosa vs Musiks rosa).
 */
export const SPECIAL_CATEGORIES = {
  svenskakyrkan: {
    id: 'svenskakyrkan',
    label: 'Svenska kyrkan',
    emoji: '⛪',
    markerHex: '#6d28d9',
    color: 'bg-violet-100 text-violet-700',
    description: 'Svenska kyrkans församlingar',
  },
  pro: {
    id: 'pro',
    label: 'PRO',
    emoji: '🧓',
    markerHex: '#be185d',
    color: 'bg-pink-100 text-pink-700',
    description: 'PRO — pensionärernas riksorganisation',
  },
} as const;

export type SpecialCategoryType = keyof typeof SPECIAL_CATEGORIES;

/** Ordnad lista (Svenska kyrkan, PRO) för opt-in-raderna i filtret. */
export const SPECIAL_CATEGORY_LIST = Object.values(SPECIAL_CATEGORIES);

/** Snabb uppslagning: är ett filter-id en opt-in-källa (inte en LLM-kategori)? */
export const SPECIAL_CATEGORY_KEYS = new Set<string>(Object.keys(SPECIAL_CATEGORIES));

// Ålderskategorier för events
export const AGE_CATEGORIES = [
  { id: 'family', label: 'Familj', min: 0, max: 99 },
  { id: 'youth', label: 'Ungdom', min: 13, max: 17 },
  { id: 'adults', label: 'Vuxna', min: 18, max: 99 },
  { id: 'seniors', label: 'Seniorer', min: 65, max: 99 },
];

export const CATEGORY_LIST = Object.values(EVENT_CATEGORIES);
