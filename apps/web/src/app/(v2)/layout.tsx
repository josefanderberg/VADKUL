'use client';

// Kartan följer temasystemet (ThemeProvider): sparat tema vinner, annars
// webbläsarens mörka/ljusa läge. Tidigare tvingades kartan alltid ljus här —
// borttaget 2026-07-05 (användarbeslut: mörka eventkort är OK i darkmode).
export default function V2Layout({ children }: { children: React.ReactNode }) {
    return (
        <div data-app="v2">
            {children}
        </div>
    );
}
