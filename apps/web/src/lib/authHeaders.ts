/**
 * authHeaders.ts — klient-hjälp för att autentisera anrop till admin-API:er.
 *
 * Hämtar den inloggade användarens Firebase ID-token och bygger en
 * Authorization-header. Server-side verifierar token + users/{uid}.isAdmin
 * (se requireAdmin i firestore-admin.ts).
 */

import { auth } from './firebase';

/** Returnerar { Authorization: 'Bearer <token>' } eller {} om ingen är inloggad. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
    const user = auth?.currentUser;
    if (!user) return {};
    try {
        const token = await user.getIdToken();
        return { Authorization: `Bearer ${token}` };
    } catch {
        return {};
    }
}
