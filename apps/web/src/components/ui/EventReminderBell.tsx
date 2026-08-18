'use client';

import { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import type { LinkEvent } from '../../types';
import {
    remainingReminderTimes,
    subscribeEventReminder,
    enableEventReminder,
    disableEventReminder,
    type ReminderTime,
} from '../../services/eventReminderService';

// Läsbara etiketter för bekräftelsetoasten ("vi säger till 3 h före, …").
const TIME_LABELS: Record<ReminderTime, string> = {
    '8h': '8 h före',
    '3h': '3 h före',
    '1h': '1 h före',
    start: 'vid start',
};

// "8 h före, 3 h före och vid start" — naturlig svensk uppräkning.
function listTimes(times: ReminderTime[]): string {
    const labels = times.map(t => TIME_LABELS[t]);
    if (labels.length === 1) return labels[0];
    return `${labels.slice(0, -1).join(', ')} och ${labels[labels.length - 1]}`;
}

/**
 * Notisklockan på eventkortet — på/av-toggle för påminnelser (8 h/3 h/1 h före
 * samt vid start). Kräver riktig inloggning (AuthContext ger user = null för
 * anonyma sessioner), samma mönster som anmäl-knappen: utloggad → 🔑-toast.
 *
 * Event UTAN klockslag (hasSpecificTime === false — samma signal som
 * NO_TIME_PAST_HOUR/isEventPast-dämpningen bygger på): tiden är bara ett datum
 * (00:00), så "X h före"/"vid start" skulle räknas från midnatt och pricka
 * fel eller väcka folk mitt i natten. Ägarvänligt val: klockan INAKTIVERAS
 * där i stället för att lova en notis vi inte kan pricka.
 */
export default function EventReminderBell({ linkEvent }: { linkEvent: LinkEvent }) {
    const { user } = useAuth();
    const [isOn, setIsOn] = useState(false);
    const [busy, setBusy] = useState(false);

    // Lyssna BARA på användarens eget dokument (mer tillåter reglerna inte).
    useEffect(() => {
        setIsOn(false);
        if (!user) return;
        const unsub = subscribeEventReminder(linkEvent.id, user.uid, setIsOn);
        return () => unsub();
    }, [linkEvent.id, user]);

    const hasTime = linkEvent.hasSpecificTime !== false;
    // Fönster som fortfarande hinns med — tom efter start (då finns inget att
    // påminna om). Räknas per render; kortet re-renderas ändå var 30:e sekund
    // av förälderns now-ticker.
    const remaining = hasTime ? remainingReminderTimes(linkEvent.time, Date.now()) : [];
    // Redan PÅ ska alltid gå att stänga av — bara PÅ-slag spärras.
    const disabled = !isOn && (!hasTime || remaining.length === 0);

    const title = isOn
        ? 'Påminnelser på — klicka för att stänga av'
        : !hasTime
            ? 'Eventet saknar klockslag — påminnelser går inte att pricka'
            : remaining.length === 0
                ? 'Eventet har redan börjat'
                : `Få påminnelser ${listTimes(remaining)}`;

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled || busy) return;
        if (!user) {
            toast('Logga in för att få påminnelser.', { icon: '🔑' });
            return;
        }
        setBusy(true);
        try {
            if (isOn) {
                await disableEventReminder(linkEvent.id, user.uid);
                setIsOn(false);
                toast('Påminnelser av.', { icon: '🔕' });
            } else {
                const times = await enableEventReminder(
                    { id: linkEvent.id, time: linkEvent.time },
                    user.uid,
                );
                if (times.length === 0) {
                    // Hann passera starten mellan render och klick.
                    toast('Eventet har redan börjat — inget att påminna om.');
                } else {
                    setIsOn(true);
                    toast.success(`Påminnelser på — vi säger till ${listTimes(times)}. 🔔`);
                }
            }
        } catch (err) {
            console.error('Kunde inte ändra påminnelsen:', err);
            toast.error('Kunde inte ändra påminnelsen. Försök igen.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={disabled}
            aria-pressed={isOn}
            aria-label={title}
            title={title}
            className={`w-8 h-8 rounded-full border transition-all active:scale-[0.95] flex items-center justify-center shrink-0 ${
                isOn
                    ? 'bg-sky-50 border-sky-200 text-[#006AA7] dark:bg-sky-950/30 dark:border-sky-900/50 dark:text-sky-400'
                    : disabled
                        ? 'bg-white border-slate-200 text-slate-300 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600'
                        : 'bg-white border-slate-200 text-slate-400 hover:text-[#006AA7] hover:border-sky-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 dark:hover:text-sky-400 dark:hover:border-sky-900/50'
            }`}
        >
            {isOn
                ? <BellRing size={15} fill="currentColor" />
                : <Bell size={15} />}
        </button>
    );
}
