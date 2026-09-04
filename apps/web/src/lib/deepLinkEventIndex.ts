// Ren indexbyggare för /api/event?id= — slår ihop de tre aggregat-lagren till
// ETT uppslag per event-id med precis de fält eventkortet behöver. Ingen
// Firestore här (testbart); routen läser lagren och cachar det färdiga
// indexet per updatedAt.

export type DeepLinkEvent = {
    id: string;
    title: string;
    /** ISO-sträng, som i destinations-lagret. */
    time: string;
    endDate?: string;
    hasSpecificTime?: boolean;
    lat: number;
    lng: number;
    locationName: string;
    category: string;
    hostName?: string;
    coverImage?: string;
    price?: string | number;
    attendees?: number;
    isLocationVerified?: boolean;
    isHostVerified?: boolean;
    /** Kortets utlänk (cards-lagret) — saknas den är id:t självt url:en. */
    url?: string;
    /** HELA beskrivningen (descriptions-lagret) — det här är fältet som gör
     *  endpointen värd att finnas: klienten slipper 14 MB för en text. */
    description?: string;
};

/** Bildvakt (delas med stadssidorna via cityData): skrapade kort bär
 *  data:-platshållare och rotrelativa /images-sökvägar som 404:ar hos oss —
 *  bara absoluta http(s)-adresser släpps vidare till kortet.
 *  Dessutom repareras PORT-MISMATCHEN från bibliotekens Axiell-sajter:
 *  ~4 100 bilder kom som "https://host:80/…" (skrapan har uppgraderat schemat
 *  utan att släppa porten). HTTPS mot port 80 kan aldrig ladda, så raderna
 *  sorterades som "har bild" men visades utan (Uppsala 1/9). Utan default-
 *  mismatchad port svarar värdarna 200 — släpp porten, behåll resten intakt. */
export function usableImageUrl(raw: unknown): string | undefined {
    if (typeof raw !== 'string' || !raw) return undefined;
    try {
        const u = new URL(raw);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
        if ((u.protocol === 'https:' && u.port === '80') || (u.protocol === 'http:' && u.port === '443')) {
            u.port = '';
            return u.toString();
        }
        return raw; // orörd sträng när inget behöver lagas (ingen omkodning)
    } catch {
        return undefined;
    }
}

export function buildDeepLinkEventIndex(
    destEvents: unknown[],
    cardEvents: unknown[],
    descriptions: Record<string, string>,
): Map<string, DeepLinkEvent> {
    const cards = new Map<string, Record<string, unknown>>();
    for (const c of cardEvents) {
        if (c && typeof c === 'object' && typeof (c as any).id === 'string') {
            cards.set((c as any).id, c as Record<string, unknown>);
        }
    }
    const index = new Map<string, DeepLinkEvent>();
    for (const raw of destEvents) {
        if (!raw || typeof raw !== 'object') continue;
        const e = raw as Record<string, unknown>;
        if (typeof e.id !== 'string' || !e.id) continue;
        if (typeof e.title !== 'string' || !e.title) continue;
        if (typeof e.time !== 'string' || !e.time) continue;
        const card = cards.get(e.id);
        const desc = descriptions[e.id];
        const coverImage = usableImageUrl(card?.coverImage);
        const event: DeepLinkEvent = {
            id: e.id,
            title: e.title,
            time: e.time,
            lat: typeof e.lat === 'number' && Number.isFinite(e.lat) ? e.lat : 0,
            lng: typeof e.lng === 'number' && Number.isFinite(e.lng) ? e.lng : 0,
            locationName: typeof e.locationName === 'string' ? e.locationName : '',
            category: typeof e.category === 'string' && e.category ? e.category : 'other',
        };
        // Valfria fält bara när de har innehåll — svaret ska vara litet.
        if (typeof e.endDate === 'string' && e.endDate) event.endDate = e.endDate;
        if (typeof e.hasSpecificTime === 'boolean') event.hasSpecificTime = e.hasSpecificTime;
        if (typeof card?.hostName === 'string' && card.hostName) event.hostName = card.hostName;
        if (coverImage) event.coverImage = coverImage;
        if (typeof card?.price === 'string' || typeof card?.price === 'number') {
            if (card.price !== '') event.price = card.price as string | number;
        }
        if (typeof card?.attendees === 'number' && card.attendees > 0) event.attendees = card.attendees;
        if (card?.isLocationVerified === true || e.isLocationVerified === true) event.isLocationVerified = true;
        if (card?.isHostVerified === true) event.isHostVerified = true;
        if (typeof card?.url === 'string' && card.url) event.url = card.url;
        if (typeof desc === 'string' && desc.trim()) event.description = desc;
        index.set(e.id, event);
    }
    return index;
}
