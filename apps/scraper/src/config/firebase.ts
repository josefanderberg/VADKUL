import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * DB-target switch så vi inte bränner Firebase-läsningar under utveckling.
 *
 *   DB_TARGET=1  →  PROD Firebase (default)               — service-account.json
 *   DB_TARGET=2  →  LOKAL emulator (port 8080)            — "dev"-data
 *   DB_TARGET=3  →  TEST emulator (port 8081)             — "test"-data
 *
 * Starta emulatorn först (separat terminal):
 *   npm run emulator:dev      # för target 2
 *   npm run emulator:test     # för target 3
 *
 * Kör sedan vilket script som helst med target:
 *   DB_TARGET=3 npm run scrape-fb
 *   DB_TARGET=2 npm run dashboard
 */

type DbTargetKey = '1' | '2' | '3';

interface DbTargetInfo {
    key: DbTargetKey;
    name: string;
    emulatorHost?: string;
    projectId?: string;
}

const TARGETS: Record<DbTargetKey, DbTargetInfo> = {
    '1': { key: '1', name: 'PROD Firebase' },
    '2': { key: '2', name: 'LOKAL emulator :8080', emulatorHost: 'localhost:8080', projectId: 'demo-vadkul-local' },
    '3': { key: '3', name: 'TEST emulator :8081', emulatorHost: 'localhost:8081', projectId: 'demo-vadkul-test' },
};

const rawTarget = (process.env.DB_TARGET || '1').trim();
const target = TARGETS[rawTarget as DbTargetKey];
if (!target) {
    throw new Error(`Okänd DB_TARGET="${rawTarget}". Använd 1 (prod), 2 (lokal), eller 3 (test).`);
}

// Tydligt banner — så man aldrig råkar skriva till fel DB.
const banner = `🗄️  DB_TARGET=${target.key} → ${target.name}`;
const line = '═'.repeat(Math.max(banner.length + 4, 60));
console.log(`\n${line}\n  ${banner}\n${line}\n`);

if (target.emulatorHost) {
    // FIRESTORE_EMULATOR_HOST MÅSTE vara satt INNAN admin.initializeApp().
    process.env.FIRESTORE_EMULATOR_HOST = target.emulatorHost;
    if (!admin.apps.length) {
        admin.initializeApp({ projectId: target.projectId });
    }
} else {
    // Prod: ladda service-account.
    const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
    try {
        const serviceAccount = require(serviceAccountPath);
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
    } catch (error) {
        console.warn('⚠️ WARNING: service-account.json not found or invalid.');
        console.warn('Please add it to the root of the vadkul-scraper project to interact with Firebase.');
    }
}

const db = admin.apps.length ? admin.firestore() : null;
const storage = admin.apps.length ? admin.storage() : null;
const STORAGE_BUCKET = 'vadkul-f2cb2.firebasestorage.app';
const bucket = storage ? storage.bucket(STORAGE_BUCKET) : null;

export { admin, db, storage, bucket, STORAGE_BUCKET };
export const dbTarget = target;
