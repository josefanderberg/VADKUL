'use client';

import { Fragment, useMemo } from 'react';
import { splitTextLinks } from '@/utils/textLinks';

/**
 * Fri text med KLICKBARA LÄNKAR (Josef 4/11: "gör så att länkarna blir
 * klickbara ... Den har ju 2 Spotify-länkar bland annat") - delningen bor i
 * kontraktet (textLinks) så appen länkar exakt samma text. Länkarna öppnas i
 * ny flik; klicket stoppas från att bubbla så kortets "tryck på beskrivningen
 * = fäll ut mer" (handleContentClick) inte fyrar ovanpå länkhoppet. Kortets
 * gestkod känner redan igen <a> som interaktiv yta (EventCard onPointerDown),
 * så ett tryck på länken blir aldrig ett ark-drag.
 *
 * nofollow: beskrivningarna är skrapad/användarskapad text - vi går inte i
 * god för länkarna.
 */
export default function LinkedText({ text, linkClassName }: { text: string; linkClassName?: string }) {
    const segments = useMemo(() => splitTextLinks(text), [text]);
    return (
        <>
            {segments.map((seg, i) => seg.href ? (
                <a
                    key={i}
                    href={seg.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={(e) => e.stopPropagation()}
                    className={linkClassName ?? 'text-[#006AA7] dark:text-sky-400 font-bold underline underline-offset-2 decoration-[#006AA7]/40 dark:decoration-sky-400/40 hover:decoration-current break-all'}
                >
                    {seg.text}
                </a>
            ) : (
                <Fragment key={i}>{seg.text}</Fragment>
            ))}
        </>
    );
}
