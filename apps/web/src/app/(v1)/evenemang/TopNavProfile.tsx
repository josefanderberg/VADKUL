'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// Profilknappen i stadssidornas toppnav, till höger om kart-pillen (Josef
// 2/9: "så att man kan logga in eller skapa konto direkt på stadssidan
// också"). Samma modal och profilpanel som kartans navbar — inget nytt
// kontoflöde. Båda laddas först vid klick: stadssidorna är SEO-ytor och ska
// inte bära registreringsformuläret eller profilpanelen i förstabundlet.
//
// PORTAL-GOTCHA: naven har backdrop-blur, och ett backdrop-filter gör
// elementet till containing block för position:fixed-barn. Renderades
// modalen här inne blev dess "fixed inset-0" navens 57 px — rutan centrerades
// i den remsan och stack upp ovanför skärmkanten (Josef 2/9: "man ser inte
// något ovanför lösenordsinputen"). Därför portalas både modalen och
// profilpanelens ram till document.body. Ofarligt vid SSR: de renderas
// bara efter ett klick.
const AuthModal = dynamic(() => import('@/components/v2/AuthModal'), { ssr: false });
const ProfilePanel = dynamic(() => import('@/components/v2/ProfilePanel'), { ssr: false });

export default function TopNavProfile() {
    const { user } = useAuth();
    const router = useRouter();
    const [authOpen, setAuthOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    // user är null i server-HTML:n OCH i första klientrendern (AuthProvider
    // svarar först efter mount) — ikonen matchar alltså vid hydreringen.
    const loggedIn = !!user;

    return (
        <>
            <button
                type="button"
                onClick={() => (loggedIn ? setProfileOpen(o => !o) : setAuthOpen(true))}
                aria-label={loggedIn ? 'Min profil' : 'Logga in eller skapa konto'}
                title={loggedIn ? 'Min profil' : 'Logga in eller skapa konto'}
                className={`relative shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm text-slate-600 dark:text-zinc-300 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:text-[#006AA7] dark:hover:text-sky-400 transition-colors ${user?.photoURL ? 'overflow-hidden p-0' : ''}`}
            >
                {user?.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                    <User size={18} />
                )}
                {loggedIn && !user?.photoURL && (
                    <span aria-hidden className="absolute top-1 right-1 w-2 h-2 bg-[#006AA7] rounded-full border border-white dark:border-zinc-900" />
                )}
            </button>

            {authOpen && createPortal(
                <AuthModal
                    open
                    reason="Logga in eller skapa konto"
                    onClose={() => setAuthOpen(false)}
                />,
                document.body,
            )}

            {/* Profilpanelen positionerar sig absolut (top-[4.6rem]) — på kartan
                mot sidans relativa rot, här mot en fixed helskärms-ram (portalad
                till body, se filhuvudet) så den landar under den klistrade
                toppnaven. anchor="right": knappen
                sitter till höger, panelen ska falla ner under den. Utan
                eventlistan (stadssidan har ingen laddad) döljer panelen
                Sparade-raden och Mina event (props utelämnade) — hjärtan och
                egna event bor på kartan. */}
            {profileOpen && loggedIn && createPortal(
                <div className="fixed inset-0 z-[1164]">
                    <ProfilePanel
                        open
                        anchor="right"
                        onClose={() => setProfileOpen(false)}
                        onPickEvent={evt => {
                            setProfileOpen(false);
                            router.push(`/?event=${encodeURIComponent(evt.id)}`);
                        }}
                    />
                </div>,
                document.body,
            )}
        </>
    );
}
