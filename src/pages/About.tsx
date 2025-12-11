import Layout from '../components/layout/Layout';
import { Sparkles, Map, Users, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
    return (
        <Layout>
            <div className="min-h-screen bg-white dark:bg-slate-900">

                {/* HERO SECTION */}
                <section className="relative py-40 px-6 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 -z-10" />
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">
                            Hitta på något <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">kul!</span>
                        </h1>
                        <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                            VADKUL är plattformen för dig som vill vara spontan. Hitta aktiviteter nära dig, träffa nya människor och skapa minnen – precis när det passar dig.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Link to="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-1">
                                Kolla Karta <Map size={20} />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* FEATURES GRID */}
                <section className="py-20 px-6 max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-10">

                        {/* SPONTANT */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 group animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
                            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                                <Sparkles size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Var Spontan</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                Inga långa planeringshorisonter. Se vad som händer just nu eller ikväll. Livet är det som händer när du vågar säga "ja".
                            </p>
                        </div>

                        {/* GEMENSKAP */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
                            <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                                <Users size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Träffaa Folk</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                Vidga din mxcirkel. VADKUL handlar om att föra samman människor genom gemensamma intressen, från spela brädspel till att löpträna.
                            </p>
                        </div>

                        {/* ENKELT */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
                            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                                <Heart size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Inkluderande</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                Alla är välkomna. Vår community bygger på respekt och glädje. Skapa öppna events där vem som helst kan känna sig inbjuden.
                            </p>
                        </div>

                    </div>
                </section>

                {/* MISSION STATEMENT */}
                <section className="bg-slate-900 text-white py-24 px-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                    <div className="max-w-4xl mx-auto text-center relative z-10 space-y-16">

                        {/* VARFÖR FINNS VI? */}
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">Varför finns VADKUL?</h2>
                            <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
                                Vi lever i en värld där vi är mer digitalt uppkopplade än någonsin, men där den fysiska ensamheten ökar. Vi tröttnade på att scrolla genom perfekta liv på sociala medier och sitta hemma och undra "vad händer ikväll?".
                            </p>
                            <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto mt-4">
                                VADKUL föddes ur en enkel idé: Tänk om det fanns ett sätt att se <i>allt</i> kul som händer runtomkring dig just nu? Ett verktyg som sänker tröskeln för att gå ut, som gör det lika naturligt att bjuda in till en spontan brädspelskväll som det är att "lajka" en bild.
                            </p>
                        </div>

                        {/* VÅR VISION */}
                        <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                            <h3 className="text-2xl font-bold text-indigo-400 mb-4">Vår Vision</h3>
                            <p className="text-slate-300 leading-relaxed italic">
                                "Att skapa ett varmare samhälle där främlingar blir grannar, och grannar blir vänner. Ett samhälle där ingen behöver känna sig ensam, och där staden vi bor i känns som vårt gemensamma vardagsrum."
                            </p>
                        </div>

                        {/* POTENTIALEN */}
                        <div className="grid md:grid-cols-2 gap-8 text-left">
                            <div className="space-y-4">
                                <h4 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">1</span>
                                    Bryta isolering
                                </h4>
                                <p className="text-slate-400">
                                    Genom att göra det enkelt att hitta och skapa små, lokala events kan vi motverka ofrivillig ensamhet. En promenad, en fika eller en fotbollsmatch kan vara starten på en livslång vänskap.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold">2</span>
                                    Levande städer
                                </h4>
                                <p className="text-slate-400">
                                    Vi vill att torg, parker och gemensamma utrymmen ska fyllas av liv. VADKUL hjälper till att aktivera lokalsamhället och gör staden tryggare och roligare att leva i.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold">3</span>
                                    Demokratisera nöje
                                </h4>
                                <p className="text-slate-400">
                                    Det ska inte krävas dyra biljetter eller exklusiva klubbar för att ha kul. De bästa minnena skapas ofta gratis, i gräset med en engångsgrill och ett gäng glada människor.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center text-sm font-bold">4</span>
                                    Trygg gemenskap
                                </h4>
                                <p className="text-slate-400">
                                    Genom verifierade profiler och ett gemensamt ansvar bygger vi en trygg plattform där alla vågar delta. Vi tror på människors godhet och vilja att mötas.
                                </p>
                            </div>
                        </div>

                        <div className="pt-8">
                            <div className="inline-block p-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:scale-105 transition-transform duration-300">
                                <Link to="/create" className="flex items-center gap-2 bg-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-800 transition-colors">
                                    Var med och bidra – Skapa event <ArrowRight size={18} />
                                </Link>
                            </div>
                            <p className="text-slate-500 text-sm mt-4">Det är helt gratis att använda.</p>
                        </div>
                    </div>
                </section>

            </div>
        </Layout>
    );
}
