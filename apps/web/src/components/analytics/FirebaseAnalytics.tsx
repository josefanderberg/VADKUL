'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

export default function FirebaseAnalytics() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (pathname) {
            analytics.then(instance => {
                if (instance) {
                    logEvent(instance, 'page_view', {
                        page_path: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''),
                    });
                }
            }).catch(err => {
                console.error('Firebase Analytics error:', err);
            });
        }
    }, [pathname, searchParams]);

    return null;
}
