import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight">404 - Sidan hittades inte</h1>
                <p className="text-muted-foreground">Tyvärr, vi kunde inte hitta sidan du letade efter.</p>
                <div className="pt-4">
                    <Link href="/" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-6 py-2 rounded-full font-bold hover:bg-primary/90 transition-all">
                        Tillbaka till startsidan
                    </Link>
                </div>
            </div>
        </div>
    );
}
