import { MapPin, Clock, Ticket, Users } from 'lucide-react';

// Inforaden under/i en eventrad: plats · tid · pris · antal, i den ordningen,
// med samma ikoner som eventkortets närhetslista. Delas av daglistans rader
// (DayFilteredList) och spotlight-raderna (CityVadkulSpotlight) så VADKUL-
// skapade event ser ut som de andra (Josef 6/9). Allt är strängar →
// deterministiskt vid SSR.
export default function EventInfoRow({ place, when, price, attendees }: {
    place: string;
    /** "kl 18.30" i daglistan (dagen står i rubriken), "Idag 18.30" i
     *  spotlighten (ingen dagrubrik). null = inget klockslag. */
    when: string | null;
    price: string | null;
    attendees: number;
}) {
    return (
        <div className="flex items-center gap-x-2 text-[11px] font-bold text-slate-500 dark:text-zinc-400 overflow-hidden">
            <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin size={11} className="text-[#006AA7] dark:text-sky-400 shrink-0" />
                <span className="truncate">{place}</span>
            </span>
            {when && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Clock size={11} className="text-[#006AA7] dark:text-sky-400" />
                    {when}
                </span>
            )}
            {price && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Ticket size={11} className="text-[#006AA7] dark:text-sky-400" />
                    {price}
                </span>
            )}
            {attendees > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Users size={11} className="text-[#006AA7] dark:text-sky-400" />
                    {attendees} kommer
                </span>
            )}
        </div>
    );
}
