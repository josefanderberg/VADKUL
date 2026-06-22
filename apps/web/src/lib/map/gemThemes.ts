// ── "Ädelstens"-teman för funktions-orber ──────────────────────────────────
// Varje funktion (väskans knappar) ritas som en rund glasad orb. GEM_THEMES
// håller färg/skugg-paletten per funktionsnyckel; getGemStyles väljer rätt
// uppsättning utifrån orbens tillstånd (aktiv/inaktiv/låst). Utflyttat ur V2Map.

const GEM_THEMES: Record<string, {
    activeBg: string;
    inactiveBg: string;
    activeShadow: string;
    inactiveShadow: string;
    activeIconColor: string;
    inactiveIconColor: string;
}> = {
    findgame: { // Purple Amethyst
        activeBg: 'radial-gradient(circle at 30% 25%, #f3e8ff 0%, #c084fc 25%, #8b5cf6 55%, #6d28d9 85%, #4c1d95 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(243,232,255,0.25) 0%, rgba(192,132,252,0.15) 25%, rgba(139,92,246,0.08) 65%, rgba(109,40,217,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(139,92,246,0.5), 0 0 26px rgba(192,132,252,0.4), inset -3px -6px 14px rgba(76,29,149,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(139,92,246,0.05), inset -3px -5px 12px rgba(76,29,149,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#d8b4fe'
    },
    tilt: { // Cyan Topaz
        activeBg: 'radial-gradient(circle at 30% 25%, #e0f2fe 0%, #38bdf8 25%, #0284c7 55%, #0369a1 85%, #0c4a6e 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(224,242,254,0.25) 0%, rgba(56,189,248,0.15) 25%, rgba(2,132,199,0.08) 65%, rgba(3,105,161,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(2,132,199,0.5), 0 0 26px rgba(56,189,248,0.4), inset -3px -6px 14px rgba(12,74,110,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(2,132,199,0.05), inset -3px -5px 12px rgba(12,74,110,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#7dd3fc'
    },
    throw: { // Fire Opal (Orange)
        activeBg: 'radial-gradient(circle at 30% 25%, #ffedd5 0%, #fb923c 25%, #ea580c 55%, #c2410c 85%, #7c2d12 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(255,237,213,0.25) 0%, rgba(251,146,60,0.15) 25%, rgba(234,88,12,0.08) 65%, rgba(194,65,12,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(234,88,12,0.5), 0 0 26px rgba(251,146,60,0.4), inset -3px -6px 14px rgba(124,45,18,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(234,88,12,0.05), inset -3px -5px 12px rgba(124,45,18,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#ffb07c'
    },
    sun: { // Citrine/Sun Yellow
        activeBg: 'radial-gradient(circle at 30% 25%, #fef9c3 0%, #facc15 25%, #ca8a04 55%, #a16207 85%, #713f12 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(254,249,195,0.25) 0%, rgba(250,204,21,0.15) 25%, rgba(202,138,4,0.08) 65%, rgba(161,98,7,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(202,138,4,0.5), 0 0 26px rgba(250,204,21,0.4), inset -3px -6px 14px rgba(113,63,18,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(202,138,4,0.05), inset -3px -5px 12px rgba(113,63,18,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fef08a'
    },
    focus: { // Ruby Red
        activeBg: 'radial-gradient(circle at 30% 25%, #fee2e2 0%, #f87171 25%, #dc2626 55%, #b91c1c 85%, #7f1d1d 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(254,226,226,0.25) 0%, rgba(248,113,113,0.15) 25%, rgba(220,38,38,0.08) 65%, rgba(185,28,28,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(220,38,38,0.5), 0 0 26px rgba(248,113,113,0.4), inset -3px -6px 14px rgba(127,29,29,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(220,38,38,0.05), inset -3px -5px 12px rgba(127,29,29,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fca5a5'
    },
    slingshot: { // Emerald Green
        activeBg: 'radial-gradient(circle at 30% 25%, #dcfce7 0%, #4ade80 25%, #16a34a 55%, #15803d 85%, #14532d 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(220,252,231,0.25) 0%, rgba(74,222,128,0.15) 25%, rgba(22,163,74,0.08) 65%, rgba(21,128,61,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(22,163,74,0.5), 0 0 26px rgba(74,222,128,0.4), inset -3px -6px 14px rgba(20,83,45,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(22,163,74,0.05), inset -3px -5px 12px rgba(20,83,45,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#86efac'
    },
    faces: { // Rose Quartz (Pink)
        activeBg: 'radial-gradient(circle at 30% 25%, #fce7f3 0%, #f472b6 25%, #db2777 55%, #be185d 85%, #831843 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(252,231,243,0.25) 0%, rgba(244,114,182,0.15) 25%, rgba(219,39,119,0.08) 65%, rgba(190,24,93,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(219,39,119,0.5), 0 0 26px rgba(244,114,182,0.4), inset -3px -6px 14px rgba(131,24,67,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(219,39,119,0.05), inset -3px -5px 12px rgba(131,24,67,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fbcfe8'
    },
    bigCloud: { // Sapphire Blue
        activeBg: 'radial-gradient(circle at 30% 25%, #e0e7ff 0%, #818cf8 25%, #4f46e5 55%, #3730a3 85%, #1e1b4b 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(224,231,255,0.25) 0%, rgba(129,140,248,0.15) 25%, rgba(79,70,229,0.08) 65%, rgba(55,48,163,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(79,70,229,0.5), 0 0 26px rgba(129,140,248,0.4), inset -3px -6px 14px rgba(30,27,75,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(79,70,229,0.05), inset -3px -5px 12px rgba(30,27,75,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#c7d2fe'
    },
    fastThrow: { // Orange/Lightning Yellow
        activeBg: 'radial-gradient(circle at 30% 25%, #fffbeb 0%, #fbbf24 25%, #d97706 55%, #b45309 85%, #78350f 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(255,251,235,0.25) 0%, rgba(251,191,36,0.15) 25%, rgba(217,119,6,0.08) 65%, rgba(180,83,9,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(217,119,6,0.5), 0 0 26px rgba(251,191,36,0.4), inset -3px -6px 14px rgba(120,53,15,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(217,119,6,0.05), inset -3px -5px 12px rgba(120,53,15,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fde68a'
    },
    sparkle: { // Magenta/Purple Star
        activeBg: 'radial-gradient(circle at 30% 25%, #fae8ff 0%, #e879f9 25%, #c084fc 55%, #8b5cf6 85%, #4c1d95 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(250,232,255,0.25) 0%, rgba(232,121,249,0.15) 25%, rgba(192,132,252,0.08) 65%, rgba(139,92,246,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(139,92,246,0.5), 0 0 26px rgba(232,121,249,0.4), inset -3px -6px 14px rgba(76,29,149,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(139,92,246,0.05), inset -3px -5px 12px rgba(76,29,149,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#f5d0fe'
    },
    snowball: { // Frost/Light Blue
        activeBg: 'radial-gradient(circle at 30% 25%, #f0fdfa 0%, #2dd4bf 25%, #0d9488 55%, #0f766e 85%, #115e59 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(240,253,250,0.25) 0%, rgba(45,212,191,0.15) 25%, rgba(13,148,136,0.08) 65%, rgba(15,118,110,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(13,148,136,0.5), 0 0 26px rgba(45,212,191,0.4), inset -3px -6px 14px rgba(17,94,89,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(13,148,136,0.05), inset -3px -5px 12px rgba(17,94,89,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#99f6e4'
    },
    createEvent: { // Emerald/Jade Green
        activeBg: 'radial-gradient(circle at 30% 25%, #f0fdf4 0%, #4ade80 25%, #16a34a 55%, #15803d 85%, #14532d 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(240,253,244,0.25) 0%, rgba(74,222,128,0.15) 25%, rgba(22,163,74,0.08) 65%, rgba(21,128,61,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(22,163,74,0.5), 0 0 26px rgba(74,222,128,0.4), inset -3px -6px 14px rgba(20,83,45,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(22,163,74,0.05), inset -3px -5px 12px rgba(20,83,45,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#bbf7d0'
    },
    multiplayer: { // Electric Purple/Blue
        activeBg: 'radial-gradient(circle at 30% 25%, #eff6ff 0%, #60a5fa 25%, #2563eb 55%, #1d4ed8 85%, #1e3a8a 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(239,246,255,0.25) 0%, rgba(96,165,250,0.15) 25%, rgba(37,99,235,0.08) 65%, rgba(29,78,216,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(37,99,235,0.5), 0 0 26px rgba(96,165,250,0.4), inset -3px -6px 14px rgba(29,78,216,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(37,99,235,0.05), inset -3px -5px 12px rgba(29,78,216,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#93c5fd'
    },
    record: { // Deep Crimson/Ruby
        activeBg: 'radial-gradient(circle at 30% 25%, #fff1f2 0%, #fb7185 25%, #e11d48 55%, #be123c 85%, #881337 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(255,241,242,0.25) 0%, rgba(251,113,133,0.15) 25%, rgba(225,29,72,0.08) 65%, rgba(190,18,60,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(225,29,72,0.5), 0 0 26px rgba(251,113,133,0.4), inset -3px -6px 14px rgba(136,19,55,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(225,29,72,0.05), inset -3px -5px 12px rgba(136,19,55,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fecdd3'
    },
    satellite: { // Blue/Sky Pearl
        activeBg: 'radial-gradient(circle at 30% 25%, #f0f9ff 0%, #38bdf8 25%, #0284c7 55%, #0369a1 85%, #075985 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(240,249,255,0.25) 0%, rgba(56,189,248,0.15) 25%, rgba(2,132,199,0.08) 65%, rgba(3,105,161,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(2,132,199,0.5), 0 0 26px rgba(56,189,248,0.4), inset -3px -6px 14px rgba(7,89,133,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(2,132,199,0.05), inset -3px -5px 12px rgba(7,89,133,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#bae6fd'
    },
    globe: { // Ocean Teal
        activeBg: 'radial-gradient(circle at 30% 25%, #f0fdfa 0%, #2dd4bf 25%, #0d9488 55%, #0f766e 85%, #115e59 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(240,253,250,0.25) 0%, rgba(45,212,191,0.15) 25%, rgba(13,148,136,0.08) 65%, rgba(15,118,110,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(13,148,136,0.5), 0 0 26px rgba(45,212,191,0.4), inset -3px -6px 14px rgba(17,94,89,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(13,148,136,0.05), inset -3px -5px 12px rgba(17,94,89,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#99f6e4'
    },
    terrain: { // Mountain Gold/Bronze
        activeBg: 'radial-gradient(circle at 30% 25%, #fef3c7 0%, #fbbf24 25%, #d97706 55%, #b45309 85%, #78350f 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(254,243,199,0.25) 0%, rgba(251,191,36,0.15) 25%, rgba(217,119,6,0.08) 65%, rgba(180,83,9,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(217,119,6,0.5), 0 0 26px rgba(251,191,36,0.4), inset -3px -6px 14px rgba(12,74,110,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(217,119,6,0.05), inset -3px -5px 12px rgba(12,74,110,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fde68a'
    },
    themepark: { // Candy Pink/Yellow (nöjesfält-knappen)
        activeBg: 'radial-gradient(circle at 30% 25%, #fdf2f8 0%, #f472b6 25%, #db2777 55%, #be185d 85%, #9d174d 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(253,242,248,0.25) 0%, rgba(244,114,182,0.15) 25%, rgba(219,39,119,0.08) 65%, rgba(157,23,77,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(219,39,119,0.5), 0 0 26px rgba(244,114,182,0.4), inset -3px -6px 14px rgba(157,23,77,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(219,39,119,0.05), inset -3px -5px 12px rgba(157,23,77,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fbcfe8'
    },
    dark: { // Slate/Charcoal (mörkt läge)
        activeBg: 'radial-gradient(circle at 30% 25%, #94a3b8 0%, #475569 25%, #334155 55%, #1e293b 85%, #0f172a 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(148,163,184,0.25) 0%, rgba(71,85,105,0.15) 25%, rgba(51,65,85,0.08) 65%, rgba(30,41,59,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(51,65,85,0.5), 0 0 26px rgba(71,85,105,0.4), inset -3px -6px 14px rgba(15,23,42,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(51,65,85,0.05), inset -3px -5px 12px rgba(15,23,42,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#cbd5e1'
    }
};

