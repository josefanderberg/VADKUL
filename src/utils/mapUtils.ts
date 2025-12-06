// src/utils/mapUtils.ts

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Jordens radie i km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

export const getEventEmoji = (type: string): string => {
    switch (type) {
        case 'party': return '🍻';
        case 'social': return '☕';
        case 'game': return '🎮';
        case 'sport': return '⚽';
        case 'study': return '📚';
        case 'food': return '🍕';
        case 'help_move': return '📦';
        case 'transport': return '🚗';
        default: return '🌟';
    }
};

export const getEventColor = (type: string): string => {
    // Returnerar Tailwind-klasser för bakgrund/text
    switch (type) {
        case 'party': return 'bg-indigo-100 text-indigo-600';
        case 'social': return 'bg-emerald-100 text-emerald-600';
        case 'sport': return 'bg-green-100 text-green-600';
        case 'game': return 'bg-purple-100 text-purple-600';
        case 'food': return 'bg-pink-100 text-pink-600';
        case 'help_move': return 'bg-red-100 text-red-600';
        default: return 'bg-slate-100 text-slate-600';
    }
};