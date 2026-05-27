'use client';

import { useEffect } from 'react';

export default function V2Layout({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const html = document.documentElement;
        const hadDark = html.classList.contains('dark');
        html.classList.remove('dark');
        return () => {
            if (hadDark) html.classList.add('dark');
        };
    }, []);

    return (
        <div data-app="v2" style={{ colorScheme: 'light' }}>
            {children}
        </div>
    );
}
