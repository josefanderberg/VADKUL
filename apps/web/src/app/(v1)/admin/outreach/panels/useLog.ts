'use client';

// Delad logg-hämtning för Logg- och Statistik-flikarna:
// GET /api/admin/outreach/log med Bearer-token, en gång per montering.
// Panelerna monteras bara när fliken är aktiv, så ingen onödig hämtning.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { LogListResponse, OutreachLogEntry } from '@/types/outreach';

export function useLog(): {
    entries: OutreachLogEntry[] | null;
    error: string | null;
    busy: boolean;
    reload: () => void;
} {
    const { user } = useAuth();
    const [entries, setEntries] = useState<OutreachLogEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const reload = useCallback(async () => {
        if (!user) return;
        setBusy(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/outreach/log', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                setError(`Kunde inte hämta loggen (${res.status}).`);
                return;
            }
            const json = await res.json() as LogListResponse;
            setEntries(json.entries);
        } catch {
            setError('Nätverksfel — försök igen.');
        } finally {
            setBusy(false);
        }
    }, [user]);

    useEffect(() => { reload(); }, [reload]);

    return { entries, error, busy, reload };
}
