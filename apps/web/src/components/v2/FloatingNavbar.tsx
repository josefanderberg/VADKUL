'use client';

import { useState, useEffect, useRef } from 'react';
import { User, MapPinPlus, Check, Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface FloatingNavbarProps {
    creationMode?: 'idle' | 'placing' | 'editing';
    /** När false → +-knappen renderas inte alls (shop-flaggan "Skapa event"
     *  är avaktiverad). Default true så befintliga kallningar inte ändras. */
    createEventEnabled?: boolean;
    onStartCreate?: () => void;
    onConfirmPlacement?: () => void;
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
    /* (Hjärtknappen "Sparade" låg här. BORTTAGEN 22/8, Josef: gilla-knappen
       ska inte finnas för utloggade — och för inloggade var den redan ersatt
       av Sparade-raden i profilpanelen, så props savedCount/onToggleSaved
       försvann med den. Sparat-panelen öppnas numera bara därifrån.) */
    /* (Skylt-knappen och dess signsOn/onToggleSigns låg här. Borttagna 14/8 —
       Josef: "we don't need that anymore". Skapa-knappen ärvde platsen.) */
    /* (plusHint låg här: plusset blinkade när onboardingens actionruta flugit
       hem hit. Actionrutan är borttagen 26/8 — för många popups.) */
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
 * Namn-etikett som tonar in vid hover/fokus — exakt samma formspråk som
 * kategoricirklarnas etiketter i CategoryFilter. Måste ligga som peer-syskon
 * EFTER knappen i DOM (krav för peer-selektorn); raden runtomkring avgör sedan
 * om den hamnar till höger (flex-row) eller vänster (flex-row-reverse) om
 * knappen. Ligger kvar i flödet men är pointer-events-none, och raden runt om
 * är också pointer-events-none så den osynliga etikettytan inte slukar
 * kartklick.
 */
const HoverLabel = ({ children }: { children: React.ReactNode }) => (
    <span
        aria-hidden
        className="pointer-events-none opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100 transition-opacity duration-150 whitespace-nowrap rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-slate-700 shadow-lg border border-white/50"
    >
        {children}
    </span>
);

export default function FloatingNavbar({
    creationMode = 'idle',
    createEventEnabled = true,
    onStartCreate,
    onConfirmPlacement,
    searchQuery,
    setSearchQuery,
    closeSearchNonce = 0,
    onLoginClick,
    onOpenProfile,
}: FloatingNavbarProps) {
    const { user } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const animationRef = useRef<Animation | null>(null);
    const [plusDropping, setPlusDropping] = useState(false);


    // Fokusera sökfältet när det öppnas — numera bara en RESERV för öppningar
    // som inte går via klicket (mobiltangentbordet kräver det synkrona fokuset
    // i själva klick-handlern, se sök-containern nedan; det här deferred-fokuset
    // öppnar ALDRIG tangentbordet på iOS).
    useEffect(() => {
        if (searchOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [searchOpen]);

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

    // Avbryt plus-animation när creationMode återgår till idle
    useEffect(() => {
        if (creationMode === 'idle' && animationRef.current) {
            animationRef.current.cancel();
            animationRef.current = null;
            setPlusDropping(false);
        }
    }, [creationMode]);

    const handlePlusClick = () => {
        if (creationMode === 'placing') {
            onConfirmPlacement?.();
            return;
        }
        if (plusDropping || creationMode !== 'idle') return;
        const btn = plusBtnRef.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
        const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);

        setPlusDropping(true);

        const animation = btn.animate(
            [
                { transform: 'translate(0px, 0px)', easing: 'ease-in-out' },
                { transform: `translate(0px, ${dy}px)`, offset: 0.5, easing: 'ease-in-out' },
                { transform: `translate(${dx}px, ${dy}px)` },
            ],
            { duration: 800, fill: 'forwards' },
        );
        animationRef.current = animation;
        animation.onfinish = () => {
            onStartCreate?.();
            setPlusDropping(false);
        };
    };

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
        // z-[1160]: över stadsrutan (1090) OCH kategorikolumnen (1150) — öppet
        // sökfält + resultatpanel ska täcka båda. Eventkortet (1250) och
        // modaler (1300) ligger fortfarande över.
        <div className="absolute top-6 left-0 right-0 z-[1160] px-4 pointer-events-none">
            <div className="flex flex-col gap-3 w-full max-w-[1400px] mx-auto">

                {/* Top Row. På största brytpunkten (2xl) lämnar vi plats längst till
                    höger åt kategorifiltret som då hoppar upp på den här raden
                    (CategoryFilter, samma max-w-[1400px]-container).
                    items-start (inte center): vänsterkolumnen är flera knappar
                    hög — övriga kontroller ska ligga kvar i topplinjen, inte
                    mittcentreras mot kolumnen. */}
                <div className="relative flex items-start gap-2 w-full 2xl:pr-[56px]">

                    {/* Vänster: profil med skapa-knappen UNDER — frigör plats i
                        topplinjen för dagväljarens bläddringspilar (6/8, Josefs
                        önskemål: allt ska få plats utan att det blir trångt). */}
                    <div className="flex flex-col items-start gap-2 shrink-0">
                        <div className="flex items-center gap-2 pointer-events-none">
                            <button
                                type="button"
                                onClick={handleProfileClick}
                                className={`peer pointer-events-auto bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative ${user?.photoURL ? 'p-0.5' : 'p-2.5'}`}
                                aria-label={user ? 'Min profil' : 'Logga in'}
                            >
                                {user?.photoURL ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
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
                        {/* Skapa/tipsa — kartnål-med-plus. Bor SEDAN 14/8 här nere
                            i vänsterkolumnen, på skylt-knappens gamla plats (den
                            är borttagen), och bär dess formspråk: blå gradient,
                            gul kant, gold-glow-pulse. Den gröna gradienten är
                            borta — sajtens "något händer här"-språk är blått och
                            guld, och två olika accentfärger på samma skärm sa
                            inget extra.
                            I placerings-läget är den bekräfta-knappen (✓) och
                            måste alltid synas; mitt i drop-animationen får den
                            inte unmountas (då fastnar plusDropping-låset). */}
                        {creationMode !== 'editing' && createEventEnabled && (
                            <div className="relative z-[1100] flex items-center gap-2 pointer-events-none">
                                <button
                                    ref={plusBtnRef}
                                    type="button"
                                    onClick={handlePlusClick}
                                    disabled={plusDropping}
                                    aria-label={creationMode === 'placing' ? 'Välj denna plats' : 'Lägg in eget event på kartan'}
                                    className={`peer pointer-events-auto relative bg-gradient-to-br from-[#006AA7] via-[#005590] to-[#003C66] backdrop-blur-md h-10 w-10 flex items-center justify-center rounded-full shadow-lg border-2 border-[#FECC02] hover:scale-105 active:scale-95 transition-transform duration-200 shrink-0 group gold-glow-pulse`}
                                >
                                    {creationMode === 'placing'
                                        ? <Check size={20} className="text-white shrink-0" />
                                        : <MapPinPlus size={20} className="text-[#FECC02] shrink-0 group-hover:scale-110 transition-transform duration-200" />}
                                </button>
                                <HoverLabel>{creationMode === 'placing' ? 'Välj denna plats' : 'Lägg in eller tipsa'}</HoverLabel>
                            </div>
                        )}
                    </div>

                    {/* (Dagväljar-chipen med popover som stod här är BORTTAGEN
                        10/8: stadsrutan står numera ALLTID uppe i topplinjen och
                        äger dag-navigeringen — pilarna stegar dag, klick växlar
                        dag↔vecka och kalenderknappen öppnar månadskalendern
                        direkt. Två dagväljare i samma linje vore en för mycket.) */}

                    {/* Höger: en KOLUMN längst ut i kanten (6/8, Josef): sök överst,
                        skapa event-knappen under, och kategorifiltret (renderas i
                        CategoryFilter, top-[96px]) som tredje knapp — tre i rad
                        lodrätt. Containern är pointer-events-none (dess TOMMA
                        vänsterdel täcker annars kartbandet och slukar klick) —
                        varje faktisk kontroll sätter pointer-events-auto själv. */}
                    <div className="flex flex-col items-end gap-2 flex-1 min-w-0 pointer-events-none">
                        {/* Sök. Öppet läge expanderar från högerkanten som förut,
                            men ligger ÖVER allt annat i navbaren (z-[1200] >
                            skapa-knappens 1100) med SOLID vit bakgrund — förut
                            hamnade fältet under dagväljaren så man inte såg det
                            man skrev.
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
                                className={`peer pointer-events-auto flex items-center h-10 rounded-full border border-white/50 transition-colors ${searchOpen
                                    ? 'relative z-[1200] w-full max-w-[520px] bg-white px-4 shadow-xl'
                                    : 'w-10 justify-center bg-white/90 backdrop-blur-md shadow-lg hover:bg-white cursor-pointer'}`}
                            >
                                <Search size={searchOpen ? 16 : 20} aria-hidden className={searchOpen ? 'text-slate-400 shrink-0 mr-2' : 'text-slate-700 shrink-0'} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchOpen(true)}
                                    placeholder="Sök stad eller event…"
                                    aria-label="Sök stad eller event"
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
                            {/* "Stad" står först i etiketten med flit: knappen lästes
                                som ren eventsökning (användarkommentar 10/8) och man
                                letade efter en egen sökruta för orter. */}
                            {!searchOpen && <HoverLabel>Sök stad eller event</HoverLabel>}
                        </div>

                        {/* (Skapa-knappen låg här i högerkolumnen fram till 14/8.
                            Den bor nu i VÄNSTERKOLUMNEN, på skylt-knappens gamla
                            plats — söket får därmed hela högerkanten för sig
                            själv och behöver inte längre gömma knappen medan
                            fältet är utfällt.) */}
                    </div>
                </div>
            </div>
        </div>
    );
}
