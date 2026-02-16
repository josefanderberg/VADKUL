// Växjö venue coordinates lookup table
export const VAXJO_VENUES: Record<string, [number, number]> = {
    // Sports & Entertainment
    'Vida Arena': [56.8795, 14.8094],
    'Vida arena': [56.8795, 14.8094],
    'vida arena': [56.8795, 14.8094],

    // Culture & Music
    'Växjö Konserthus': [56.8778, 14.8089],
    'Vaxjo Konserthus': [56.8778, 14.8089],
    'växjö konserthus': [56.8778, 14.8089],

    'Nygatan 6': [56.8796, 14.8061],
    'nygatan 6': [56.8796, 14.8061],

    'Växjö Teater': [56.8789, 14.8067],
    'Vaxjo Teater': [56.8789, 14.8067],
    'växjö teater': [56.8789, 14.8067],

    // Default fallback (Växjö centrum - Stortorget)
    'DEFAULT': [56.8796, 14.8094]
};

/**
 * Get coordinates for a venue name
 * Returns coordinates if found in lookup table, otherwise returns Växjö centrum
 */
export function getVenueCoordinates(venueName: string): [number, number] {
    // Try exact match first
    if (VAXJO_VENUES[venueName]) {
        return VAXJO_VENUES[venueName];
    }

    // Try case-insensitive match
    const lowerVenue = venueName.toLowerCase();
    for (const [key, coords] of Object.entries(VAXJO_VENUES)) {
        if (key.toLowerCase() === lowerVenue) {
            return coords;
        }
    }

    // Return default (Växjö centrum)
    return VAXJO_VENUES.DEFAULT;
}
