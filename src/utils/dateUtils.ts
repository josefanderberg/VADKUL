export const calculateAge = (birthDateString: string): number => {
    if (!birthDateString) return 0;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

export const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
};

export const formatEventDate = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

    const isTomorrow = date.getDate() === tomorrow.getDate() &&
        date.getMonth() === tomorrow.getMonth() &&
        date.getFullYear() === tomorrow.getFullYear();

    const time = formatTime(date);

    if (isToday) {
        return `Idag ${time}`;
    } else if (isTomorrow) {
        return `Imorgon ${time}`;
    } else {
        // Weekday Day Month Time (e.g., "Mån 12 Jan 18:00")
        const dateStr = date.toLocaleDateString('sv-SE', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
        // Remove dot from month abbreviation if present and capitalize
        const cleanDateStr = dateStr.replace('.', '');
        // Capitalize first letter
        const capitalizedDateStr = cleanDateStr.charAt(0).toUpperCase() + cleanDateStr.slice(1);

        return `${capitalizedDateStr} ${time}`;
    }
};