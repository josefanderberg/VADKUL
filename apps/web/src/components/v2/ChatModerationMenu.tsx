'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Flag, UserX, X } from 'lucide-react';
import type { ChatMessage } from '@/types';
import {
    CHAT_REPORT_REASONS,
    REPORT_RECIPIENT,
    chatReportDoc,
    chatReportMailto,
    genitive,
    senderLabel,
    type ChatKind,
    type ChatReportDoc,
    type ChatReportReason,
} from '@/utils/chatModeration';
import { blockUser, reportChatMessage } from '@/services/moderationService';

export interface ChatModerationTarget {
    message: ChatMessage;
    chat: ChatKind;
    /** Privata trådens id (= inbjudarens uid), null i publika chatten. */
    threadId: string | null;
}

type Step =
    | 'choose'
    | 'reason'
    | 'sending'
    | 'thanks'
    | 'reportFailed'
    | 'confirmBlock'
    | 'blocking'
    | 'blocked'
    | 'blockFailed';

/**
 * Meddelandemenyn i eventchatten - öppnas med ⋯ på någon annans bubbla i
 * EventChatPanel (publik och privat). Anmäl meddelandet eller blockera
 * avsändaren. Port av appens vadkul-app/src/components/ChattMeny.tsx: ETT
 * ark vars innehåll stegar (välj → skäl → tack, välj → blockera → klart) i
 * stället för en kedja av window.confirm. Logiken bor i utils/chatModeration,
 * Firestore-rören i services/moderationService.
 *
 * Monteras bara medan menyn är öppen (EventChatPanel renderar den
 * villkorat), så varje öppning börjar på första steget.
 *
 * z-[1300] = modalskiktet över eventkortet (1250), som BoostTierPicker.
 * Portalas till document.body: kortets bottensheet bär en transform och blir
 * annars containing block för fixed. Portalen ligger ändå i kortets
 * REACT-träd, så pointerdown/click stoppas här - annars drar eller fäller
 * kortets gestlogik ihop kortet bakom arket.
 */
