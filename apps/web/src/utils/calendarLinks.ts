import type { LinkEvent } from '../types';

/**
 * Kalenderexport för eventkortet: Google Calendar-länk + .ics-fil (Apple/
 * Outlook). Event utan riktigt klockslag (hasSpecificTime=false) blir
 * heldagshändelser; övriga får 2 h default-längd (sluttid saknas i datan).
 */

const DEFAULT_EVENT_HOURS = 2;

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC-format för tidsatta händelser: 20260613T180000Z */
function toUtcStamp(d: Date): string {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

/** Lokalt datumformat för heldagshändelser: 20260613 */
function toDateStamp(d: Date): string {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function eventWindow(evt: LinkEvent): { start: Date; end: Date; allDay: boolean } {
    const allDay = evt.hasSpecificTime === false;
    const start = evt.time;
    const end = new Date(start.getTime() + (allDay ? 24 : DEFAULT_EVENT_HOURS) * 60 * 60 * 1000);
    return { start, end, allDay };
}

function shareUrl(evt: LinkEvent): string {
    return `${window.location.origin}/?event=${encodeURIComponent(evt.id)}`;
}

function description(evt: LinkEvent): string {
    const parts = [evt.description?.slice(0, 500), evt.url, `Hittat via VADKUL: ${shareUrl(evt)}`];
    return parts.filter(Boolean).join('\n\n');
}

export function googleCalendarUrl(evt: LinkEvent): string {
    const { start, end, allDay } = eventWindow(evt);
    const dates = allDay
        ? `${toDateStamp(start)}/${toDateStamp(end)}`
        : `${toUtcStamp(start)}/${toUtcStamp(end)}`;
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: evt.title,
        dates,
        details: description(evt),
        location: [evt.locationName, evt.extractedAddress].filter(Boolean).join(', '),
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escapa enligt RFC 5545 (kommatecken, semikolon, radbrytningar). */
function icsEscape(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function downloadIcs(evt: LinkEvent): void {
    const { start, end, allDay } = eventWindow(evt);
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//VADKUL//vadkul.se//SV',
        'BEGIN:VEVENT',
        `UID:${evt.id.replace(/[^a-zA-Z0-9._-]/g, '')}@vadkul.se`,
        `DTSTAMP:${toUtcStamp(new Date())}`,
        allDay ? `DTSTART;VALUE=DATE:${toDateStamp(start)}` : `DTSTART:${toUtcStamp(start)}`,
        allDay ? `DTEND;VALUE=DATE:${toDateStamp(end)}` : `DTEND:${toUtcStamp(end)}`,
        `SUMMARY:${icsEscape(evt.title)}`,
        evt.locationName ? `LOCATION:${icsEscape([evt.locationName, evt.extractedAddress].filter(Boolean).join(', '))}` : '',
        `DESCRIPTION:${icsEscape(description(evt))}`,
        evt.url ? `URL:${evt.url}` : '',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${evt.title.slice(0, 60).replace(/[\\/:*?"<>|]/g, '')}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