export type OrbState = 'active' | 'inactive' | 'locked' | 'capped';

export const getGemStyles = (key: string, state: OrbState) => {
    const theme = GEM_THEMES[key];
    if (!theme) {
        const active = state === 'active';
        return {
            bg: active
                ? 'radial-gradient(circle at 32% 28%, #e6f4ff 0%, #7dc4ec 20%, #1d8ec9 55%, #006AA7 85%, #003d65 100%)'
                : 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.98) 0%, rgba(225,238,250,0.85) 25%, rgba(170,205,235,0.55) 65%, rgba(110,160,210,0.55) 100%)',
            shadow: active
                ? '0 8px 18px rgba(0,90,160,0.50), inset -3px -6px 14px rgba(0,40,80,0.55)'
                : '0 6px 14px rgba(60,90,140,0.30), inset -3px -5px 12px rgba(60,90,140,0.30)',
            iconColor: active ? '#ffffff' : '#006AA7',
            border: active ? '1px solid rgba(255,255,255,0.40)' : '1px solid rgba(255,255,255,0.75)'
        };
    }

    if (state === 'locked') {
        const recordTheme = GEM_THEMES['record'];
        return {
            bg: recordTheme.inactiveBg,
            shadow: recordTheme.inactiveShadow,
            iconColor: '#7c2d12',
            border: '1px solid rgba(255,235,180,0.65)'
        };
    }

    const active = state === 'active';
    return {
        bg: active ? theme.activeBg : theme.inactiveBg,
        shadow: active ? theme.activeShadow : theme.inactiveShadow,
        iconColor: active ? theme.activeIconColor : theme.inactiveIconColor,
        border: active ? '1px solid rgba(255,255,255,0.40)' : '1px solid rgba(255,255,255,0.25)'
    };
};
