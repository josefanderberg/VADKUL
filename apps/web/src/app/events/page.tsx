/**
 * /events — index över alla städer med events.
 *
 * Gruppen per län. SEO-magnet för "events i Sverige", "vad händer i Sverige".
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { CITIES } from '@/lib/cityUtils';

export const metadata: Metadata = {
    title: 'Events i Sverige — VADKUL',
    description: 'Hitta evenemang i alla Sveriges största städer. Konserter, marknader, kultur, sport och mycket mer.',
    openGraph: {
        title: 'Events i Sverige — VADKUL',
        description: 'Hitta evenemang i alla Sveriges största städer.',
        url: 'https://vadkul.se/events',
        locale: 'sv_SE',
        type: 'website',
    },
};

const REGION_LABELS: Record<string, string> = {
    'stockholm': 'Stockholms län',
    'vastra-gotaland': 'Västra Götalands län',
    'skane': 'Skåne län',
    'uppsala': 'Uppsala län',
    'ostergotland': 'Östergötlands län',
    'sodermanland': 'Södermanlands län',
    'jonkoping': 'Jönköpings län',
    'kronoberg': 'Kronobergs län',
    'kalmar': 'Kalmar län',
    'gotland': 'Gotlands län',
    'blekinge': 'Blekinge län',
    'halland': 'Hallands län',
    'varmland': 'Värmlands län',
    'orebro': 'Örebro län',
    'vastmanland': 'Västmanlands län',
    'dalarna': 'Dalarnas län',
    'gavleborg': 'Gävleborgs län',
    'vasternorrland': 'Västernorrlands län',
    'jamtland': 'Jämtlands län',
    'vasterbotten': 'Västerbottens län',
    'norrbotten': 'Norrbottens län',
};

export default function CitiesIndexPage() {
    // Dedupe på slug + gruppera per län
    const seen = new Set<string>();
    const unique = CITIES.filter(c => {
        if (seen.has(c.slug)) return false;
        seen.add(c.slug);
        return true;
    });
    const byRegion = new Map<string, typeof unique>();
    for (const c of unique) {
        if (!byRegion.has(c.region)) byRegion.set(c.region, []);
        byRegion.get(c.region)!.push(c);
    }
    // Sortera städer alfabetiskt inom län, län alfabetiskt
    const regionsSorted = [...byRegion.entries()]
        .sort((a, b) => (REGION_LABELS[a[0]] || a[0]).localeCompare(REGION_LABELS[b[0]] || b[0], 'sv'));

    return (
        <main style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#222' }}>
            <nav style={{ fontSize: '0.9rem', color: '#666' }}>
                <Link href="/">Start</Link> {' › '} Alla städer
            </nav>
            <h1 style={{ fontSize: '2rem', margin: '0.5rem 0 0.5rem' }}>Events i Sveriges städer</h1>
            <p style={{ color: '#666', margin: '0 0 2rem' }}>
                Välj en stad för att se vilka evenemang som händer där den närmsta veckan.
            </p>

            {regionsSorted.map(([region, cities]) => (
                <section key={region} style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.1rem', color: '#444', borderBottom: '1px solid #eee', paddingBottom: '0.3rem' }}>
                        {REGION_LABELS[region] || region}
                    </h2>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {cities
                            .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
                            .map(c => (
                                <li key={c.slug}>
                                    <Link href={`/events/${c.slug}`} style={{
                                        display: 'inline-block',
                                        padding: '0.4rem 0.8rem',
                                        background: '#f6f7fb',
                                        borderRadius: 999,
                                        textDecoration: 'none',
                                        color: '#222',
                                        fontSize: '0.9rem',
                                    }}>
                                        {c.name}
                                    </Link>
                                </li>
                            ))}
                    </ul>
                </section>
            ))}

            <footer style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #eee', color: '#999', fontSize: '0.85rem' }}>
                Saknar du din stad? Vi lägger till fler kontinuerligt — kom tillbaka snart.
            </footer>
        </main>
    );
}
