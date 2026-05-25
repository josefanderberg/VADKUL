'use client';

import { Suspense } from 'react';
import HomeContent from '@/components/home/HomeContent';

export default function HomePage() {
    return (
        <Suspense fallback={<div>Laddar...</div>}>
            <HomeContent />
        </Suspense>
    );
}
