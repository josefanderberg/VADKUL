import type { LinkEvent } from '../types';
import { getVenueCoordinates } from './venueCoordinates';

// JSON format from external sources (e.g. event calendars)
export interface ExternalEventJSON {
    date: string;        // "2026-02-18"
    time: string;        // "18:00"
    event: string;       // event title
    venue: string;       // venue name
    address?: string;    // full address (optional)
    organizer: string;   // who hosts it
    website: string;     // external URL
    maps_url?: string;   // Google Maps URL (optional)
}

export interface EventImportData {
    city?: string;
    timeframe?: string;
    events: ExternalEventJSON[];
}

/**
 * Generate a unique key for an event to detect duplicates
 */
export function generateEventKey(event: {
    title: string;
    date: string;
    time: string;
    venue: string;
}): string {
    const title = (event.title || '').trim();
    const venue = (event.venue || '').trim();
    return `${title}-${event.date}-${event.time}-${venue}`;
}

/**
 * Parse and validate JSON import data
 * Accepts both English and Swedish field names
 */
export function parseImportJSON(jsonString: string): EventImportData {
    try {
        const data = JSON.parse(jsonString);

        // Support both English and Swedish field names
        const events = data.events || data.evenemang;

        if (!events || !Array.isArray(events)) {
            throw new Error('JSON must contain an "events" or "evenemang" array');
        }

        return {
            city: data.city || data.stad,
            timeframe: data.timeframe || data.period,
            events: events
        } as EventImportData;
    } catch (error: any) {
        throw new Error(`Invalid JSON: ${error.message}`);
    }
}

/**
 * Map external JSON event to LinkEvent format
 * Supports both Swedish and English field names
 */
export function mapToLinkEvent(externalEvent: any): Omit<LinkEvent, 'id' | 'createdAt'> | null {
    try {
        // Extract fields - support both Swedish and English
        const eventTitle = externalEvent.event || externalEvent.evenemang;
        const eventDate = externalEvent.date || externalEvent.datum;
        const eventTime = externalEvent.time || externalEvent.tid;
        const eventVenue = externalEvent.venue || externalEvent.plats;
        const eventOrganizer = externalEvent.organizer || externalEvent.arrangor;
        const eventWebsite = externalEvent.website || externalEvent.webbplats;

        // Validate required fields
        if (!eventTitle || !eventDate || !eventTime || !eventVenue || !eventOrganizer || !eventWebsite) {
            console.warn('Skipping event with missing required fields:', externalEvent);
            return null;
        }

        // Parse date and time
        const dateTime = new Date(`${eventDate}T${eventTime}`);
        if (isNaN(dateTime.getTime())) {
            console.warn('Invalid date/time format:', externalEvent);
            return null;
        }

        // Get coordinates from venue name
        const [lat, lng] = getVenueCoordinates(eventVenue);

        return {
            title: eventTitle,
            url: eventWebsite,
            time: dateTime,
            locationName: eventVenue,
            lat,
            lng,
            hostName: eventOrganizer
        };
    } catch (error) {
        console.error('Error mapping event:', error, externalEvent);
        return null;
    }
}

/**
 * Compare events and determine what to add, remove, and keep
 */
export interface SyncComparison {
    toAdd: Omit<LinkEvent, 'id' | 'createdAt'>[];
    toRemove: LinkEvent[];
    toKeep: LinkEvent[];
}

export function compareEvents(
    existingEvents: LinkEvent[],
    newEvents: Omit<LinkEvent, 'id' | 'createdAt'>[]
): SyncComparison {
    // Create maps with unique keys
    const existingMap = new Map<string, LinkEvent>();
    existingEvents.forEach(event => {
        // Skip events with missing required data
        if (!event.title || !event.time || !event.locationName) {
            console.warn('Skipping existing event with missing data:', event);
            return;
        }

        const key = generateEventKey({
            title: event.title,
            date: event.time.toISOString().split('T')[0],
            time: event.time.toTimeString().substring(0, 5),
            venue: event.locationName
        });
        existingMap.set(key, event);
    });

    const newMap = new Map<string, Omit<LinkEvent, 'id' | 'createdAt'>>();
    newEvents.forEach(event => {
        // Skip events with missing required data
        if (!event.title || !event.time || !event.locationName) {
            console.warn('Skipping new event with missing data:', event);
            return;
        }

        const key = generateEventKey({
            title: event.title,
            date: event.time.toISOString().split('T')[0],
            time: event.time.toTimeString().substring(0, 5),
            venue: event.locationName
        });
        newMap.set(key, event);
    });

    const toAdd: Omit<LinkEvent, 'id' | 'createdAt'>[] = [];
    const toRemove: LinkEvent[] = [];
    const toKeep: LinkEvent[] = [];

    // Find events to add (in new but not in existing)
    newMap.forEach((event, key) => {
        if (!existingMap.has(key)) {
            toAdd.push(event);
        }
    });

    // Find events to remove or keep
    existingMap.forEach((event, key) => {
        if (newMap.has(key)) {
            toKeep.push(event);
        } else {
            toRemove.push(event);
        }
    });

    return { toAdd, toRemove, toKeep };
}
