import Layout from '../components/layout/Layout';
import { Briefcase, TrendingUp, ShieldCheck, Globe, Lightbulb, Search, Handshake, Users, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
    return (
        <Layout>
            <div className="min-h-screen bg-background text-foreground">

                {/* HERO SECTION - "THE VISION" */}
                <section className="relative py-32 px-6 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/80 to-background dark:from-indigo-950/20 dark:to-background -z-10" />
                    <div className="max-w-4xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
                            <Lightbulb size={14} />
                            Vår Vision
                        </div>
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
                            Framtidens Sociala <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 animate-gradient-x">
                                Infrastruktur
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
                            Vi bygger inte bara en app för att hitta events. <br className="hidden md:block" />
                            Vi bygger <strong className="text-foreground font-semibold">fundamentet</strong> för ett samhälle där mänsklig kontakt är den viktigaste valutan.
                        </p>
                    </div>
                </section>

                {/* HOW IT WORKS - "THE BASICS" */}
                <section className="py-20 px-6 bg-muted/30 border-y border-border/50">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-bold mb-4">Så funkar det</h2>
                            <p className="text-muted-foreground max-w-xl mx-auto">
                                Vi har skalat bort allt brus. Inga likes, inget scrollande, bara riktiga möten.
                            </p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all text-center group">
                                <div className="w-16 h-16 w-max mx-auto bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Search size={32} />
                                </div>
                                <h3 className="text-xl font-bold mb-3">1. Hitta</h3>
                                <p className="text-muted-foreground">
                                    Se vad som händer runt hörnet. Allt från spontana brädspel till löprundor dyker upp i realtid på kartan.
                                </p>
                            </div>
                            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all text-center group">
                                <div className="w-16 h-16 w-max mx-auto bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Handshake size={32} />
                                </div>
                                <h3 className="text-xl font-bold mb-3">2. Delta</h3>
                                <p className="text-muted-foreground">
                                    Boka din plats med ett klick. Inga krångliga processer. Det är bara att dyka upp och vara med.
                                </p>
                            </div>
                            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all text-center group">
                                <div className="w-16 h-16 w-max mx-auto bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Users size={32} />
                                </div>
                                <h3 className="text-xl font-bold mb-3">3. Skapa</h3>
                                <p className="text-muted-foreground">
                                    Saknar du något? Bli en lokal ledare. Skapa ditt eget event på nolltid och låt andra hitta dig.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* THE PILLARS - "THE WHY" */}
                <section className="py-24 px-6">
                    <div className="max-w-6xl mx-auto space-y-24">

                        {/* PILLAR 1: SAMHÄLLSMOTORN */}
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-6 order-2 md:order-1">
                                <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-sm">
                                    <Globe size={16} /> Demokrati & Gemenskap
                                </div>
                                <h2 className="text-4xl font-bold tracking-tight">Samhällsmotorn</h2>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Vi flyttar fokus från digital ensamhet till <strong>fysisk samhällsnytta</strong>. Genom att effektivisera möten mellan människor skapar vi ett dynamiskt flöde av idéer, kultur och gemenskap.
                                </p>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Ett samhälle där människor möts är ett tryggt, robust och innovativt samhälle. VADKUL är oljan i maskineriet som får staden att leva.
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-3xl h-80 w-full order-1 md:order-2 flex items-center justify-center">
                                {/* Placeholder for illustration */}
                                <Globe className="text-indigo-300 dark:text-indigo-700 w-40 h-40 opacity-50" />
                            </div>
                        </div>

                        {/* PILLAR 2: PERSONLIG UTVECKLING */}
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-3xl h-80 w-full flex items-center justify-center">
                                <TrendingUp className="text-emerald-300 dark:text-emerald-700 w-40 h-40 opacity-50" />
                            </div>
                            <div className="space-y-6">
                                <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-sm">
                                    <TrendingUp size={16} /> Växtvärk
                                </div>
                                <h2 className="text-4xl font-bold tracking-tight">Utvecklas som Människa</h2>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Komfortzonen är en vacker plats, men där växer ingenting. Vår plattform uppmanar dig att ta steget ut.
                                </p>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Varje nytt möte är en lektion. Varje event är en chans att vässa din sociala kompetens, lära dig något nytt och växa som individ. Livet är det ultimata utbildningsprogrammet.
                                </p>
                            </div>
                        </div>

                        {/* PILLAR 3: PASSIONSEKONOMIN */}
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-6 order-2 md:order-1">
                                <div className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider text-sm">
                                    <Briefcase size={16} /> Passionsekonomin
                                </div>
                                <h2 className="text-4xl font-bold tracking-tight">The Gig Economy of Fun</h2>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Vi ser en framtid där "värdskap" är ett yrke. Varför ska du inte kunna ta betalt för att dela med dig av din passion?
                                </p>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    I vår roadmap ligger möjligheten för kreatörer, guider och entusiaster att skapa mikro-jobb. Håll i en workshop, en guidad tur eller en matlagningskurs. Vi skapar jobb där de inte fanns tidigare.
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-3xl h-80 w-full order-1 md:order-2 flex items-center justify-center">
                                <Briefcase className="text-amber-300 dark:text-amber-700 w-40 h-40 opacity-50" />
                            </div>
                        </div>

                    </div>
                </section>

                {/* PHILOSOPHY & FAQ - "THE MINDSET" */}
                <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900/50">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-16">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mb-6">
                                <ShieldCheck size={32} />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Vår Filosofi: Sunt Förnuft</h2>
                            <p className="text-xl text-muted-foreground">
                                Frihet under ansvar. Vi bygger en plattform för vuxna människor.
                            </p>
                        </div>

                        <div className="grid gap-6">
                            <div className="bg-card p-6 rounded-xl border border-border">
                                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <HelpCircle size={18} className="text-primary" />
                                    Är det säkert att träffa främlingar?
                                </h3>
                                <p className="text-muted-foreground">
                                    Att möta nya människor innebär alltid en viss risk, precis som att gå över gatan. Vi uppmanar till sunt förnuft. Träffas alltid på offentliga platser första gången. I framtiden kommer vi införa verifiering med BankID för extra trygghet.
                                </p>
                            </div>
                            <div className="bg-card p-6 rounded-xl border border-border">
                                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <HelpCircle size={18} className="text-primary" />
                                    Tänk om ingen kommer på mitt event?
                                </h3>
                                <p className="text-muted-foreground">
                                    Det är ingen fara! VADKUL handlar om låga trösklar. Ibland blir det fullsatt, ibland blir det bara du och en till. Båda är värdefulla möten. Det viktigaste är att du tog initiativet.
                                </p>
                            </div>
                            <div className="bg-card p-6 rounded-xl border border-border">
                                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <HelpCircle size={18} className="text-primary" />
                                    Kostar det något?
                                </h3>
                                <p className="text-muted-foreground">
                                    Grundfunktionen att hitta och skapa enkla events är och förblir gratis. Vi tror på att demokratisera nöje. I framtiden kan det tillkomma premiumfunktioner eller biljettförsäljning för större events.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CALL TO ACTION */}
                <section className="py-24 px-6 text-center">
                    <div className="max-w-3xl mx-auto relative">
                        <h2 className="text-4xl md:text-5xl font-bold mb-8">Redo att bryta mönstret?</h2>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-10 py-4 rounded-full font-bold text-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 hover:-translate-y-1">
                                Utforska Kartan
                            </Link>
                            <Link to="/create" className="inline-flex items-center justify-center gap-2 bg-background border-2 border-primary/20 text-foreground px-10 py-4 rounded-full font-bold text-lg hover:bg-muted transition-all">
                                Skapa Event
                            </Link>
                        </div>
                        <p className="mt-8 text-muted-foreground text-sm opacity-60">
                            By joining, you become part of the solution.
                        </p>
                    </div>
                </section>

            </div>
        </Layout>
    );
}
