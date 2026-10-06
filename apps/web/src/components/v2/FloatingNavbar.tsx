'use client';

import { User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import HoverLabel from './HoverLabel';

interface FloatingNavbarProps {
    /** Öppna inloggningsmodalen (utan att lämna kartan). */
    onLoginClick?: () => void;
    /** Inloggad: profilknappen öppnar profilpanelen (allt konto-relaterat). */
    onOpenProfile?: () => void;
    /* (SÖKEN OCH FILTERKNAPPEN ÄR BORTTAGNA 7/10 på ägarbeslut: "vi kan ju
       ta bort sök och filter på kartan" — kortets sök/filter-ikon äger sök +
       kategorichips numera, och + bor i högra hörnet (CreateEventButton).
       Med dem gick props searchQuery/setSearchQuery/closeSearchNonce/
       onSearchOpenChange/filterActive och hela sökfälts-mekaniken: det
       alltid-monterade fältet med synkront fokus för iOS-tangentbordet,
       skipFocusRef, stadssöket och SearchResults-panelen i sidan. Sök-
       maskineriet i page.tsx (searchQuery/searchResults/cityHits) står kvar
       orört för en framtida väg in.) */
    /* (Hjärtknappen "Sparade" låg här. BORTTAGEN 22/8, Josef: gilla-knappen
       ska inte finnas för utloggade — och för inloggade var den redan ersatt
       av Sparade-raden i profilpanelen.) */
    /* (Skylt-knappen och dess signsOn/onToggleSigns låg här. Borttagna 14/8 —
       Josef: "we don't need that anymore".) */
    /* (Skapa-knappen låg här t.o.m. 15/9, sedan i en egen kolumn under
       profilknappen 24/9–7/10. Den bor nu i ÖVRE HÖGRA hörnet —
       components/v2/CreateEventButton.) */
}

/** Etiketten för vald dag/period ("Idag", "Imorgon", "Hela veckan", "3–9 aug").
 *  Exporterad: bildspelets stadsruta visar samma text som chipen skulle ha gjort. */
export const getDayLabel = (offset: number, days = 1) => {
    const capitalize = (s: string) => s.replace(/^\w/, (c) => c.toUpperCase());
    if (days > 1) {
        const start = new Date(); start.setDate(start.getDate() + offset);
        const end = new Date(start); end.setDate(end.getDate() + days - 1);
        if (end.getDay() === 0 && days <= 3) return 'I helgen';
        if (offset === 0 && days === 7) return 'Hela veckan';
        const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '');
        return `${fmt(start)}–${fmt(end)}`;
    }
    if (offset === 0) return 'Idag';
    if (offset === 1) return 'Imorgon';
    if (offset === -1) return 'Igår';
    const date = new Date();
    date.setDate(date.getDate() + offset);
    if (offset > 6 || offset < 0) {
        return capitalize(date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', ''));
    }
    return capitalize(date.toLocaleDateString('sv-SE', { weekday: 'long' }));
};

/**
 * Toppraden på kartan (ägarbeslut 7/10): BARA profilen till vänster —
 * dagplattan står i mitten (renderas i sidan) och + i högra hörnet
 * (CreateEventButton). Sök- och filterknappen är rivna (kortets
 * sök/filter-ikon tog över), kategorikolumnen och zoomknapparna sedan länge.
 */
export default function FloatingNavbar({
    onLoginClick,
    onOpenProfile,
}: FloatingNavbarProps) {
    const { user } = useAuth();

    // Inloggad → profilpanelen (allt konto-relaterat på kartan).
    // Utloggad → inloggningsmodalen. Ingen lämnar kartan längre.
    const handleProfileClick = () => {
        if (user) {
            onOpenProfile?.();
        } else {
            onLoginClick?.();
        }
    };

    return (
        // z-[1160]: över stadsrutan (1090). Eventkortet (1250) och modaler
        // (1300) ligger fortfarande över.
        <div className="absolute top-6 left-0 right-0 z-[1160] px-4 pointer-events-none">
            <div className="flex flex-col gap-3 w-full max-w-[1400px] mx-auto">

                {/* Top Row. items-start: kontrollerna ligger i topplinjen. */}
                <div className="relative flex items-start gap-2 w-full">

                    {/* Vänster: profilen. */}
                    <div className="flex flex-col items-start gap-2 shrink-0">
                        <div className="flex items-center gap-2 pointer-events-none">
                            <button
                                type="button"
                                onClick={handleProfileClick}
                                // hover:scale-105 som skapa-knappen (Josef 10/9:
                                // "så fattar man att de går att klicka på").
                                // h-11 w-11: profil och + är lika stora, 44 px
                                // (Josef 15/9).
                                className={`peer pointer-events-auto h-11 w-11 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 hover:bg-white hover:scale-105 active:scale-95 transition duration-200 relative ${user?.photoURL ? 'p-0.5' : ''}`}
                                aria-label={user ? 'Min profil' : 'Logga in'}
                            >
                                {user?.photoURL ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <User size={20} className="text-slate-700" />
                                )}
                                {user && !user.photoURL && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#006AA7] rounded-full border border-white" />
                                )}
                            </button>
                            <HoverLabel>{user ? 'Min profil' : 'Logga in'}</HoverLabel>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
