#!/usr/bin/env ts-node
/**
 * VADKUL CLI: Skapa event direkt från terminalen
 * 
 * Kör med:
 *   npx ts-node src/scripts/create-event.ts
 */

import * as readline from 'readline';
import { db } from '../config/firebase';
import { geocodeVenue, getVenueCoordinates, VAXJO_VENUES } from '../utils/venueCoordinates';
import { geohashForLocation } from 'geofire-common';
import { Timestamp } from 'firebase-admin/firestore';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question: string): Promise<string> {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer.trim()));
    });
}

function askWithDefault(question: string, defaultValue: string): Promise<string> {
    return new Promise(resolve => {
        rl.question(`${question} [${defaultValue}]: `, answer => {
            resolve(answer.trim() || defaultValue);
        });
    });
}

function header(title: string) {
    const line = '─'.repeat(title.length + 4);
    console.log(`\n┌${line}┐`);
    console.log(`│  ${title}  │`);
    console.log(`└${line}┘\n`);
}

const CATEGORIES = [
    'party', 'music', 'sport', 'game', 'culture',
    'food', 'market', 'outdoor', 'play', 'training',
    'study', 'campus', 'other'
];

const CATEGORY_EMOJIS: Record<string, string> = {
    party: '🎉', music: '🎵', sport: '⚽', game: '🎮', culture: '🎭',
    food: '🍕', market: '🏪', outdoor: '🌲', play: '🧸', training: '💪',
    study: '📚', campus: '🎓', other: '📅'
};

async function parseDateTime(dateStr: string, timeStr: string): Promise<{ date: Date; hasSpecificTime: boolean }> {
    // Parse date formats: YYYY-MM-DD, DD/MM/YYYY, "idag", "imorgon"
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let date: Date;
    const lower = dateStr.toLowerCase();

    if (lower === 'idag' || lower === 'today') {
        date = new Date(today);
    } else if (lower === 'imorgon' || lower === 'tomorrow') {
        date = new Date(today);
        date.setDate(date.getDate() + 1);
    } else {
        // Try YYYY-MM-DD
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const swMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);

        if (isoMatch) {
            date = new Date(`${dateStr}T00:00:00`);
        } else if (swMatch) {
            const day = parseInt(swMatch[1]);
            const month = parseInt(swMatch[2]) - 1;
            const year = swMatch[3] ? (swMatch[3].length === 2 ? 2000 + parseInt(swMatch[3]) : parseInt(swMatch[3])) : today.getFullYear();
            date = new Date(year, month, day, 0, 0, 0);
        } else {
            throw new Error(`Kunde inte tolka datumet: "${dateStr}". Försök med YYYY-MM-DD, DD/MM eller "idag".`);
        }
    }

    // Parse time
    let hasSpecificTime = false;
    if (timeStr && timeStr !== '-' && timeStr !== '') {
        const timeMatch = timeStr.match(/^(\d{1,2})[:\.](\d{2})$/);
        if (timeMatch) {
            date.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
            hasSpecificTime = true;
        } else {
            throw new Error(`Kunde inte tolka tiden: "${timeStr}". Försök med HH:MM.`);
        }
    }

    return { date, hasSpecificTime };
}

