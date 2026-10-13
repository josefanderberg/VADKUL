'use client';

/**
 * Vän-inbjudan från profilen (?van=<uid>, utils/friendInvite): "{Namn}
 * bjuder in dig till VADKUL" med Bli vänner. Ett eget kort mitt på skärmen
 * i stället för en botten-banner - inbjudan är ett engångsbesked som någon
 * skickat personligen, och botten-slotten delas redan av fem prompter.
 * Samma mörka platta + guldaccent som inloggningsrutan (AuthModal), så
 * steget dit känns som samma flöde.
 */
interface FriendInviteCardProps {
    name: string | null;
    photoURL: string | null;
    busy: boolean;
    onAccept: () => void;
    onDismiss: () => void;
}

export default function FriendInviteCard({ name, photoURL, busy, onAccept, onDismiss }: FriendInviteCardProps) {
    const vem = name ?? 'En vän';
    return (
        <div className="fixed inset-0 z-[1250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onDismiss}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="van-inbjudan-titel"
                className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                {photoURL ? (
                    <img src={photoURL} alt="" className="w-16 h-16 rounded-full object-cover bg-slate-700 ring-2 ring-[#FECC02]" />
                ) : (
                    <span className="w-16 h-16 rounded-full bg-[#006AA7] text-white text-2xl font-black flex items-center justify-center ring-2 ring-[#FECC02]" aria-hidden>
                        {vem.trim().charAt(0).toUpperCase()}
                    </span>
                )}
                <div>
                    <h2 id="van-inbjudan-titel" className="text-xl font-black text-white">
                        {vem} bjuder in dig till VADKUL
                    </h2>
                    <p className="text-sm font-semibold text-white/70 mt-1.5">
                        Bli vänner så ser ni vad den andra ska på - och ni får en stjärna var ⭐ att sätta på ett event.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onAccept}
                    disabled={busy}
                    className="w-full rounded-full bg-[#FECC02] text-slate-900 py-3 text-sm font-black hover:bg-[#ffd633] active:scale-[0.99] disabled:opacity-60 transition"
                >
                    {busy ? 'Blir vänner…' : 'Bli vänner'}
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    disabled={busy}
                    className="text-xs font-bold text-white/50 hover:text-white/80 transition-colors"
                >
                    Inte nu
                </button>
            </div>
        </div>
    );
}