export default function ChatModerationMenu({ target, eventId, eventTitle, myUid, onClose }: {
    target: ChatModerationTarget;
    eventId: string;
    eventTitle: string;
    myUid: string;
    onClose: () => void;
}) {
    const [step, setStep] = useState<Step>('choose');
    // Anmälan som inte gick fram - mejlreserven behöver samma innehåll.
    const [failedDoc, setFailedDoc] = useState<ChatReportDoc | null>(null);
    // Blockerade man redan från tack-steget visas inte knappen igen.
    const [didBlock, setDidBlock] = useState(false);

    const name = senderLabel(target.message);
    const busy = step === 'sending' || step === 'blocking';
    const close = () => { if (!busy) onClose(); };

    // Escape stänger (utom mitt i en skrivning).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onClose]);

    const sendReport = async (reason: ChatReportReason) => {
        const d = chatReportDoc({
            chat: target.chat,
            eventId,
            eventTitle,
            threadId: target.threadId,
            message: target.message,
            reason,
            reporterUid: myUid,
        });
        if (!d) { setStep('reportFailed'); return; }
        setStep('sending');
        try {
            await reportChatMessage(d);
            setStep('thanks');
        } catch (e) {
            console.warn('Kunde inte skicka anmälan:', e);
            setFailedDoc(d);
            setStep('reportFailed');
        }
    };

    const runBlock = async () => {
        setStep('blocking');
        try {
            await blockUser(myUid, { uid: target.message.senderId, name: target.message.senderName });
            setDidBlock(true);
            setStep('blocked');
        } catch (e) {
            console.warn('Kunde inte blockera:', e);
            setStep('blockFailed');
        }
    };

    let title: string;
    let content: ReactNode;
    switch (step) {
        case 'choose':
            title = `Meddelande från ${name}`;
            content = (
                <>
                    <p className="rounded-xl border border-border bg-slate-50 dark:bg-zinc-800/60 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 line-clamp-3 break-words">
                        {target.message.text}
                    </p>
                    <MenuButton onClick={() => setStep('reason')} icon={<Flag size={15} aria-hidden />}>
                        Anmäl meddelandet
                    </MenuButton>
                    <MenuButton tone="danger" onClick={() => setStep('confirmBlock')} icon={<UserX size={15} aria-hidden />}>
                        Blockera {name}
                    </MenuButton>
                </>
            );
            break;
        case 'reason':
        case 'sending':
            title = step === 'sending' ? 'Skickar anmälan…' : 'Vad är det som är fel?';
            content = (
                <>
                    <Hint>Anmälan går till VADKUL, inte till {name}.</Hint>
                    {CHAT_REPORT_REASONS.map(reason => (
                        <MenuButton key={reason} disabled={busy} onClick={() => void sendReport(reason)}>
                            {reason}
                        </MenuButton>
                    ))}
                    <MenuButton tone="muted" disabled={busy} onClick={() => setStep('choose')}>Tillbaka</MenuButton>
                </>
            );
            break;
        case 'thanks':
            title = 'Tack för din anmälan';
            content = (
                <>
                    <Hint>Vi går igenom den och tar bort innehåll som bryter mot våra regler. Meddelandet är dolt för dig.</Hint>
                    {!didBlock && (
                        <MenuButton tone="danger" onClick={() => setStep('confirmBlock')} icon={<UserX size={15} aria-hidden />}>
                            Blockera {name} också
                        </MenuButton>
                    )}
                    <MenuButton tone="primary" onClick={close}>Klar</MenuButton>
                </>
            );
            break;
        case 'reportFailed':
            title = 'Anmälan gick inte fram';
            content = (
                <>
                    <Hint>
                        {failedDoc
                            ? 'Mejla den till oss i stället, så tar vi hand om det.'
                            : `Mejla oss på ${REPORT_RECIPIENT} och berätta vilket meddelande det gäller, så tar vi hand om det.`}
                    </Hint>
                    {failedDoc && (
                        <a
                            href={chatReportMailto(failedDoc)}
                            className="w-full rounded-xl bg-[#006AA7] px-4 py-3 text-center text-sm font-black text-white hover:bg-[#005590] transition-colors"
                        >
                            Mejla anmälan
                        </a>
                    )}
                    <MenuButton onClick={() => setStep('reason')}>Försök igen</MenuButton>
                </>
            );
            break;
        case 'confirmBlock':
        case 'blocking':
            title = step === 'blocking' ? 'Blockerar…' : `Blockera ${name}?`;
            content = (
                <>
                    <Hint>
                        Du ser inte längre {genitive(name)} meddelanden i någon chatt, och är ni vänner tas vänskapen bort.
                        {' '}{name} får inget besked om det. Du kan häva blockeringen under Vänner i profilen.
                    </Hint>
                    <MenuButton tone="dangerSolid" disabled={busy} onClick={() => void runBlock()}>Blockera</MenuButton>
                    <MenuButton tone="muted" disabled={busy} onClick={close}>Avbryt</MenuButton>
                </>
            );
            break;
        case 'blocked':
            title = `${name} är blockerad`;
            content = (
                <>
                    <Hint>{genitive(name)} meddelanden är dolda för dig. Du hittar blockeringen under Vänner i profilen.</Hint>
                    <MenuButton tone="primary" onClick={close}>Klar</MenuButton>
                </>
            );
            break;
        case 'blockFailed':
            title = 'Kunde inte blockera';
            content = (
                <>
                    <Hint>Försök igen om en stund.</Hint>
                    <MenuButton onClick={() => setStep('confirmBlock')}>Försök igen</MenuButton>
                </>
            );
            break;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-6"
            onClick={(e) => { e.stopPropagation(); close(); }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="w-full sm:max-w-sm bg-card rounded-t-[2rem] sm:rounded-3xl shadow-2xl border border-border/20 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-4 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-base font-black text-black dark:text-white break-words min-w-0">{title}</h3>
                    <button
                        type="button"
                        onClick={close}
                        disabled={busy}
                        aria-label="Stäng"
                        className="w-8 h-8 -mr-1 -mt-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 disabled:opacity-40 transition-colors shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="flex flex-col gap-2">{content}</div>
            </div>
        </div>,
        document.body,
    );
}

function Hint({ children }: { children: ReactNode }) {
    return <p className="text-xs font-semibold leading-relaxed text-slate-500 dark:text-zinc-400 mb-1">{children}</p>;
}

function MenuButton({ children, onClick, tone = 'default', disabled, icon }: {
    children: ReactNode;
    onClick: () => void;
    tone?: 'default' | 'danger' | 'dangerSolid' | 'primary' | 'muted';
    disabled?: boolean;
    icon?: ReactNode;
}) {
    const toneClass = {
        default: 'border border-border bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700',
        danger: 'border border-border bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
        dangerSolid: 'bg-red-600 text-white hover:bg-red-700',
        primary: 'bg-[#006AA7] text-white hover:bg-[#005590]',
        muted: 'bg-slate-100 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700',
    }[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50 active:scale-[0.99] transition ${toneClass}`}
        >
            {icon}
            {children}
        </button>
    );
}