async function main() {
    header('VADKUL EVENT SKAPARE');
    console.log('Skapa ett nytt event direkt i Firestore.\n');

    if (!db) {
        console.error('❌ Firebase är inte initialiserat. Kontrollera att serviceAccountKey.json finns.');
        process.exit(1);
    }

    try {
        // --- TITEL ---
        const title = await ask('📌 Titel på eventet: ');
        if (!title) { console.error('❌ Titel krävs.'); process.exit(1); }

        // --- DATUM ---
        console.log('\n   Format: YYYY-MM-DD, DD/MM, "idag" eller "imorgon"');
        const dateStr = await ask('📅 Datum: ');

        // --- TID ---
        const timeStr = await ask('⏰ Starttid (HH:MM, eller lämna tomt): ');

        let eventDate: Date;
        let hasSpecificTime: boolean;
        try {
            const parsed = await parseDateTime(dateStr, timeStr);
            eventDate = parsed.date;
            hasSpecificTime = parsed.hasSpecificTime;
        } catch (e: any) {
            console.error(`❌ ${e.message}`);
            process.exit(1);
        }

        // --- PLATS ---
        console.log('\n   Kända platser (tryck Enter för att se alla):');
        const knownVenues = Object.keys(VAXJO_VENUES).filter(k => k !== 'DEFAULT').slice(0, 15);
        console.log('   ' + knownVenues.join(', ') + '...\n');
        const locationName = await askWithDefault('📍 Plats/lokal', 'Växjö');

        // --- KOORDINATER ---
        console.log('\n   Löser koordinater...');
        let lat: number;
        let lng: number;

        const localCoords = getVenueCoordinates(locationName);
        if (localCoords) {
            lat = localCoords[0];
            lng = localCoords[1];
            console.log(`   ✅ Hittade i lokal databas: [${lat}, ${lng}]`);
        } else {
            const geocoded = await geocodeVenue(locationName);
            if (geocoded) {
                lat = geocoded[0];
                lng = geocoded[1];
                console.log(`   ✅ Geocodad via OSM: [${lat}, ${lng}]`);
            } else {
                lat = 56.8796;
                lng = 14.8094;
                console.log(`   ⚠️  Kunde inte hitta platsen, använder Växjö centrum.`);
            }
        }

        // --- KATEGORI ---
        console.log('\n   Tillgängliga kategorier:');
        CATEGORIES.forEach((cat, i) => {
            console.log(`   ${String(i + 1).padStart(2)}. ${CATEGORY_EMOJIS[cat]} ${cat}`);
        });
        const catInput = await askWithDefault('\n🏷️  Kategori (namn eller nummer)', 'other');
        let category: string;
        const catNum = parseInt(catInput);
        if (!isNaN(catNum) && catNum >= 1 && catNum <= CATEGORIES.length) {
            category = CATEGORIES[catNum - 1];
        } else if (CATEGORIES.includes(catInput)) {
            category = catInput;
        } else {
            category = 'other';
            console.log(`   ⚠️  Okänd kategori, använder "other".`);
        }

        // --- BESKRIVNING ---
        const description = await ask('\n📝 Beskrivning (valfritt): ');

        // --- PRIS ---
        const priceStr = await askWithDefault('💰 Pris', 'Gratis');
        const price = priceStr.toLowerCase() === 'gratis' || priceStr === '0' ? 'Gratis' : (parseInt(priceStr) || 0);

        // --- ARRANGÖR ---
        const hostName = await askWithDefault('👤 Arrangör/Värd', 'VADKUL');

        // --- URL ---
        const url = await ask('🔗 Länk (valfritt): ');

        // --- MAX DELTAGARE ---
        const maxStr = await askWithDefault('👥 Max deltagare', '50');
        const maxParticipants = parseInt(maxStr) || 50;

        // --- BEKRÄFTELSE ---
        header('FÖRHANDSVISNING');
        console.log(`  ${CATEGORY_EMOJIS[category]} ${title}`);
        console.log(`  📅 ${eventDate.toLocaleDateString('sv-SE')}${hasSpecificTime ? ' kl ' + eventDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : ''}`);
        console.log(`  📍 ${locationName} [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
        console.log(`  🏷️  ${category}`);
        console.log(`  💰 ${price}`);
        console.log(`  👤 ${hostName}`);
        if (description) console.log(`  📝 ${description}`);
        if (url) console.log(`  🔗 ${url}`);
        console.log(`  👥 Max ${maxParticipants} deltagare`);

        const confirm = await ask('\n✅ Spara eventet? (j/n): ');
        if (confirm.toLowerCase() !== 'j' && confirm.toLowerCase() !== 'y') {
            console.log('\n❌ Avbrutet. Eventet sparades inte.');
            rl.close();
            process.exit(0);
        }

        // --- SPARA TILL FIRESTORE ---
        const geohash = geohashForLocation([lat, lng]);
        const eventData = {
            title,
            description: description || '',
            time: Timestamp.fromDate(eventDate),
            hasSpecificTime,
            location: { name: locationName },
            locationName,
            lat,
            lng,
            geohash,
            category,
            type: category,
            price,
            maxParticipants,
            minParticipants: 1,
            attendees: [],
            host: {
                uid: 'cli-bot',
                name: hostName,
                initials: hostName.slice(0, 2).toUpperCase(),
                photoURL: null,
                verified: false,
            },
            url: url || '',
            hostName,
            visibility: 'public',
            requiresApproval: false,
            views: 0,
            createdAt: Timestamp.now(),
            ageCategory: 'all',
            minAge: 0,
            maxAge: 100,
        };

        await db.collection('events').add(eventData);

        console.log('\n\n🎉 Eventet sparades!\n');
        console.log(`   ${CATEGORY_EMOJIS[category]} "${title}" skapades och är nu live i VADKUL.`);

    } catch (err) {
        console.error('\n❌ Något gick fel:', err);
    } finally {
        rl.close();
    }
}

main();
