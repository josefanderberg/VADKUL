import { FORFUN_URL } from '@/utils/partnerLinks';

/** Partnerraden till ForFun — bakgrund och placeringsregler i
 *  utils/partnerLinks.ts. Samma fotnotsstil som källnoten på stadssidan. */
export default function ForFunTips({ cityName }: { cityName: string }) {
    return (
        <p className="mt-6 text-xs text-slate-400 dark:text-zinc-500 font-medium">
            Tips för barnfamiljer i {cityName} med omnejd:{' '}
            <a
                href={FORFUN_URL}
                target="_blank"
                rel="noopener"
                className="font-bold text-[#006AA7] dark:text-sky-400 hover:underline"
            >
                ForFun
            </a>{' '}
            samlar aktiviteter för barnfamiljer i Sörmland — på flera språk.
        </p>
    );
}
