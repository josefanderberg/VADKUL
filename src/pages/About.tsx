import Layout from '../components/layout/Layout';
import { Sparkles, Map, Users, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
    return (
        <Layout>
            <div className="min-h-screen bg-white dark:bg-slate-900">

                {/* HERO SECTION */}
                <section className="relative py-20 px-6 overflow-hidden">
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
                        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 group">
                            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                                <Sparkles size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Var Spontan</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                Inga långa planeringshorisonter. Se vad som händer just nu eller ikväll. Livet är det som händer när du vågar säga "ja".
                            </p>
                        </div>

                        {/* GEMENSKAP */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 group">
                            <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                                <Users size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Träffa Folk</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                Vidga din mxcirkel. VADKUL handlar om att föra samman människor genom gemensamma intressen, från spela brädspel till att löpträna.
                            </p>
                        </div>

                        {/* ENKELT */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 group">
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

                    <div className="max-w-4xl mx-auto text-center relative z-10">
                        <h2 className="text-3xl md:text-4xl font-bold mb-8">Varför startade vi VADKUL?</h2>
                        <p className="text-lg md:text-xl text-slate-300 mb-10 leading-relaxed">
                            Vi tröttnade på att sitta hemma och undra "vad händer ikväll?". Sociala medier visar vad andra <i>har</i> gjort, men hjälper oss sällan att mötas <i>nu</i>. Vi vill bryta ensamheten, sänka tröskeln för att umgås och göra staden till ditt vardagsrum.
                        </p>

                        <div className="inline-block p-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500">
                            <Link to="/create" className="flex items-center gap-2 bg-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-800 transition-colors">
                                Skapa ditt första event <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>
                </section>

            </div>
        </Layout>
    );
}
