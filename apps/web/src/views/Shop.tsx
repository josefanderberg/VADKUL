'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Lock, Check, Clock, Sparkles,
    Cloud, Wind, Target, Mountain, CalendarPlus, Users, Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import RedeemCodeModal from '../components/profile/RedeemCodeModal';
import Toggle from '../components/ui/Toggle';
import { useAuth } from '../context/AuthContext';
import { useFeatureToggles } from '../hooks/useFeatureToggles';
import { userService } from '../services/userService';
import { waitlistService } from '../services/waitlistService';
import { FEATURE_CATALOG, FEATURE_GROUPS, type FeatureDef } from '../lib/featureToggles';
import type { UserProfile } from '../types';

// lucide-ikoner per katalog-namn
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Cloud, Wind, Target, Sparkles, Mountain, CalendarPlus, Users, Bell,
};

export default function Shop() {
    const router = useRouter();
    const { user } = useAuth();
    const { isOn, setToggle } = useFeatureToggles();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [redeemOpen, setRedeemOpen] = useState(false);
    const [joined, setJoined] = useState<Record<string, boolean>>({});
    const [joining, setJoining] = useState<string | null>(null);

    const isPremium = !!profile?.isVerified || (profile?.redeemedCodes?.length ?? 0) > 0;

    useEffect(() => {
        // init kö-status från localStorage
        const j: Record<string, boolean> = {};
        for (const f of FEATURE_CATALOG) if (f.tier === 'soon') j[f.id] = waitlistService.hasJoined(f.id);
        setJoined(j);
    }, []);

    useEffect(() => {
        if (!user) return;
        userService.getUserProfile(user.uid).then(setProfile).catch(() => { /* ignore */ });
    }, [user]);

    const refreshProfile = () => {
        if (user) userService.getUserProfile(user.uid).then(setProfile).catch(() => {});
    };

    const handleJoin = async (f: FeatureDef) => {
        setJoining(f.id);
        try {
            await waitlistService.join(f.id, { uid: user?.uid ?? null, email: user?.email ?? null });
            setJoined((s) => ({ ...s, [f.id]: true }));
            toast.success('Du står i kö! Vi hör av oss när den är klar.');
        } catch {
            toast.error('Kunde inte ställa dig i kö, försök igen.');
        } finally {
            setJoining(null);
        }
    };

    const Icon = (name?: string) => (name && ICONS[name]) || Sparkles;

    return (
        <Layout>
            <div className="max-w-xl mx-auto p-4 pb-24">
                {/* Header */}
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-slate-500"
                        aria-label="Tillbaka"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Funktioner & Shop</h1>
                </div>
                <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6 ml-1">
                    Slå på det du gillar, stäng av det du inte vill ha, och lås upp extra.
                </p>

                {FEATURE_GROUPS.map((group) => {
                    const features = FEATURE_CATALOG.filter((f) => f.group === group.id);
                    if (features.length === 0) return null;

                    return (
                        <section key={group.id} className="mb-8">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">{group.title}</h2>
                            <p className="text-xs text-slate-400 dark:text-neutral-500 mb-3">{group.subtitle}</p>

                            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-slate-100 dark:border-neutral-800 divide-y divide-slate-100 dark:divide-neutral-800 overflow-hidden">
                                {features.map((f) => {
                                    const IconCmp = Icon(f.icon);
                                    return (
                                        <div key={f.id} className="flex items-center gap-3 p-4">
                                            <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-600 dark:text-neutral-300">
                                                <IconCmp size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">{f.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-neutral-400">{f.description}</p>
                                            </div>

                                            {/* Kontroll beroende på tier */}
                                            {f.tier === 'free' && (
                                                <Toggle
                                                    checked={isOn(f.id)}
                                                    onChange={(v) => setToggle(f.id, v)}
                                                    aria-label={f.name}
                                                />
                                            )}

                                            {f.tier === 'premium' && (
                                                isPremium ? (
                                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 shrink-0">
                                                        <Check size={14} /> Upplåst
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => setRedeemOpen(true)}
                                                        className="shrink-0 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-full transition-colors"
                                                    >
                                                        <Lock size={13} /> Lås upp
                                                    </button>
                                                )
                                            )}

                                            {f.tier === 'soon' && (
                                                joined[f.id] ? (
                                                    <span className="flex items-center gap-1 text-xs font-bold text-slate-400 shrink-0">
                                                        <Check size={14} /> I kö
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleJoin(f)}
                                                        disabled={joining === f.id}
                                                        className="shrink-0 flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 text-xs font-bold px-3 py-2 rounded-full transition-colors disabled:opacity-50"
                                                    >
                                                        <Clock size={13} /> Ställ dig i kö
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Premium-grupp: köp-stub + kod-info */}
                            {group.id === 'premium' && !isPremium && (
                                <div className="mt-3 flex items-center justify-between gap-2 px-1">
                                    <p className="text-xs text-slate-400">Har du en kod? Lås upp ovan. Köp med Swish kommer snart.</p>
                                    <button
                                        onClick={() => toast('Köp kommer snart – använd en kod så länge.', { icon: '🛒' })}
                                        className="shrink-0 text-xs font-bold text-indigo-600 hover:underline"
                                    >
                                        Köp (snart)
                                    </button>
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>

            <RedeemCodeModal
                isOpen={redeemOpen}
                onClose={() => setRedeemOpen(false)}
                onSuccess={refreshProfile}
            />
        </Layout>
    );
}
