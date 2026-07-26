/**
 * firestore-admin.ts
 *
 * Server-side Firebase Admin SDK för Next.js API-routes.
 *
 * Miljöer:
 *   - Firebase App Hosting (prod) → Application Default Credentials (ADC) automatiskt
 *   - Lokal dev                   → service-account.json från scraper-mappen
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

let _db: Firestore | null = null;

/** Initiera Admin-appen en gång (ADC i prod, service-account lokalt). */
function ensureAdminApp(): boolean {
    // Kolla efter DEFAULT-appen specifikt: i prod skapar firebase-frameworks
    // (Hosting-wrappern) en NAMNGIVEN admin-app ('firebase-frameworks') vid
    // uppstart. Ett `getApps().length > 0` hoppade då över init av
    // default-appen → getFirestore() kastade → naken 500 på alla admin-routes.
    if (getApps().some(a => a.name === '[DEFAULT]')) return true;

    try {
        // Lokal dev: leta efter service-account.json i scraper-mappen
        const candidates = [
            path.resolve(process.cwd(), '../scraper/service-account.json'),
            path.resolve(process.cwd(), 'apps/scraper/service-account.json'),
        ];

        for (const p of candidates) {
            if (fs.existsSync(p)) {
                // fs + JSON.parse i st.f. require(): webpack skriver om dynamiska
                // require-anrop så de kraschar i runtime i Next-bundlad kod.
                initializeApp({ credential: cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
                return true;
            }
        }

        // Firebase App Hosting / Cloud Run: använd ADC
        initializeApp();
        return true;
    } catch (e) {
        console.error('[firestore-admin] Init error:', e);
        return false;
    }
}

export function getAdminDb(): Firestore | null {
    if (_db) return _db;
    if (!ensureAdminApp()) return null;
    // try/catch: ett kast här bubblar annars ut UR anropande routes utan egen
    // vakt → naken 500. null → routes svarar 503 och klienter tar reservvägen.
    try {
        _db = getFirestore();
    } catch (e) {
        console.error('[firestore-admin] getFirestore:', e);
        return null;
    }
    return _db;
}

export function getAdminAuth(): Auth | null {
    if (!ensureAdminApp()) return null;
    try {
        return getAuth();
    } catch (e) {
        console.error('[firestore-admin] getAuth:', e);
        return null;
    }
}

/**
 * Vakt för admin-routes. Verifierar Firebase ID-token från
 * `Authorization: Bearer <token>` och kollar att användaren har
 * `users/{uid}.isAdmin == true` i Firestore.
 *
 * @returns `null` om anroparen är admin (fortsätt), annars en `NextResponse`
 *          (401/403/503) som routen ska returnera direkt.
 */
export async function requireAdmin(request: Request): Promise<NextResponse | null> {
    const auth = getAdminAuth();
    const db = getAdminDb();
    if (!auth || !db) {
        return NextResponse.json({ error: 'Auth unavailable' }, { status: 503 });
    }

    const header = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized: missing bearer token' }, { status: 401 });
    }

    let uid: string;
    let email = '';
    try {
        const decoded = await auth.verifyIdToken(token);
        uid = decoded.uid;
        email = decoded.email ?? '';
    } catch {
        return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 });
    }

    // Samma dubbla väg som firestore.rules isAdmin(): ägar-kontot admin@admin.com
    // kortsluter (behöver aldrig isAdmin-fältet), övriga admins via users-fältet.
    if (email === 'admin@admin.com') return null;

    try {
        const userSnap = await db.collection('users').doc(uid).get();
        if (!userSnap.exists || userSnap.data()?.isAdmin !== true) {
            return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
        }
    } catch (e) {
        console.error('[requireAdmin] isAdmin lookup failed:', e);
        return NextResponse.json({ error: 'Auth check failed' }, { status: 503 });
    }

    return null; // authorized
}
