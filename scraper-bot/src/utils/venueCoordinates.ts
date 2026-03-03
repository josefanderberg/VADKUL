// Växjö venue coordinates lookup table
export const VAXJO_VENUES: Record<string, [number, number]> = {
    // Sports & Entertainment
    'Vida Arena': [56.8797, 14.7736],
    'Vida arena': [56.8797, 14.7736],
    'vida arena': [56.8797, 14.7736],
    'Fortnox Arena': [56.8790, 14.7715],

    // Culture & Music
    'Växjö Konserthus': [56.8778, 14.8089],
    'Vaxjo Konserthus': [56.8778, 14.8089],
    'växjö konserthus': [56.8778, 14.8089],
    'Konserthuset': [56.8778, 14.8089],

    'Nygatan 6': [56.8796, 14.8061],
    'nygatan 6': [56.8796, 14.8061],

    'Växjö Teater': [56.8789, 14.8067],
    'Vaxjo Teater': [56.8789, 14.8067],
    'växjö teater': [56.8789, 14.8067],

    'Kulturhuset Prisma': [56.8783, 14.8050],

    // University & Campus
    'Linnéuniversitetet': [56.8558, 14.8305],
    'Linneuniversitetet': [56.8558, 14.8305],
    'Linnéuniversitetet, Växjö': [56.8558, 14.8305],
    'LNU Campus Växjö': [56.8558, 14.8305],
    'Campushallen': [56.8545, 14.8320],
    'Linnékåren': [56.8552, 14.8298],

    // Parks & Outdoor
    'Stadsparken': [56.8780, 14.8020],
    'Linnéparken': [56.8810, 14.8110],
    'Växjösjön': [56.8750, 14.8050],
    'Evedals badplats': [56.8600, 14.8500],
    'Kronobergsruinen': [56.8820, 14.8400],

    // Restaurants & Cafés
    'Stortorget': [56.8796, 14.8094],
    'PM & Vänner': [56.8791, 14.8078],
    'Bishops Arms Växjö': [56.8793, 14.8085],
    'Kafé de Luxe': [56.8800, 14.8060],
    'Res Thai': [56.8798, 14.8072],

    // Shopping & Markets
    'Grand Samarkand': [56.8900, 14.7950],
    'Samarkand': [56.8900, 14.7950],

    // Community & Misc
    'Växjö Bibliotek': [56.8785, 14.8055],
    'Folkets Park': [56.8830, 14.8030],
    'Myresjöhus Arena': [56.8767, 14.7758],
    'Visma Arena': [56.8767, 14.7758],

    // Default fallback (Växjö centrum – Stortorget)
    'DEFAULT': [56.8796, 14.8094]
};

/**
 * Get coordinates for a venue name
 * Returns coordinates if found in lookup table, otherwise returns null 
 * (so geocoder can try instead)
 */
export function getVenueCoordinates(venueName: string): [number, number] | null {
    if (!venueName) return null;

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

    // Return null instead of default so we know it failed
    return null;
}

/**
 * Perform a geocoding request to OpenStreetMap Nominatim API
 * Adds delay to respect API rate limits (max 1 req/sec)
 */
export async function geocodeVenue(venueName: string): Promise<[number, number] | null> {
    if (!venueName) return null;

    // Check local hardcoded list first
    const localCoords = getVenueCoordinates(venueName);
    if (localCoords) {
        return localCoords;
    }

    // Prepare search query. Strip out common words that confuse the geocoder, and append " Växjö"
    let query = venueName.toLowerCase();

    // Some basic cleanup for better geocoding results
    query = query.replace(/(kulturhuset|biograf|restaurang|café|cafe|\d+)/g, '').trim();

    const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}, Växjö&format=json&limit=1`;

    try {
        console.log(`[Geocoding] Querying API for: "${venueName}"`);
        // Nominatim requires a User-Agent
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)'
            }
        });

        if (!response.ok) {
            console.warn(`[Geocoding] API responded with status: ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            console.log(`[Geocoding] Success for "${venueName}": [${lat}, ${lng}]`);

            // Respect rate limit: pause for 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));

            return [lat, lng];
        }

        console.log(`[Geocoding] No results found for "${venueName}". Falling back to default.`);
    } catch (error) {
        console.error(`[Geocoding] Error resolving "${venueName}":`, error);
    }

    // Wait a little before returning to avoid bursting API if many fail sequentially
    await new Promise(resolve => setTimeout(resolve, 500));
    return null;
}
