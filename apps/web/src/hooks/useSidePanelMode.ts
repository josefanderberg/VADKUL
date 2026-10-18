'use client';

import { useEffect, useState } from 'react';
import { SIDE_PANEL_QUERY } from '@/utils/sidePanel';

/** Är skärmen bred nog för sidopanelsläget (utils/sidePanel)? false i SSR
 *  och första renderingen - samma som EventCards egen matchMedia. */
export function useSidePanelMode(): boolean {
    const [on, setOn] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia(SIDE_PANEL_QUERY);
        const apply = () => setOn(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);
    return on;
}
