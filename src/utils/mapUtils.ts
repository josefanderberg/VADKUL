// src/utils/mapUtils.ts
import { EVENT_CATEGORIES } from './categories';
import type { EventCategoryType } from './categories';

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
    // Vi castar type till vår key, och faller tillbaka på 'other' om den inte finns
    const category = EVENT_CATEGORIES[type as EventCategoryType];
    return category ? category.emoji : '🌟';
};

export const getEventColor = (type: string): string => {
    const category = EVENT_CATEGORIES[type as EventCategoryType];
    return category ? category.color : 'bg-slate-100 text-slate-600';
};

export const getEventLabel = (type: string): string => {
    const category = EVENT_CATEGORIES[type as EventCategoryType];
    return category ? category.label : 'Event';
};