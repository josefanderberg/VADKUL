'use client';

import { User, MessageSquare, Bell, Plus, Search } from 'lucide-react';

export default function FloatingNavbar() {
    return (
        <div className="absolute top-6 left-0 right-0 z-[1000] px-4 pointer-events-none">
            <div className="flex justify-between items-center w-full max-w-lg mx-auto">
                {/* Left side: Profile */}
                <button className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg pointer-events-auto hover:bg-white transition-colors">
                    <User size={24} className="text-slate-800" />
                </button>

                {/* Right side: Actions */}
                <div className="flex gap-3">
                    <button className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg pointer-events-auto hover:bg-white transition-colors relative">
                        <MessageSquare size={24} className="text-slate-800" />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>
                    <button className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg pointer-events-auto hover:bg-white transition-colors relative">
                        <Bell size={24} className="text-slate-800" />
                    </button>
                    <button className="bg-green-500 p-3 rounded-full shadow-lg pointer-events-auto hover:bg-green-400 transition-colors">
                        <Plus size={24} className="text-white" />
                    </button>
                    <button className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg pointer-events-auto hover:bg-white transition-colors">
                        <Search size={24} className="text-slate-800" />
                    </button>
                </div>
            </div>
        </div>
    );
}
