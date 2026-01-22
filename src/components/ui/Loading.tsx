

export default function Loading({ text = "Laddar...", fullScreen = false }: { text?: string, fullScreen?: boolean }) {

    // Spinner Component
    const Spinner = ({ size = "md" }: { size?: "md" | "lg" }) => {
        const dims = size === "lg" ? "w-16 h-16 border-[6px]" : "w-10 h-10 border-4";
        return (
            <div className={`relative ${size === "lg" ? "w-16 h-16" : "w-10 h-10"}`}>
                {/* Track */}
                <div className={`absolute inset-0 ${dims} border-primary/20 rounded-full`}></div>
                {/* Spinning Segment */}
                <div className={`absolute inset-0 ${dims} border-primary border-t-transparent rounded-full animate-spin`}></div>
            </div>
        );
    };

    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                <div className="mb-6">
                    <Spinner size="lg" />
                </div>
                <p className="text-xl font-bold text-foreground animate-pulse tracking-wide">{text}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-8">
            <div className="mb-4">
                <Spinner size="md" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">{text}</p>
        </div>
    );
}
