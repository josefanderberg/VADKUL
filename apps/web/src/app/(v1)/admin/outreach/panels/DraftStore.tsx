'use client';

// Det delade utkastlagret för hela publiceringskonsolen (19/8) — svaret på
// "utkastet försvinner när jag byter flik". Genereringarna körs HÄR, i en
// provider som ligger över flikarna, inte i panelkomponenterna:
//
//   · en generering överlever flikbyten och fortsätter i bakgrunden,
//   · samma utkast syns överallt där gruppen förekommer (Idag/Städer/
//     Planering delar state via contactId),
//   · draft-routen sparar varje utkast i Firestore och GET läser tillbaka
//     de som är <48 h vid start — utkasten överlever alltså omladdningar,
//   · docken (DraftDock) listar allt som skriver/är klart oavsett flik.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export type DraftResponse = {
    drafts: { v1: string; v2Post: string; v2FirstComment: string };
    mentionedEvents: { title: string; day: string; place: string; emoji: string }[];
    angle: string;
    meta: {
        contactId: string; contactName: string;
        postingMode: 'approval' | 'direct' | 'unknown';
        linkTarget: string; weekCount: number; nearCount: number; radiusKm: number;
        dataUpdatedAt: string; source: 'live' | 'snapshot';
        generatedAt: number;
        // Vad genereringen drog — visas i utkast-rutan och summeras i API-kortet.
        usage?: { inputTokens: number; outputTokens: number; costUsd: number };
    };
};

export type DraftState =
    | { status: 'loading'; contactName: string; startedAt: number }
    | { status: 'done'; contactName: string; result: DraftResponse; generatedAt: number }
    | { status: 'error'; contactName: string; error: string };

interface DraftStoreValue {
    drafts: Record<string, DraftState>;
    generate: (contactId: string, contactName: string) => void;
}

const Ctx = createContext<DraftStoreValue | null>(null);

export function useDrafts(): DraftStoreValue {
    const v = useContext(Ctx);
    if (!v) throw new Error('useDrafts måste användas under <DraftProvider>');
    return v;
}

export function DraftProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
    // Dubbelklick-vakt utanför setState (som är asynkron).
    const inflight = useRef(new Set<string>());

    // Färska sparade utkast in vid start — fyller bara luckor, skriver aldrig
    // över något som redan genererats i den här sessionen.
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/admin/outreach/draft', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const json = await res.json() as {
                    drafts?: { contactId: string; contactName: string; payload: DraftResponse; generatedAt: number }[];
                };
                if (cancelled || !json.drafts?.length) return;
                setDrafts(prev => {
                    const next = { ...prev };
                    for (const d of json.drafts!) {
                        if (!next[d.contactId]) {
                            next[d.contactId] = {
                                status: 'done', contactName: d.contactName,
                                result: d.payload, generatedAt: d.generatedAt,
                            };
                        }
                    }
                    return next;
                });
            } catch { /* tyst — konsolen funkar utan förladdade utkast */ }
        })();
        return () => { cancelled = true; };
    }, [user]);

    const generate = useCallback((contactId: string, contactName: string) => {
        if (!user || inflight.current.has(contactId)) return;
        inflight.current.add(contactId);
        setDrafts(prev => ({
            ...prev,
            [contactId]: { status: 'loading', contactName, startedAt: Date.now() },
        }));
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/admin/outreach/draft', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contactId }),
                });
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                    setDrafts(prev => ({
                        ...prev,
                        [contactId]: {
                            status: 'error', contactName,
                            error: (json as { error?: string } | null)?.error ?? `Generering misslyckades (${res.status}).`,
                        },
                    }));
                    return;
                }
                const result = json as DraftResponse;
                setDrafts(prev => ({
                    ...prev,
                    [contactId]: {
                        status: 'done', contactName, result,
                        generatedAt: result.meta?.generatedAt ?? Date.now(),
                    },
                }));
            } catch {
                setDrafts(prev => ({
                    ...prev,
                    [contactId]: { status: 'error', contactName, error: 'Nätverksfel — försök igen.' },
                }));
            } finally {
                inflight.current.delete(contactId);
            }
        })();
    }, [user]);

    return <Ctx.Provider value={{ drafts, generate }}>{children}</Ctx.Provider>;
}
