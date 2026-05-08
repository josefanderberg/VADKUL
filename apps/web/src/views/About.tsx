import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { TrendingUp, ShieldCheck, Globe, Lightbulb, Search, Handshake, Users, HelpCircle, Trophy, MessageSquarePlus, Info as InfoIcon, ArrowLeft, Heart, Sparkles, Map as MapIcon, Calendar } from 'lucide-react';
import Link from 'next/link';
import HallOfFame from '../components/about/HallOfFame';
import Feedback from '../components/about/Feedback';

export default function About() {
    const [activeTab, setActiveTab] = useState<'info' | 'hall-of-fame' | 'feedback'>('info');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (window.location.hash === '#hall-of-fame') setTimeout(() => setActiveTab('hall-of-fame'), 0);
            if (window.location.hash === '#feedback') setTimeout(() => setActiveTab('feedback'), 0);
        }
    }, []);

    return (
        <Layout>
            <div className="min-h-screen bg-background text-foreground pb-20">

                {/* SUB-NAVBAR */}
                <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border">
                    <div className="max-w-md mx-auto flex p-1">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'info'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <InfoIcon size={18} /> Berättelsen
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

                {activeTab === 'info' && (
                    <div className="animate-in fade-in duration-700">
                        
                        {/* HERO SECTION - THE SILENCE */}
                        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden px-6">
                            <div className="absolute inset-0 bg-neutral-900">
                                <img 
                                    src="/assets/about/magic_of_now.png" 
                                    className="w-full h-full object-cover opacity-60 mix-blend-overlay"
                                    alt="Human connection"
                                />
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-900/40 to-background" />
                            </div>
                            
                            <div className="relative max-w-4xl mx-auto text-center space-y-8 py-20">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 text-xs font-bold uppercase tracking-[0.2em]">
                                    <Sparkles size={14} className="text-yellow-400" />
                                    Vår Berättelse
                                </div>
                                <h1 className="text-5xl md:text-9xl font-black text-white tracking-tighter leading-[0.85] drop-shadow-2xl">
                                    En protest <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-400 to-primary animate-pulse">
                                        mot tystnaden.
                                    </span>
                                </h1>
                                <p className="text-xl md:text-3xl text-white/90 max-w-3xl mx-auto leading-relaxed font-light italic">
                                    "Vi har blivit experter på att ansluta oss till allt, <br className="hidden md:block" />
                                    men har aldrig känt oss mer avskärmade."
                                </p>
                            </div>
                        </section>

                        {/* SECTION 1 - AMBITION UPGRADE */}
                        <section className="py-32 px-6 max-w-6xl mx-auto">
                            <div className="grid md:grid-cols-2 gap-20 items-center">
                                <div className="space-y-10">
                                    <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none text-foreground">
                                        Spontanitet <br />är frihetens <br /><span className="text-primary">puls.</span>
                                    </h2>
                                    <div className="space-y-8 text-xl text-muted-foreground leading-relaxed font-serif italic">
                                        <p>
                                            Idag är våra liv optimerade logistikkedjor. Vi bokar in vår fritid veckor i förväg, som om glädje vore en post i ett Excel-ark. Men var tog livet vägen? Det som händer när planeringen tar slut?
                                        </p>
                                        <p>
                                            VADKUL är inte ytterligare en app. Det är en <strong>kompass</strong>. En väg tillbaka till det oscriptade mötet – det som inte kräver ett medlemskap eller en biljett, bara din närvaro.
                                        </p>
                                    </div>
                                </div>
                                <div className="relative group">
                                    <div className="absolute -inset-6 bg-primary/20 rounded-[3rem] blur-3xl group-hover:bg-primary/30 transition-all duration-700" />
                                    <div className="relative bg-card rounded-[3rem] border border-border p-1 shadow-2xl overflow-hidden aspect-[4/5] flex flex-col justify-end">
                                        <img 
                                            src="/assets/about/true_community.png"
                                            className="absolute inset-0 w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
                                            alt="Spontaneity"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                                        <div className="relative z-20 p-10 space-y-3">
                                            <p className="text-white font-black text-3xl uppercase tracking-tighter">Livet, oredigerat.</p>
                                            <p className="text-white/80 text-lg">De bästa minnena skapas aldrig i en kalender.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* SECTION 2 - THE HEARTBEAT (BOLD AMBITION) */}
                        <section className="relative py-48 overflow-hidden text-white">
                            <div className="absolute inset-0 z-0">
                                <img 
                                    src="/assets/about/city_heartbeat.png"
                                    className="w-full h-full object-cover scale-110"
                                    alt="City heartbeat"
                                />
                                <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-[1px]" />
                            </div>
                            
                            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-16">
                                <div className="mx-auto w-28 h-28 rounded-full bg-primary/30 backdrop-blur-2xl border border-primary/50 flex items-center justify-center animate-pulse">
                                    <Sparkles size={56} className="text-primary fill-primary" />
                                </div>
                                <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.85]">
                                    Staden är din scen. <br />Vi tänder bara <br /><span className="text-primary">strålkastarna.</span>
                                </h2>
                                <p className="text-2xl md:text-4xl text-white/90 leading-tight font-light max-w-4xl mx-auto">
                                    Varje prick på kartan är ett löfte om mänsklig kontakt. Vi visualiserar stadens dolda liv för att du ska kunna kliva ut ur bubblan och in i verkligheten.
                                </p>
                            </div>
                        </section>

                        {/* SECTION 3 - THE DUFACTURE */}
                        <section className="py-32 px-6 bg-slate-50 dark:bg-slate-900/40">
                            <div className="max-w-6xl mx-auto">
                                <div className="text-center mb-32 space-y-6">
                                    <h2 className="text-5xl md:text-7xl font-black tracking-tighter">Ett fönster till allt.</h2>
                                    <p className="text-2xl text-muted-foreground max-w-3xl mx-auto font-light">
                                        Vi raderar gränsen mellan den organiserade staden och det vilda grannskapet.
                                    </p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-16">
                                    {/* World 1: The official */}
                                    <div className="bg-card rounded-[3rem] border border-border p-12 flex flex-col items-center text-center space-y-10 shadow-xl hover:shadow-2xl transition-all duration-700 group">
                                        <div className="w-full h-80 rounded-[2rem] overflow-hidden">
                                            <img 
                                                src="/assets/about/official_venue.png"
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                                alt="Official events"
                                            />
                                        </div>
                                        <div className="space-y-6">
                                            <div className="inline-flex items-center gap-2 text-indigo-500 font-black uppercase tracking-widest text-sm">
                                                <Calendar size={18} /> Stadens Puls
                                            </div>
                                            <h3 className="text-4xl font-bold tracking-tight">Kulturens samlingsplats</h3>
                                            <p className="text-muted-foreground leading-relaxed text-lg">
                                                Vi samlar stadens officiella hjärtslag på en plats. Sport, teater och de stora mötena – vi inkluderar dem för att du ska veta att du aldrig behöver missa när staden rör på sig.
                                            </p>
                                        </div>
                                    </div>

                                    {/* World 2: The spontaneous (The Soul) */}
                                    <div className="bg-primary/5 rounded-[3rem] border-2 border-primary/30 p-12 flex flex-col items-center text-center space-y-10 shadow-xl hover:shadow-2xl transition-all duration-700 group relative overflow-hidden">
                                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
                                        <div className="w-full h-80 rounded-[2rem] overflow-hidden mb-4">
                                            <img 
                                                src="/assets/about/vadkul_soul.png"
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                                alt="VADKUL Själen"
                                            />
                                        </div>
                                        <div className="space-y-6">
                                            <div className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-widest text-sm">
                                                <Heart size={18} /> VADKUL-Själen
                                            </div>
                                            <h3 className="text-4xl font-bold tracking-tight">Gemenskap utanför murarna</h3>
                                            <p className="text-muted-foreground leading-relaxed text-lg font-medium text-foreground/80">
                                                Men vårt hjärta bankar för det <strong>oscriptade</strong>. För livet som händer mellan grannar helt utan stadgar eller inträdeskrav. Där du möts som människa, inte som medlem.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* SECTION 4 - THE MANIFESTO (AMBITION UPGRADE) */}
                        <section className="py-40 px-6">
                            <div className="max-w-4xl mx-auto bg-card border-l-8 border-primary rounded-r-[4rem] p-16 md:p-24 shadow-2xl relative overflow-hidden">
                                <div className="space-y-16 relative z-10">
                                    <h2 className="text-5xl font-black tracking-tighter">Vårt manifest för mänskligheten:</h2>
                                    <div className="space-y-12">
                                        <div className="flex gap-8">
                                            <div className="shrink-0 w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-black text-2xl">01</div>
                                            <div className="space-y-3">
                                                <h4 className="text-2xl font-black uppercase tracking-tighter">Närvaro framför planering.</h4>
                                                <p className="text-xl text-muted-foreground leading-relaxed">Vi bygger inte för framtiden. Vi bygger för <strong>nuet</strong>. Den vackraste planeringen är den som aldrig behövdes göras.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-8">
                                            <div className="shrink-0 w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-2xl">02</div>
                                            <div className="space-y-3">
                                                <h4 className="text-2xl font-black uppercase tracking-tighter">Radikal öppenhet.</h4>
                                                <p className="text-xl text-muted-foreground leading-relaxed">VADKUL raderar barriärer. Inga dörrvakter, inga avgifter, inga fördomar. Bara dörrar som står på vid gavel.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-8">
                                            <div className="shrink-0 w-16 h-16 rounded-3xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-black text-2xl">03</div>
                                            <div className="space-y-3">
                                                <h4 className="text-2xl font-black uppercase tracking-tighter text-primary">Det fysiska mötet är lyx.</h4>
                                                <p className="text-xl text-muted-foreground leading-relaxed font-bold italic text-foreground/90">
                                                    Vår framgång mäts i hur lite tid du spenderar hos oss. Vi vill vara kompassen som skickar dig bort från skärmen och in i staden, så att du kan se din nästa vän i ögonen.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* FINAL CTA */}
                        <section className="py-40 px-6 text-center bg-background relative overflow-hidden">
                            <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
                            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]" />
                            
                            <div className="max-w-2xl mx-auto space-y-12 relative z-10">
                                <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9]">
                                    Staden väntar. <br />Vågar du?
                                </h2>
                                <p className="text-xl text-muted-foreground italic font-serif">
                                    "Släpp kalendern för en stund. <br />Det vackraste i livet händer när vi inte planerar det."
                                </p>
                                <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
                                    <Link href="/" className="inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground px-12 py-5 rounded-full font-black text-xl hover:bg-primary/95 transition-all shadow-2xl hover:shadow-primary/40 hover:-translate-y-2 active:scale-95 group">
                                        <MapIcon size={24} className="group-hover:rotate-12 transition-transform" />
                                        Hitta något nu
                                    </Link>
                                    <Link href="/create" className="inline-flex items-center justify-center gap-3 bg-card border-2 border-border text-foreground px-12 py-5 rounded-full font-black text-xl hover:bg-muted transition-all hover:-translate-y-1 active:scale-95">
                                        Skapa magi
                                    </Link>
                                </div>
                                <div className="pt-12 text-muted-foreground/60 text-sm flex items-center justify-center gap-2">
                                    <Link href="/" className="flex items-center gap-1 hover:text-primary transition-colors">
                                        <ArrowLeft size={14} /> Tillbaka till kartan
                                    </Link>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* 2. HALL OF FAME TAB */}
                {activeTab === 'hall-of-fame' && (
                    <div className="px-6 max-w-6xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <HallOfFame />
                    </div>
                )}

                {/* 3. FEEDBACK TAB */}
                {activeTab === 'feedback' && (
                    <div className="px-6 mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <Feedback />
                    </div>
                )}
            </div>
        </Layout>
    );
}
