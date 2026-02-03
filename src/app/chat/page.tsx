'use client';

import dynamic from 'next/dynamic';

const Chat = dynamic(() => import('@/views/Chat'), { ssr: false });

export default function ChatPage() {
    return <Chat />;
}
