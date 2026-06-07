'use client';

import dynamic from 'next/dynamic';

const Shop = dynamic(() => import('@/views/Shop'), { ssr: false });

export default function ShopPage() {
    return <Shop />;
}
