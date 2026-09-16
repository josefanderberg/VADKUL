'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import HoverLabel from './HoverLabel';

interface FloatingNavbarProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    /** Bumpas när sökrutan ska fällas ihop utifrån — t.ex. när man valt en stad
     *  ur träfflistan och kartan flyger dit. Ett tomt searchQuery duger inte
     *  som signal: då skulle fältet stängas mitt i att man backar bort texten. */
    closeSearchNonce?: number;
    /** Öppna inloggningsmodalen (utan att lämna kartan). */
    onLoginClick?: () => void;
    /** Inloggad: profilknappen öppnar profilpanelen (allt konto-relaterat). */
    onOpenProfile?: () => void;
    /** Sökfältet fälls ut/ihop — sidan visar kategoriraden i sökpanelen så
     *  fort fältet är öppet, även utan söktext (16/9). */
    onSearchOpenChange?: (open: boolean) => void;
    /* (Hjärtknappen "Sparade" låg här. BORTTAGEN 22/8, Josef: gilla-knappen
       ska inte finnas för utloggade — och för inloggade var den redan ersatt
       av Sparade-raden i profilpanelen, så props savedCount/onToggleSaved
       försvann med den. Sparat-panelen öppnas numera bara därifrån.) */
    /* (Skylt-knappen och dess signsOn/onToggleSigns låg här. Borttagna 14/8 —
       Josef: "we don't need that anymore".) */
    /* (Skapa-knappen och dess creationMode/onStartCreate/onConfirmPlacement/
       createHint låg här t.o.m. 15/9. Den bor nu i botten-dockans vänstra
       hörn — components/v2/CreateEventButton.) */
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
 * Toppraden på kartan (ägarbeslut 15/9): BARA profil till vänster och sök till
 * höger — dagplattan står mellan dem (renderas i sidan). Skapa-knappen och 🔥
 * bor i botten-dockan; kategorikolumnen och zoomknapparna är rivna.
 */
