'use client';

interface ToggleProps {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    'aria-label'?: string;
}

/** Liten på/av-switch (kontrollerad). */
export default function Toggle({ checked, onChange, disabled, ...rest }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={rest['aria-label']}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            } ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-neutral-700'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    checked ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    );
}
