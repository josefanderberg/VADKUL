import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { TrendingUp, ShieldCheck, Globe, Lightbulb, Search, Handshake, Users, HelpCircle, Trophy, MessageSquarePlus, Info as InfoIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import HallOfFame from '../components/about/HallOfFame';
import Feedback from '../components/about/Feedback';

export default function About() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'info' | 'hall-of-fame' | 'feedback'>('info');

    // Handle direct linking to tabs
    useEffect(() => {
        if (location.hash === '#hall-of-fame') setActiveTab('hall-of-fame');
        if (location.hash === '#feedback') setActiveTab('feedback');
    }, [location]);

    return (
        <Layout>
            <div className="min-h-screen bg-background text-foreground pb-20">

                {/* SUB-NAVBAR - Moved to top as requested */}
                <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border">
                    <div className="max-w-md mx-auto flex p-1">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'info'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <InfoIcon size={18} /> Info
                        </button>
                        <button
                            onClick={() => setActiveTab('hall-of-fame')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'hall-of-fame'
                                ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Trophy size={18} /> Hall of Fame
                        </button>
                        <button
                            onClick={() => setActiveTab('feedback')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'feedback'
                                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <MessageSquarePlus size={18} /> Feedback
                        </button>
                    </div>
                </div>

                {/* HERO SECTION */}
                <section className="relative py-20 px-6 overflow-hidden border-b border-border/40">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/80 to-background dark:from-indigo-950/20 dark:to-background -z-10" />
                    <div className="max-w-4xl mx-auto text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
                            <Lightbulb size={14} />
                            Vår Vision
                        </div>
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
                            Det ska vara enkelt <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 animate-gradient-x">
                                att vara spontan
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
                            Andra appar handlar om att planera veckor i förväg. <br className="hidden md:block" />
                            VADKUL handlar om vad som händer <strong>just nu, runt hörnet.</strong>
                        </p>
                    </div>
                </section>

                {/* --- CONTENT TABS --- */}

                {activeTab === 'info' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">

                        {/* HOW IT WORKS */}
                        <section className="py-20 px-6 bg-muted/30 border-y border-border/50">
                            <div className="max-w-6xl mx-auto">
                                <div className="text-center mb-16">
                                    <h2 className="text-3xl font-bold mb-4">Marknadens enda app för "Här och Nu"</h2>
                                    <p className="text-muted-foreground max-w-xl mx-auto">
                                        Sluta scrolla genom events du ändå inte kommer gå på om tre veckor.
                                        Vi fokuserar på det som är relevant ikväll.
                                    </p>
                                </div>
                                <div className="grid md:grid-cols-3 gap-8">
                                    <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all text-center group">
                                        <div className="w-16 h-16 w-max mx-auto bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <Search size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-3">1. Upptäck Lokalt</h3>
                                        <p className="text-muted-foreground">
                                            Ser du en prick på kartan? Det är något som händer <em>nu</em> eller väldigt snart. Inget brus, bara möjligheter.
                                        </p>
                                    </div>
                                    <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all text-center group">
                                        <div className="w-16 h-16 w-max mx-auto bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <Handshake size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-3">2. Inga Krav</h3>
                                        <p className="text-muted-foreground">
                                            Klicka "Gå med". Klart. Ingen krånglig biljettbokning. Spontanitet kräver enkelhet.
                                        </p>
                                    </div>
                                    <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all text-center group">
                                        <div className="w-16 h-16 w-max mx-auto bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <Users size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-3">3. Skapa på 30 sek</h3>
                                        <p className="text-muted-foreground">
                                            Fick du feeling? "Basket i parken kl 18". Bom. Klart. Låt grannarna veta.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* PILLARS */}
                        <section className="py-24 px-6">
                            <div className="max-w-6xl mx-auto space-y-24">
                                <div className="grid md:grid-cols-2 gap-12 items-center">
                                    <div className="space-y-6 order-2 md:order-1">
                                        <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-sm">
                                            <Globe size={16} /> Lokalt Liv
                                        </div>
                                        <h2 className="text-4xl font-bold tracking-tight">Väck liv i grannskapet</h2>
                                        <p className="text-lg text-muted-foreground leading-relaxed">
                                            Vi har blivit experter på att ignorera våra grannar samtidigt som vi "connectar" med främlingar på internet.
                                        </p>
                                        <p className="text-lg text-muted-foreground leading-relaxed">
                                            Vi vänder på det. VADKUL är verktyget för att se vad som händer på din gata. Det är där livet pågår.
                                        </p>
                                    </div>
                                    <div className="bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-3xl h-80 w-full order-1 md:order-2 flex items-center justify-center">
                                        <Globe className="text-indigo-300 dark:text-indigo-700 w-40 h-40 opacity-50" />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-12 items-center">
                                    <div className="bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-3xl h-80 w-full flex items-center justify-center">
                                        <TrendingUp className="text-emerald-300 dark:text-emerald-700 w-40 h-40 opacity-50" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-sm">
                                            <TrendingUp size={16} /> Offline is the new Luxury
                                        </div>
                                        <h2 className="text-4xl font-bold tracking-tight">Bryt den digitala bubblan</h2>
                                        <p className="text-lg text-muted-foreground leading-relaxed">
                                            I en värld där allt är digitalt blir det fysiska mötet en lyxvara. Men det ska vara en lyx tillgänglig för alla.
                                        </p>
                                        <p className="text-lg text-muted-foreground leading-relaxed">
                                            Vårt mål är att du ska använda den här appen så <em>lite</em> som möjligt. Hitta ett event, lägg ner telefonen, och lev.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* PHILOSOPHY & FAQ */}
                        <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900/50">
                            <div className="max-w-4xl mx-auto">
                                <div className="text-center mb-16">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mb-6">
                                        <ShieldCheck size={32} />
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Vår Filosofi: Sunt Förnuft</h2>
                                    <p className="text-xl text-muted-foreground">
                                        Frihet under ansvar. Vi bygger en plattform för vuxna människor som vill ha kul.
                                    </p>
                                </div>

                                <div className="grid gap-6">
                                    <div className="bg-card p-6 rounded-xl border border-border">
                                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                            <HelpCircle size={18} className="text-primary" />
                                            Varför inga "stora" events?
                                        </h3>
                                        <p className="text-muted-foreground">
                                            Det finns redan Ticketmaster för det. Vi vill fånga det som faller mellan stolarna. Den spontana fotbollsmatchen, brädspelkvällen på puben eller en promenad i solen.
                                        </p>
                                    </div>
                                    <div className="bg-card p-6 rounded-xl border border-border">
                                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                            <HelpCircle size={18} className="text-primary" />
                                            Tänk om ingen kommer?
                                        </h3>
                                        <p className="text-muted-foreground">
                                            Det är charmen med spontanitet. Ibland blir det fullsatt, ibland blir det bara du och en till. Ingen press. Bara möjligheter.
                                        </p>
                                    </div>
                                    <div className="bg-card p-6 rounded-xl border border-border">
                                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                            <HelpCircle size={18} className="text-primary" />
                                            Kostar det något?
                                        </h3>
                                        <p className="text-muted-foreground">
                                            Nej. Att träffa nya vänner ska inte kosta pengar. Grundfunktionen är och förblir gratis.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* CALL TO ACTION */}
                        <section className="py-24 px-6 text-center">
                            <div className="max-w-3xl mx-auto relative">
                                <h2 className="text-4xl md:text-5xl font-bold mb-8">Vågar du vara spontan?</h2>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    <Link to="/" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-10 py-4 rounded-full font-bold text-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 hover:-translate-y-1">
                                        Hitta något nu
                                    </Link>
                                    <Link to="/create" className="inline-flex items-center justify-center gap-2 bg-background border-2 border-primary/20 text-foreground px-10 py-4 rounded-full font-bold text-lg hover:bg-muted transition-all">
                                        Skapa något nu
                                    </Link>
                                </div>
                                <p className="mt-8 text-muted-foreground text-sm opacity-60">
                                    Livet händer utanför skärmen.
                                </p>
                            </div>
                        </section>
                    </div>
                )}

                {/* 2. HALL OF FAME TAB */}
                {activeTab === 'hall-of-fame' && (
                    <div className="px-6 max-w-6xl mx-auto">
                        <HallOfFame />
                    </div>
                )}

                {/* 3. FEEDBACK TAB */}
                {activeTab === 'feedback' && (
                    <div className="px-6">
                        <Feedback />
                    </div>
                )}
            </div>
        </Layout>
    );
}
