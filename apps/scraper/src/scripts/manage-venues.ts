#!/usr/bin/env ts-node
/**
 * manage-venues — administrera known_venues-tabellen i SQLite.
 *
 * Kommandon:
 *   list [--city <stad>]
 *   add <namn> <lat> <lng> [--city <stad>] [--notes <text>]
 *   update <namn> [--lat <lat>] [--lng <lng>] [--city <stad>] [--notes <text>]
 *   delete <namn>
 *   search <sökterm>
 *
 * Exempel:
 *   ts-node manage-venues.ts list
 *   ts-node manage-venues.ts list --city Kalmar
 *   ts-node manage-venues.ts add "Scandic Växjö" 56.8812 14.8071
 *   ts-node manage-venues.ts update "Scandic Växjö" --notes "hotell nära centrum"
 *   ts-node manage-venues.ts delete "Scandic Växjö"
 *   ts-node manage-venues.ts search konserthus
 */

import {
    upsertKnownVenue,
    deleteKnownVenue,
    getAllKnownVenues,
    listKnownVenues,
    countKnownVenues,
    KnownVenueRow,
} from '../utils/sqliteHelper';

// Trigger venue seeding by importing venueCoordinates
import '../utils/venueCoordinates';

function parseArgs(argv: string[]): { cmd: string; pos: string[]; flags: Record<string, string> } {
    const pos: string[] = [];
    const flags: Record<string, string> = {};
    let i = 0;
    while (i < argv.length) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);
            flags[key] = argv[i + 1] ?? '';
            i += 2;
        } else {
            pos.push(argv[i]);
            i++;
        }
    }
    return { cmd: pos[0] ?? 'list', pos: pos.slice(1), flags };
}

function printTable(rows: KnownVenueRow[]): void {
    if (rows.length === 0) {
        console.log('  (inga träffar)');
        return;
    }
    const namePad = Math.min(40, Math.max(20, ...rows.map(r => r.name.length)));
    const header =
        'ID'.padStart(4) + '  ' +
        'Namn'.padEnd(namePad) + '  ' +
        'Lat'.padStart(10) + '  ' +
        'Lng'.padStart(10) + '  ' +
        'Stad'.padEnd(12) + '  ' +
        'Noteringar';
    console.log('\n  ' + header);
    console.log('  ' + '─'.repeat(header.length));
    for (const r of rows) {
        console.log(
            '  ' +
            String(r.id).padStart(4) + '  ' +
            r.name.slice(0, namePad).padEnd(namePad) + '  ' +
            r.lat.toFixed(4).padStart(10) + '  ' +
            r.lng.toFixed(4).padStart(10) + '  ' +
            (r.city ?? '').padEnd(12) + '  ' +
            (r.notes ?? ''),
        );
    }
    console.log();
}

const args = parseArgs(process.argv.slice(2));

switch (args.cmd) {
    case 'list': {
        const city = args.flags['city'];
        const rows = listKnownVenues(city);
        const total = countKnownVenues();
        console.log(`\nKnown venues — ${rows.length}${city ? ` i ${city}` : ''} (totalt ${total})\n`);
        printTable(rows);
        break;
    }

    case 'add': {
        const [name, latStr, lngStr] = args.pos;
        if (!name || !latStr || !lngStr) {
            console.error('Användning: add <namn> <lat> <lng> [--city <stad>] [--notes <text>]');
            process.exit(1);
        }
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (isNaN(lat) || isNaN(lng)) {
            console.error('lat och lng måste vara tal.');
            process.exit(1);
        }
        upsertKnownVenue(name, lat, lng, args.flags['city'], args.flags['notes']);
        console.log(`✅ Lade till / uppdaterade "${name}" [${lat}, ${lng}]`);
        break;
    }

    case 'update': {
        const [name] = args.pos;
        if (!name) {
            console.error('Användning: update <namn> [--lat <lat>] [--lng <lng>] [--city <stad>] [--notes <text>]');
            process.exit(1);
        }
        const existing = getAllKnownVenues().find(v => v.name.toLowerCase() === name.toLowerCase());
        if (!existing) {
            console.error(`❌ Ingen venue med namnet "${name}" hittades.`);
            process.exit(1);
        }
        const lat = args.flags['lat'] !== undefined ? parseFloat(args.flags['lat']) : existing.lat;
        const lng = args.flags['lng'] !== undefined ? parseFloat(args.flags['lng']) : existing.lng;
        const city = args.flags['city'] !== undefined ? args.flags['city'] : (existing.city ?? undefined);
        const notes = args.flags['notes'] !== undefined ? args.flags['notes'] : (existing.notes ?? undefined);
        upsertKnownVenue(existing.name, lat, lng, city, notes);
        console.log(`✅ Uppdaterade "${existing.name}" → [${lat}, ${lng}], stad=${city ?? '-'}`);
        break;
    }

    case 'delete': {
        const [name] = args.pos;
        if (!name) {
            console.error('Användning: delete <namn>');
            process.exit(1);
        }
        const deleted = deleteKnownVenue(name);
        if (deleted) {
            console.log(`✅ Raderade "${name}"`);
        } else {
            // Try case-insensitive fallback
            const match = getAllKnownVenues().find(v => v.name.toLowerCase() === name.toLowerCase());
            if (match) {
                deleteKnownVenue(match.name);
                console.log(`✅ Raderade "${match.name}"`);
            } else {
                console.error(`❌ Ingen venue med namnet "${name}" hittades.`);
                process.exit(1);
            }
        }
        break;
    }

    case 'search': {
        const [query] = args.pos;
        if (!query) {
            console.error('Användning: search <sökterm>');
            process.exit(1);
        }
        const lower = query.toLowerCase();
        const rows = getAllKnownVenues().filter(
            v => v.name.toLowerCase().includes(lower) || (v.notes ?? '').toLowerCase().includes(lower),
        );
        console.log(`\nSökresultat för "${query}" — ${rows.length} träff(ar)\n`);
        printTable(rows);
        break;
    }

    default:
        console.log(`
manage-venues — administrera known_venues i SQLite

Kommandon:
  list [--city <stad>]
  add <namn> <lat> <lng> [--city <stad>] [--notes <text>]
  update <namn> [--lat <lat>] [--lng <lng>] [--city <stad>] [--notes <text>]
  delete <namn>
  search <sökterm>
`);
}
