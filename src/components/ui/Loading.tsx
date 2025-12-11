import { Loader2 } from "lucide-react";

export default function Loading({ text = "Laddar...", fullScreen = false }: { text?: string, fullScreen?: boolean }) {
    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                <Loader2 size={48} className="text-primary animate-spin mb-4" />
                <p className="text-muted-foreground font-medium animate-pulse">{text}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-8">
            <Loader2 size={32} className="text-primary animate-spin mb-3" />
            <p className="text-muted-foreground text-sm font-medium">{text}</p>
        </div>
    );
}
