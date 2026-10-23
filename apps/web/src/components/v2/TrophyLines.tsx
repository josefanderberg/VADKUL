// Troféerna som en diskret rad under namnet (ägarbeslut 23/10, Josef:
// "det behöver kanske inte vara synligt på det sättet" - ingen pokal vid
// namnet): "✦ Förtur till appen · nr 1 av 4". Data = users/{uid}.trophies
// via readTrophies (packages/kontrakt/src/trophies.ts) - inga egna läsningar.
import { describeTrophy, type TrophyMirror } from '@vadkul/kontrakt';

export default function TrophyLines({ trophies, className = '' }: {
    trophies: readonly TrophyMirror[];
    className?: string;
}) {
    if (trophies.length === 0) return null;
    return (
        <>
            {trophies.map(t => {
                const d = describeTrophy(t);
                return (
                    <p key={t.id} title={d.text} className={`text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate ${className}`}>
                        {d.line}
                    </p>
                );
            })}
        </>
    );
}