export default function FloatingNavbar({
    searchQuery,
    setSearchQuery,
    closeSearchNonce = 0,
    onLoginClick,
    onOpenProfile,
    onSearchOpenChange,
}: FloatingNavbarProps) {
    const { user } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);


    // Fokusera sökfältet när det öppnas — numera bara en RESERV för öppningar
    // som inte går via klicket (mobiltangentbordet kräver det synkrona fokuset
    // i själva klick-handlern, se sök-containern nedan; det här deferred-fokuset
    // öppnar ALDRIG tangentbordet på iOS).
    useEffect(() => {
        if (searchOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [searchOpen]);

    // Speglar fältets läge till sidan (kategoriraden i sökpanelen).
    useEffect(() => {
        onSearchOpenChange?.(searchOpen);
    }, [searchOpen, onSearchOpenChange]);

    // Sidan bad oss stänga (man valde en stad ur träfflistan, eller klickade
    // på kartan) — fäll ihop fältet så kartan syns när den landar. BLUR är
    // obligatorisk sedan fältet alltid är monterat (31/8): utan den står
    // fokuset (och mobiltangentbordet) kvar i det hopfällda fältet.
    // 0 = startvärdet, inget att göra.
    useEffect(() => {
        if (!closeSearchNonce) return;
        setSearchOpen(false);
        searchInputRef.current?.blur();
    }, [closeSearchNonce]);

    // Inloggad → profilpanelen (allt konto-relaterat på kartan).
    // Utloggad → inloggningsmodalen. Ingen lämnar kartan längre.
    const handleProfileClick = () => {
        if (user) {
            onOpenProfile?.();
        } else {
            onLoginClick?.();
        }
    };

    const handleCloseSearch = () => {
        setSearchOpen(false);
        setSearchQuery('');
        // Fältet är alltid monterat (31/8) — utan blur står fokuset och
        // mobiltangentbordet kvar fast fältet fällts ihop.
        searchInputRef.current?.blur();
    };

    return (
        // z-[1160]: över stadsrutan (1090) — öppet sökfält + resultatpanel ska
        // täcka den. Eventkortet (1250) och modaler (1300) ligger fortfarande över.
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
                                // h-11 w-11: ALLA FYRA hörnknappar (profil, sök, +, 🔥)
                                // är lika stora, 44 px (Josef 15/9).
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
                        {/* (Hjärtknappen "Sparade" satt HÄR, under profilen.
                            BORTTAGEN 22/8 på ägarbeslut — lägg inte tillbaka
                            den. Gilla kräver numera konto: kortets hjärta
                            öppnar inloggningen för utloggade, och den som är
                            inloggad når listan via Sparade-raden i
                            profilpanelen.) */}
                    </div>

                    {/* (Dagväljar-chipen med popover som stod här är BORTTAGEN
                        10/8: stadsrutan står numera ALLTID uppe i topplinjen och
                        äger dag-navigeringen.) */}

                    {/* Höger: sök. Containern är pointer-events-none (dess TOMMA
                        vänsterdel täcker annars kartbandet och slukar klick) —
                        varje faktisk kontroll sätter pointer-events-auto själv. */}
                    <div className="flex flex-col items-end gap-2 flex-1 min-w-0 pointer-events-none">
                        {/* Sök. Öppet läge expanderar från högerkanten, ligger
                            ÖVER allt annat i navbaren (z-[1200]) med SOLID vit
                            bakgrund — förut hamnade fältet under dagväljaren så
                            man inte såg det man skrev.
                            EN OCH SAMMA CONTAINER i båda lägena (Josef 31/8:
                            tangentbordet ska öppnas DIREKT på mobilen): fältet
                            är alltid monterat (w-0/osynligt hopfällt) så
                            klick-handlern kan fokusera det SYNKRONT i själva
                            gesten — iOS öppnar bara tangentbordet för en fokus
                            inne i användargestens callstack, aldrig för det
                            gamla setTimeout-fokuset efter att fältet monterats.
                            Tab-fokus på det hopfällda fältet expanderar också
                            (onFocus) — tangentbordsvägen behöver ingen klick. */}
                        <div className={`flex flex-row-reverse items-center gap-2 pointer-events-none ${searchOpen ? 'w-full justify-start' : ''}`}>
                            <div
                                role="search"
                                onClick={() => {
                                    if (searchOpen) return;
                                    setSearchOpen(true);
                                    searchInputRef.current?.focus(); // synkront i gesten → mobiltangentbord
                                }}
                                // Hopfälld: hover:scale-105 som skapa-knappen
                                // (Josef 10/9). Utfälld: ingen skalning — ett
                                // brett sökfält som växer under musen är fel.
                                // UTFÄLLD = ABSOLUT över HELA topplinjen (Josef
                                // 14/9: fältet var ~85px på mobil): kolumnens
                                // flex-1 får bara det som blir över när vänster-
                                // kolumnen (profil + topplattan, ~250px, shrink-0)
                                // tagit sitt — w-full I kolumnen hjälpte inte.
                                // Fältet ligger medvetet ÖVER plattan (z-1200),
                                // så det får täcka topplinjen medan man söker;
                                // radens `relative` är ankaret.
                                className={`peer pointer-events-auto flex items-center h-11 rounded-full border border-white/50 ${searchOpen
                                    ? 'absolute top-0 right-0 z-[1200] w-full max-w-[520px] bg-white px-4 shadow-xl transition-colors'
                                    : 'w-11 justify-center bg-white/90 backdrop-blur-md shadow-lg hover:bg-white hover:scale-105 active:scale-95 transition duration-200 cursor-pointer'}`}
                            >
                                <Search size={searchOpen ? 16 : 20} aria-hidden className={searchOpen ? 'text-slate-400 shrink-0 mr-2' : 'text-slate-700 shrink-0'} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchOpen(true)}
                                    // "eller båda" (16/9): "jazz göteborg" fungerar
                                    // numera, och användare trodde att det inte gick.
                                    placeholder="Sök stad, event – eller båda…"
                                    aria-label="Sök stad, event eller båda"
                                    className={searchOpen
                                        ? 'flex-1 bg-transparent outline-none text-base text-slate-800 placeholder:text-slate-400 min-w-0'
                                        : 'w-0 min-w-0 p-0 bg-transparent outline-none opacity-0'}
                                />
                                {searchOpen && (
                                    <button
                                        onClick={handleCloseSearch}
                                        aria-label="Stäng sökningen"
                                        className="ml-2 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                            {/* "Sök och filtrera" (16/9): kategorifiltret bor bakom
                                knappen sedan kolumnen revs. Platshållaren har
                                fortfarande "stad" först — knappen lästes som ren
                                eventsökning (användarkommentar 10/8). */}
                            {!searchOpen && <HoverLabel>Sök och filtrera</HoverLabel>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
