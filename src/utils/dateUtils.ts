// src/utils/dateUtils.ts

export function formatTime(dateObj: Date): string {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

    const dateString = dateObj.toLocaleDateString('sv-SE', dateOptions);
    const timeString = dateObj.toLocaleTimeString('sv-SE', timeOptions);

    if (dateObj.toDateString() === today.toDateString()) {
        return `Idag kl. ${timeString}`;
    } else if (dateObj.toDateString() === tomorrow.toDateString()) {
        return `Imorgon kl. ${timeString}`;
    } else {
        return `${dateString} kl. ${timeString}`;
    }
}