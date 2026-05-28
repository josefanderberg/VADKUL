'use client';

import { useState, useEffect } from 'react';

interface CloudPopupProps {
  message: string;
  /** ms before the cloud auto-disappears (0 = never) */
  autoDismissMs?: number;
  /** Fires synchronously when dismiss begins (click) — before the fade-out animation */
  onDismissStart?: () => void;
  /** Fires after the fade-out animation completes */
  onDismiss?: () => void;
  /** Where the cloud appears on screen */
  position?: 'center' | 'top-left';
  /** Cloud size */
  size?: 'lg' | 'md';
}

export default function CloudPopup({
  message,
  autoDismissMs = 0,
  onDismissStart,
  onDismiss,
  position = 'center',
  size = 'lg',
}: CloudPopupProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Small delay so it "pops in" after the page settles
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (autoDismissMs > 0) {
      const t = setTimeout(dismiss, autoDismissMs);
      return () => clearTimeout(t);
    }
  }, [autoDismissMs]);

  // Dismiss on any click anywhere on the page (not just on the cloud itself)
  useEffect(() => {
    if (!visible || leaving) return;
    // Tiny delay so the click that *triggered* this cloud doesn't immediately dismiss it
    let handler: ((e: MouseEvent) => void) | null = null;
    const setupTimer = setTimeout(() => {
      handler = () => dismiss();
      document.addEventListener('click', handler);
    }, 150);
    return () => {
      clearTimeout(setupTimer);
      if (handler) document.removeEventListener('click', handler);
    };
  }, [visible, leaving]);

  const dismiss = () => {
    onDismissStart?.();
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      setLeaving(false);
      onDismiss?.();
    }, 700);
  };

  if (!visible && !leaving) return null;

  const wrapperPositionClass =
    position === 'top-left'
      ? 'items-start justify-start pt-[68px] pl-2 sm:pl-4'
      : 'items-center justify-center';

  const sizeClass = size === 'md' ? 'w-[300px] sm:w-[340px]' : 'w-[370px] sm:w-[440px]';
  const textTranslateClass = size === 'md' ? 'translate-y-0' : 'translate-y-[10px]';

  return (
    <div className={`fixed inset-0 z-[9999] flex pointer-events-none ${wrapperPositionClass}`}>
      {/* The cloud itself */}
      <div
        role="button"
        onClick={dismiss}
        className={`relative cursor-pointer select-none transition-opacity duration-700 ease-out pointer-events-auto
          ${leaving ? 'opacity-0' : 'opacity-100'}
          animate-cloud-float
        `}
        style={{ willChange: 'opacity' }}
      >
        {/* Cloud SVG background */}
        <svg
          viewBox="0 0 340 240"
          className={`${sizeClass} drop-shadow-2xl`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main cloud body – overlapping puffs all around for a soft, irregular silhouette */}
          <g filter="url(#cloud-blur)" fillOpacity="0.98">
            {/* Bottom row of puffs */}
            <circle cx="58" cy="160" r="38" fill="white" />
            <circle cx="100" cy="172" r="44" fill="white" />
            <circle cx="150" cy="176" r="48" fill="white" />
            <circle cx="205" cy="172" r="46" fill="white" />
            <circle cx="255" cy="164" r="42" fill="white" />
            <circle cx="296" cy="154" r="34" fill="white" />

            {/* Top row of puffs */}
            <circle cx="90" cy="118" r="48" fill="white" />
            <circle cx="148" cy="98" r="60" fill="white" />
            <circle cx="215" cy="108" r="56" fill="white" />
            <circle cx="268" cy="126" r="44" fill="white" />
          </g>

          <defs>
            <filter id="cloud-blur" x="-10%" y="-20%" width="120%" height="140%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
        </svg>

        {/* Text overlay – beautifully positioned inside the semi-transparent cloud */}
        <div className="absolute inset-0 flex items-center justify-center px-12 pt-8">
          <p className={`text-center text-sky-800 font-semibold text-base sm:text-[17px] leading-relaxed max-w-[240px] ${textTranslateClass}`}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
