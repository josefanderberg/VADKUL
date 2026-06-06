'use client';

import { useState, useEffect, useRef } from 'react';

interface CloudPopupProps {
  message: string;
  /** ms before the cloud auto-disappears (0 = never) */
  autoDismissMs?: number;
  /** Fires synchronously when dismiss begins — before the animation completes */
  onDismissStart?: () => void;
  /** Fires after the dismiss animation completes */
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
  
  // Drag states
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [throwDirection, setThrowDirection] = useState<{ x: number; y: number } | null>(null);

  // Refs for tracking pointer history (for velocity calculation)
  const pointerId = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0, time: 0 });
  const velocity = useRef({ x: 0, y: 0 });

  // Small delay so it "pops in" after the page settles
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (autoDismissMs > 0) {
      const t = setTimeout(() => dismiss({ x: 1, y: -0.5 }), autoDismissMs);
      return () => clearTimeout(t);
    }
  }, [autoDismissMs]);

  const dismiss = (dir: { x: number; y: number }) => {
    onDismissStart?.();
    setThrowDirection(dir);
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      setLeaving(false);
      onDismiss?.();
    }, 600); // Give enough time to animate out of viewport
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Capture pointer
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    setIsDragging(true);
    startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    lastPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    velocity.current = { x: 0, y: 0 };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerId.current !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    const currentX = e.clientX;
    const currentY = e.clientY;
    const currentTime = Date.now();

    // Calculate new position
    const newX = currentX - startPos.current.x;
    const newY = currentY - startPos.current.y;
    
    // Clamp X and Y to prevent dragging it completely off the screen
    const limitX = window.innerWidth / 2 - 40;
    const limitY = window.innerHeight / 2 - 40;
    const clampedX = Math.min(Math.max(newX, -limitX), limitX);
    const clampedY = Math.min(Math.max(newY, -limitY), limitY);
    setOffset({ x: clampedX, y: clampedY });

    // Calculate instantaneous velocity
    const deltaTime = currentTime - lastPos.current.time;
    if (deltaTime > 0) {
      const vx = (currentX - lastPos.current.x) / deltaTime;
      const vy = (currentY - lastPos.current.y) / deltaTime;
      // Exponential moving average for smoothing velocity
      velocity.current = {
        x: velocity.current.x * 0.4 + vx * 0.6,
        y: velocity.current.y * 0.4 + vy * 0.6
      };
    }

    lastPos.current = { x: currentX, y: currentY, time: currentTime };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerId.current !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    // Release pointer capture
    e.currentTarget.releasePointerCapture(e.pointerId);
    pointerId.current = null;
    setIsDragging(false);

    // Keep the cloud exactly where it was dragged, no dismissing on release/swipe!
    const dx = offset.x;
    const dy = offset.y;
    
    // Clamp to make sure the user can always see and grab it
    const limitX = window.innerWidth / 2 - 40;
    const limitY = window.innerHeight / 2 - 40;
    const clampedX = Math.min(Math.max(dx, -limitX), limitX);
    const clampedY = Math.min(Math.max(dy, -limitY), limitY);
    setOffset({ x: clampedX, y: clampedY });
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current === e.pointerId) {
      pointerId.current = null;
      setIsDragging(false);
      setOffset({ x: 0, y: 0 });
    }
  };

  if (!visible && !leaving) return null;

  const wrapperPositionClass =
    position === 'top-left'
      ? 'items-start justify-start pt-[68px] pl-2 sm:pl-4'
      : 'items-center justify-center';

  const sizeClass = size === 'md' ? 'w-[300px] sm:w-[340px]' : 'w-[370px] sm:w-[440px]';
  const textTranslateClass = size === 'md' ? 'translate-y-0' : 'translate-y-[10px]';

  // Calculate dynamic transformation for skewing and tilting based on displacement
  // This simulates the cloud bending, stretching and blowing in the wind as we drag it!
  const dragDistance = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
  
  // rotation/tilt based on drag offset (feels like wind pushing it)
  const tilt = Math.min(Math.max(offset.x * 0.12, -28), 28);
  // skew to make it deform like fluff in the wind
  const skewX = Math.min(Math.max(offset.x * 0.05, -12), 12);
  const skewY = Math.min(Math.max(offset.y * 0.03, -8), 8);
  // scale change (squash & stretch) based on speed/distance of drag
  const scaleX = 1 + Math.min(dragDistance * 0.0006, 0.15);
  const scaleY = 1 - Math.min(dragDistance * 0.0004, 0.1);

  // Smooth transition only when NOT dragging (so it springs back nicely)
  const transitionStyle = isDragging
    ? 'none'
    : 'transform 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease-out';

  // If leaving, we multiply the throw direction to move it way off-screen
  let transformStyle = '';
  let opacityStyle = 1;
  
  if (leaving && throwDirection) {
    const throwDistance = Math.max(window.innerWidth, window.innerHeight) * 1.3;
    const tx = throwDirection.x * throwDistance;
    const ty = throwDirection.y * throwDistance;
    const rot = tilt * 3.5;
    transformStyle = `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg) scale(0.75) skewX(${skewX * 2.5}deg)`;
    opacityStyle = 0;
  } else {
    transformStyle = `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${tilt}deg) scale(${scaleX}, ${scaleY}) skew(${skewX}deg, ${skewY}deg)`;
  }

  // Back layer parallax offset (moves slightly slower/less to look 3D layered)
  const backTransformStyle = leaving && throwDirection
    ? transformStyle // move together when thrown
    : `translate3d(${offset.x * 0.72}px, ${offset.y * 0.72}px, 0) rotate(${tilt * 0.75}deg) scale(${scaleX * 1.05}, ${scaleY * 1.05})`;

  return (
    <div className={`fixed inset-0 z-[9999] flex pointer-events-none ${wrapperPositionClass}`}>
      {/* Invisible click-through backdrop - no dark overlay and allows map interaction */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${leaving ? 'opacity-0' : 'opacity-100'}`}
        style={{ transition: isDragging ? 'none' : 'opacity 0.5s ease' }}
      />
      
      <div
        role="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="relative cursor-grab active:cursor-grabbing select-none pointer-events-auto touch-none"
        style={{ 
          filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.18))',
          willChange: 'transform, opacity',
          transition: transitionStyle,
          transform: transformStyle,
          opacity: opacityStyle
        }}
      >
        <div className={isDragging || leaving ? '' : 'animate-cloud-float'}>
          {/* Layer 1: Background Cloud (Shadow / Parallax depth layer) */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              willChange: 'transform',
              transition: transitionStyle,
              transform: backTransformStyle,
              opacity: 0.65,
              filter: 'blur(4px)'
            }}
          >
            <svg
              viewBox="0 0 340 240"
              className={`${sizeClass} fill-sky-200 dark:fill-sky-950/80`}
              xmlns="http://www.w3.org/2000/svg"
            >
              <g>
                <circle cx="58" cy="160" r="42" />
                <circle cx="100" cy="172" r="48" />
                <circle cx="150" cy="176" r="52" />
                <circle cx="205" cy="172" r="50" />
                <circle cx="255" cy="164" r="46" />
                <circle cx="296" cy="154" r="38" />
                <circle cx="90" cy="118" r="52" />
                <circle cx="148" cy="98" r="64" />
                <circle cx="215" cy="108" r="60" />
                <circle cx="268" cy="126" r="48" />
              </g>
            </svg>
          </div>

          {/* Layer 2: Main Foreground Cloud */}
          <div className="relative">
            <svg
              viewBox="0 0 340 240"
              className={sizeClass}
              xmlns="http://www.w3.org/2000/svg"
            >
              <g filter="url(#cloud-blur)" fillOpacity="0.99" className="fill-white dark:fill-slate-50">
                <circle cx="58" cy="160" r="38" />
                <circle cx="100" cy="172" r="44" />
                <circle cx="150" cy="176" r="48" />
                <circle cx="205" cy="172" r="46" />
                <circle cx="255" cy="164" r="42" />
                <circle cx="296" cy="154" r="34" />
                <circle cx="90" cy="118" r="48" />
                <circle cx="148" cy="98" r="60" />
                <circle cx="215" cy="108" r="56" />
                <circle cx="268" cy="126" r="44" />
              </g>
              {/* Smile Face */}
              <circle cx="125" cy="125" r="7" fill="#bae6fd" />
              <circle cx="175" cy="125" r="7" fill="#bae6fd" />
              <path d="M 133 145 Q 150 168 167 145" stroke="#bae6fd" strokeWidth="7" strokeLinecap="round" fill="none" />
              <defs>
                <filter id="cloud-blur" x="-10%" y="-20%" width="120%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" />
                </filter>
              </defs>
            </svg>
            
            {/* Content container */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-12 pt-6">
              <p className={`text-center text-slate-800 dark:text-slate-900 font-extrabold text-[15px] sm:text-base leading-relaxed max-w-[230px] ${textTranslateClass}`}>
                {message}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
