'use client';

import { useState, useEffect } from 'react';

interface CloudPopupProps {
  message: string;
  /** ms before the cloud auto-disappears (0 = never) */
  autoDismissMs?: number;
  onDismiss?: () => void;
}

export default function CloudPopup({ message, autoDismissMs = 0, onDismiss }: CloudPopupProps) {
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

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 500);
  };

  if (!visible && !leaving) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
    >
      {/* Overlay – very subtle, just dims behind the cloud */}
      <div
        className={`absolute inset-0 bg-black/10 pointer-events-auto transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
        onClick={dismiss}
      />

      {/* The cloud itself */}
      <div
        onClick={dismiss}
        className={`relative pointer-events-auto cursor-pointer select-none transition-all duration-500
          ${leaving ? 'opacity-0 scale-75 -translate-y-10' : 'opacity-100 scale-100 translate-y-0'}
          animate-cloud-float
        `}
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Cloud SVG background */}
        <svg
          viewBox="0 0 340 200"
          className="w-[320px] sm:w-[380px] drop-shadow-2xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Shadow / depth layer */}
          <ellipse cx="170" cy="195" rx="140" ry="10" fill="rgba(0,0,0,0.08)" />

          {/* Main cloud body */}
          <g filter="url(#cloud-blur)">
            {/* Large bottom dome */}
            <ellipse cx="170" cy="165" rx="135" ry="48" fill="white" />
            {/* Left bump */}
            <circle cx="82" cy="138" r="52" fill="white" />
            {/* Right bump */}
            <circle cx="240" cy="132" r="58" fill="white" />
            {/* Centre-left bump (tallest) */}
            <circle cx="148" cy="112" r="64" fill="white" />
            {/* Centre-right bump */}
            <circle cx="210" cy="120" r="54" fill="white" />
            {/* Small left-edge puff */}
            <circle cx="50" cy="158" r="36" fill="white" />
            {/* Small right-edge puff */}
            <circle cx="292" cy="152" r="34" fill="white" />
          </g>

          <defs>
            <filter id="cloud-blur" x="-10%" y="-20%" width="120%" height="140%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
        </svg>

        {/* Text overlay – centred inside the cloud */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 pb-4">
          <span className="text-2xl mb-1">☀️</span>
          <p className="text-center text-slate-700 font-bold text-sm sm:text-[15px] leading-snug max-w-[220px]">
            {message}
          </p>
          <p className="mt-2 text-[10px] text-slate-400 font-medium tracking-wide uppercase">
            Klicka för att stänga
          </p>
        </div>
      </div>
    </div>
  );
}
