// src/utils/mapUtils.ts
import { EVENT_CATEGORIES } from './categories';
import type { EventCategoryType } from './categories';

// --- NYA FUNKTIONER FÖR LOCAL STORAGE ---
export function saveLocationToLocalStorage(lat: number, lng: number) {
    localStorage.setItem('user_lat', lat.toString());
    localStorage.setItem('user_lng', lng.toString());
}

export function loadLocationFromLocalStorage(): { lat: number, lng: number } | null {
    const latStr = localStorage.getItem('user_lat');
    const lngStr = localStorage.getItem('user_lng');
    
    if (latStr && lngStr) {
        return {
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr)
        };
    }
    return null;
}

export function getCurrentBrowserLocation(): Promise<{lat: number, lng: number}> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err)
        );
    });
}
// ----------------------------------------

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