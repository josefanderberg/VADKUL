'use client';

import dynamic from 'next/dynamic';

const About = dynamic(() => import('@/views/About'), { ssr: false });

export default function AboutPage() {
    return <About />;
}
