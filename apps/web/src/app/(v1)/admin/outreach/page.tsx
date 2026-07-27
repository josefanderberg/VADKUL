import type { Metadata } from 'next';
import OutreachConsole from './OutreachConsole';

// Samma mönster som /admin: force-dynamic så sidan aldrig prerenderas med
// tom auth-state i build-steget.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Publiceringskonsol – VADKUL',
    robots: { index: false, follow: false },
};

export default function OutreachPage() {
    return <OutreachConsole />;
}
