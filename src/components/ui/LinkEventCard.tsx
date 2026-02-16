import { ExternalLink, Trash2 } from 'lucide-react';
import type { LinkEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { linkEventService } from '../../services/linkEventService';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface LinkEventCardProps {
    linkEvent: LinkEvent;
    isAdmin?: boolean;
    onDelete?: () => void;
}

export default function LinkEventCard({ linkEvent, isAdmin = false, onDelete }: LinkEventCardProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm(`Vill du ta bort "${linkEvent.title}"?`)) return;

        setIsDeleting(true);
        try {
            await linkEventService.delete(linkEvent.id);
            toast.success('Länk-event borttaget!');
            if (onDelete) onDelete();
        } catch (error) {
            console.error('Error deleting link event:', error);
            toast.error('Kunde inte ta bort länk-event');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleVisitSite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(linkEvent.url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="block h-full group relative">
            <div className="relative flex flex-col h-full">
                {/* The Card Itself */}
                <div className="flex flex-col h-full bg-card overflow-hidden rounded-lg border border-border opacity-75">

                    {/* Admin Delete Button */}
                    {isAdmin && (
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="absolute top-3 right-3 z-50 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg disabled:opacity-50"
                            title="Ta bort länk-event"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}

                    {/* Header with subtle grey background */}
                    <div className="relative w-full h-24 bg-muted/50 overflow-hidden">
                        {/* Pattern/Texture overlay */}
                        <div
                            className="absolute inset-0 opacity-10"
                            style={{
                                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")'
                            }}
                        />

                        {/* Badge */}
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wide flex items-center gap-1.5 bg-muted/80 text-muted-foreground">
                            <ExternalLink size={12} />
                            Externt Event
                        </div>

                        {/* Datum Badge */}
                        <div className="absolute bottom-3 right-3 bg-muted/80 text-muted-foreground font-medium px-2 py-1 rounded text-xs flex flex-col items-center leading-tight">
                            <span className="text-[9px] uppercase opacity-70">
                                {linkEvent.time.toLocaleDateString('sv-SE', { month: 'short' })}
                            </span>
                            <span className="text-lg">{linkEvent.time.getDate()}</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-1 p-5 pt-4">
                        <h3 className="font-bold text-card-foreground leading-tight mb-3 line-clamp-2 text-lg">
                            {linkEvent.title}
                        </h3>

                        {/* Info */}
                        <div className="space-y-2 mb-5">
                            <div className="flex items-center gap-2.5 text-xs font-medium text-muted-foreground">
                                <div className="p-1 rounded bg-muted/50">
                                    <ExternalLink size={14} strokeWidth={2} />
                                </div>
                                <span>{formatEventDate(linkEvent.time)}</span>
                            </div>

                            {/* Location */}
                            <div className="flex items-center gap-2.5 text-xs font-medium text-muted-foreground">
                                <div className="p-1 rounded bg-muted/50">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>
                                <span className="truncate">{linkEvent.locationName}</span>
                            </div>
                        </div>

                        {/* Bottom Section */}
                        <div className="mt-auto border-t border-border pt-4 flex items-center justify-between">
                            {/* Host Info (Dynamic) */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">
                                    Värd
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
                                        {linkEvent.hostName?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {linkEvent.hostName || 'Okänd'}
                                    </span>
                                </div>
                            </div>

                            {/* Visit Site Button */}
                            <button
                                onClick={handleVisitSite}
                                className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground font-medium rounded text-sm border border-border"
                            >
                                <span>Gå till sida</span>
                                <ExternalLink size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
