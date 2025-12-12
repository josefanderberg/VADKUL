import Layout from '../components/layout/Layout';
import { Briefcase, TrendingUp, ShieldCheck, Globe, ArrowRight, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
    return (
        <Layout>
            <div className="min-h-screen bg-background text-foreground">

                {/* HERO SECTION - "THE PITCH" */}
                <section className="relative py-32 px-6 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/80 to-background dark:from-indigo-950/20 dark:to-background -z-10" />
                    <div className="max-w-4xl mx-auto text-center space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-bold uppercase tracking-wider mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Lightbulb size={14} />
                            Vision 2030
                        </div>
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
                            Det här är <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 animate-gradient-x">
                                Årets Affärsidé
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
                            Vi bygger inte bara en app för att hitta vänner. <br className="hidden md:block" />
                            Vi bygger <strong className="text-foreground font-semibold">infrastrukturen</strong> för mänsklig utveckling och ett rikare samhälle.
                        </p>
                    </div>
                </section>

                {/* THE PILLARS */}
                <section className="py-20 px-6">
                    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-20">

                        {/* PILLAR 1: SAMHÄLLSMOTORN */}
                        <div className="group space-y-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                <Globe size={32} strokeWidth={1.5} />
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight">Samhällsmotorn</h2>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Vi flyttar fokus från ensamhet till <strong>samhällsnytta</strong>. Genom att effektivisera möten mellan människor skapar vi ett dynamiskt flöde av idéer, kultur och gemenskap.
                            </p>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Ett samhälle där människor möts är ett tryggt, robust och innovativt samhälle. VADKUL är oljan i maskineriet som får staden att leva.
                            </p>
                        </div>

                        {/* PILLAR 2: PERSONLIG UTVECKLING */}
                        <div className="group space-y-6">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                <TrendingUp size={32} strokeWidth={1.5} />
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight">Utvecklas som Människa</h2>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Komfortzonen är en vacker plats, men där växer ingenting. Vår plattform uppmanar dig att ta steget ut.
                            </p>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Varje nytt möte är en lektion. Varje event är en chans att vässa din sociala kompetens, lära dig något nytt och växa som individ. Livet är det ultimata utbildningsprogrammet.
                            </p>
                        </div>

                        {/* PILLAR 3: FRAMTIDENS JOBB */}
                        <div className="group space-y-6">
                            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                <Briefcase size={32} strokeWidth={1.5} />
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight">The Gig Economy of Fun</h2>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Vi ser en framtid där "värdskap" är ett yrke. Varför ska du inte kunna ta betalt för att dela med dig av din passion?
                            </p>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                I framtiden kommer VADKUL möjliggöra för kreatörer, guider och entusiaster att skapa mikro-jobb. Håll i en workshop, en guidad tur eller en matlagningskurs. Vi skapar jobb där de inte fanns tidigare.
                            </p>
                        </div>

                        {/* PILLAR 4: SUNT FÖRNUFT */}
                        <div className="group space-y-6">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                <ShieldCheck size={32} strokeWidth={1.5} />
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight">Trygghet & Sunt Förnuft</h2>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Vi bygger på tillit, men vi är inte naiva. Vår filosofi är enkel: <strong>Frihet under ansvar.</strong>
                            </p>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Vi tror på människors förmåga att använda sunt förnuft. Vi tillhandahåller verktygen för verifiering och säkerhet, men i grunden bygger vi en community av vuxna människor som behandlar varandra med respekt.
                            </p>
                        </div>

                    </div>
                </section>

                {/* CALL TO ACTION */}
                <section className="py-24 px-6 text-center">
                    <div className="max-w-3xl mx-auto bg-card border border-border p-12 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>

                        <h2 className="text-3xl md:text-4xl font-bold mb-6 relative z-10">Bli en del av rörelsen</h2>
                        <p className="text-xl text-muted-foreground mb-10 leading-relaxed relative z-10">
                            Det här är bara början. Var med och forma framtidens sociala landskap.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
                            <Link to="/" className="inline-flex items-center justify-center gap-2 bg-foreground text-background px-8 py-4 rounded-full font-bold text-lg hover:bg-foreground/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                                Utforska Platformen
                            </Link>
                            <Link to="/create" className="inline-flex items-center justify-center gap-2 bg-primary/10 text-primary px-8 py-4 rounded-full font-bold text-lg hover:bg-primary/20 transition-all">
                                Skapa ett Event <ArrowRight size={20} />
                            </Link>
                        </div>
                    </div>
                </section>

            </div>
        </Layout>
    );
}
