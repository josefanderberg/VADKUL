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
  /** Map container projected position */
  anchorPos?: { x: number; y: number };
  /** Called when pointer drag ends with the final drag offsets */
  onDragEnd?: (ox: number, oy: number) => void;
}

// Perfectly symmetrical cloud ball base layout built of smaller circular puffs
const baseCircles = [
  { cx: 150, cy: 135, r: 46 }, // Symmetrical central core
  { cx: 192, cy: 135, r: 30 }, // Right puff
  { cx: 180, cy: 165, r: 30 }, // Bottom-right puff
  { cx: 150, cy: 177, r: 30 }, // Bottom puff
  { cx: 120, cy: 165, r: 30 }, // Bottom-left puff
  { cx: 108, cy: 135, r: 30 }, // Left puff
  { cx: 120, cy: 105, r: 30 }, // Top-left puff
  { cx: 150, cy: 93,  r: 30 }, // Top puff
  { cx: 180, cy: 105, r: 30 }  // Top-right puff
];

// Symmetrical highlight puffs
const highlightCircles = [
  { cx: 165, cy: 115, r: 18 },
  { cx: 135, cy: 115, r: 18 },
  { cx: 150, cy: 150, r: 20 },
  { cx: 175, cy: 140, r: 16 },
  { cx: 125, cy: 140, r: 16 }
];

// Sub-component to render a full cloud layer of puffs
interface CloudLayerProps {
  circles: { cx: number; cy: number; r: number }[];
  className: string;
  style?: React.CSSProperties;
  circleTransitionStyle?: React.CSSProperties;
  blurFilterId?: string;
  stdDeviation?: number;
}

function CloudLayer({
  circles,
  className,
  style,
  circleTransitionStyle,
  blurFilterId,
  stdDeviation = 1.5
}: CloudLayerProps) {
  return (
    <svg
      viewBox="0 0 300 240"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ ...style, overflow: 'visible' }}
    >
      <g filter={blurFilterId ? `url(#${blurFilterId})` : undefined}>
        {circles.map((c, idx) => (
          <circle
            key={idx}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            style={circleTransitionStyle}
          />
        ))}
      </g>
      {blurFilterId && (
        <defs>
          <filter id={blurFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={stdDeviation} />
          </filter>
        </defs>
      )}
    </svg>
  );
}


export default function CloudPopup({
  message,
  autoDismissMs = 0,
  onDismissStart,
  onDismiss,
  position = 'center',
  size = 'lg',
  anchorPos,
  onDragEnd
}: CloudPopupProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Global click listener to toggle smile/text view
  useEffect(() => {
    if (!visible) return;
    const handleGlobalClick = () => {
      setClicked(true);
    };
    
    const timer = setTimeout(() => {
      window.addEventListener('click', handleGlobalClick);
      window.addEventListener('touchend', handleGlobalClick);
    }, 150);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('touchend', handleGlobalClick);
    };
  }, [visible]);
  
  // Drag states
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [throwDirection, setThrowDirection] = useState<{ x: number; y: number } | null>(null);

  // Refs for tracking pointer
  const pointerId = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });

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
    }, 600);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    setIsDragging(true);
    startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerId.current !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    const currentX = e.clientX;
    const currentY = e.clientY;

    const newX = currentX - startPos.current.x;
    const newY = currentY - startPos.current.y;
    
    const limitX = window.innerWidth / 2 - 40;
    const limitY = window.innerHeight / 2 - 40;
    const clampedX = Math.min(Math.max(newX, -limitX), limitX);
    const clampedY = Math.min(Math.max(newY, -limitY), limitY);
    setOffset({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerId.current !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    e.currentTarget.releasePointerCapture(e.pointerId);
    pointerId.current = null;
    setIsDragging(false);

    const dx = offset.x;
    const dy = offset.y;
    
    const limitX = window.innerWidth / 2 - 40;
    const limitY = window.innerHeight / 2 - 40;
    const clampedX = Math.min(Math.max(dx, -limitX), limitX);
    const clampedY = Math.min(Math.max(dy, -limitY), limitY);
    
    if (onDragEnd) {
      onDragEnd(clampedX, clampedY);
      setOffset({ x: 0, y: 0 });
    } else {
      setOffset({ x: clampedX, y: clampedY });
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current === e.pointerId) {
      pointerId.current = null;
      setIsDragging(false);
      // Keep it exactly where it was dragged when pointer left viewport, no snapping back
    }
  };

  const isAnchored = !!anchorPos;

  const wrapperPositionClass =
    position === 'top-left'
      ? 'items-start justify-start pt-[68px] pl-2 sm:pl-4'
      : 'items-center justify-center';

  const sizeClass = size === 'md' ? 'w-[300px] sm:w-[340px]' : 'w-[370px] sm:w-[440px]';
  const textTranslateClass = size === 'md' ? 'translate-y-0' : 'translate-y-[10px]';

  const dragDistance = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
  const tilt = Math.min(Math.max(offset.x * 0.12, -28), 28);
  const skewX = Math.min(Math.max(offset.x * 0.05, -12), 12);
  const skewY = Math.min(Math.max(offset.y * 0.03, -8), 8);
  const scaleX = 1 + Math.min(dragDistance * 0.0006, 0.15);
  const scaleY = 1 - Math.min(dragDistance * 0.0004, 0.1);

  const transitionStyle = isDragging
    ? 'none'
    : 'transform 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease-out';

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
    if (isAnchored) {
      transformStyle = `translate3d(calc(-50% + ${offset.x}px), calc(-56.25% + ${offset.y}px), 0) rotate(${tilt}deg) scale(${scaleX}, ${scaleY}) skew(${skewX}deg, ${skewY}deg)`;
    } else {
      transformStyle = `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${tilt}deg) scale(${scaleX}, ${scaleY}) skew(${skewX}deg, ${skewY}deg)`;
    }
  }

  // --- HÄR ÄR FIXEN ---
  // Beräkna fönstrets mittpunkt (med fallback för SSR)
  const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
  const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 500;

  // faceVec är molnets position i förhållande till skärmens mitt
  const faceVec = {
    x: (anchorPos?.x ?? screenCenterX) + offset.x - screenCenterX,
    y: (anchorPos?.y ?? screenCenterY) + offset.y - screenCenterY
  };
  // ---------------------

  const faceDist = Math.sqrt(faceVec.x * faceVec.x + faceVec.y * faceVec.y);
  const faceBlend = Math.min(faceDist / 50, 1); // blend in fully after 50px from center
  
  // ÄNDRA DEN HÄR RADEN:
  const rawAngleDeg = Math.atan2(faceVec.y, faceVec.x) * (180 / Math.PI) + 90; 
  
  const faceRotDeg = faceBlend * rawAngleDeg;
  
  // Static local face coordinates - the whole group rotates, parts stay fixed.
  const leftEye =  { x: 150 - 20, y: 135 - 18 };
  const rightEye = { x: 150 + 20, y: 135 - 18 };
  const mouthLeft  = { x: 150 - 18, y: 135 + 14 };
  const mouthRight = { x: 150 + 18, y: 135 + 14 };
  // Control point: pulls down for a smile (U shape) in local frame
  const mouthCtrl  = { x: 150, y: 135 + 23 };

  const circleTransitionStyle = {
    transition: 'cx 0.35s cubic-bezier(0.215, 0.61, 0.355, 1), cy 0.35s cubic-bezier(0.215, 0.61, 0.355, 1), r 0.35s cubic-bezier(0.215, 0.61, 0.355, 1)'
  };

  const backTransformStyle = leaving && throwDirection
    ? transformStyle 
    : `rotate(${tilt * 0.75}deg) scale(${scaleX * 1.05}, ${scaleY * 1.05})`;

  const outerClassName = isAnchored
    ? "fixed inset-0 z-[9999] pointer-events-none"
    : `fixed inset-0 z-[9999] flex pointer-events-none ${wrapperPositionClass}`;

  const draggableStyle: React.CSSProperties = isAnchored
    ? {
        position: 'absolute',
        left: anchorPos.x,
        top: anchorPos.y,
        filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.16))',
        willChange: 'transform, opacity',
        transition: transitionStyle,
        transform: transformStyle,
        opacity: opacityStyle
      }
    : {
        filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.16))',
        willChange: 'transform, opacity',
        transition: transitionStyle,
        transform: transformStyle,
        opacity: opacityStyle
      };

  // Deform base circles elastically (squash & stretch based on drag angle)
  const getDeformedCircles = (parallax: number) => {
    // Parallax translation relative to the parent container (which is already moving at 100%)
    const dx = offset.x * (parallax - 1.0);
    const dy = offset.y * (parallax - 1.0);

    // Deformation calculations use the main parent drag distance and angle
    const dragAngle = Math.atan2(offset.y, offset.x);
    const cosA = Math.cos(dragAngle);
    const sinA = Math.sin(dragAngle);

    const stretch = 1 + Math.min(dragDistance * 0.0012, 0.22);
    const squeeze = 1 - Math.min(dragDistance * 0.0008, 0.14);

    return baseCircles.map((c) => {
      const distX = c.cx - 150;
      const distY = c.cy - 135;

      const projDrag = distX * cosA + distY * sinA;
      const projOrth = -distX * sinA + distY * cosA;

      const newProjDrag = projDrag * stretch;
      const newProjOrth = projOrth * squeeze;

      const newDistX = newProjDrag * cosA - newProjOrth * sinA;
      const newDistY = newProjDrag * sinA + newProjOrth * cosA;

      const cx = 150 + newDistX + dx;
      const cy = 135 + newDistY + dy;
      const r = c.r * (1 + Math.min(dragDistance * 0.0003, 0.08));

      return { cx, cy, r };
    });
  };

  // Deform highlight circles elastically (faster layer)
  const getDeformedHighlights = () => {
    // Parallax translation relative to parent
    const dx = offset.x * (0.88 - 1.0);
    const dy = offset.y * (0.88 - 1.0);

    const dragAngle = Math.atan2(offset.y, offset.x);
    const cosA = Math.cos(dragAngle);
    const sinA = Math.sin(dragAngle);

    const stretch = 1 + Math.min(dragDistance * 0.0012, 0.22);
    const squeeze = 1 - Math.min(dragDistance * 0.0008, 0.14);

    return highlightCircles.map((c) => {
      const distX = c.cx - 150;
      const distY = c.cy - 135;

      const projDrag = distX * cosA + distY * sinA;
      const projOrth = -distX * sinA + distY * cosA;

      const newProjDrag = projDrag * stretch;
      const newProjOrth = projOrth * squeeze;

      const newDistX = newProjDrag * cosA - newProjOrth * sinA;
      const newDistY = newProjDrag * sinA + newProjOrth * cosA;

      const cx = 150 + newDistX + dx;
      const cy = 135 + newDistY + dy;

      return { cx, cy, r: c.r };
    });
  };

  const dynamicCirclesLayer1 = getDeformedCircles(1.30);
  const dynamicCirclesLayer2 = getDeformedCircles(1.15);
  const dynamicCirclesLayer3 = getDeformedCircles(1.0);
  const dynamicHighlightCircles = getDeformedHighlights();

  if (!visible && !leaving) return null;

  return (
    <div className={outerClassName}>
      <div 
        className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${leaving ? 'opacity-0' : 'opacity-100'}`}
        style={{ transition: isDragging ? 'none' : 'opacity 0.5s ease' }}
      />
      
      <div
        className="relative select-none pointer-events-none"
        style={draggableStyle}
      >
        <div className={isDragging || leaving ? '' : 'animate-cloud-float'}>
          
          {/* LAYER 1: Deep Background Shadow (moves slowest, sky-300, blurred) */}
          <CloudLayer
            circles={dynamicCirclesLayer1}
            className={`${sizeClass} absolute inset-0 pointer-events-none fill-sky-300 dark:fill-sky-950`}
            style={{
              willChange: 'transform',
              transition: transitionStyle,
              transform: backTransformStyle,
              opacity: 0.35
            }}
            circleTransitionStyle={circleTransitionStyle}
            blurFilterId="cloud-blur-bg1"
            stdDeviation={6}
          />

          {/* LAYER 2: Midground Cloud (moves medium, sky-100, slightly blurred) */}
          <CloudLayer
            circles={dynamicCirclesLayer2}
            className={`${sizeClass} absolute inset-0 pointer-events-none fill-sky-100/70 dark:fill-sky-900/40`}
            style={{
              willChange: 'transform',
              transition: transitionStyle,
              transform: backTransformStyle,
              opacity: 0.60
            }}
            circleTransitionStyle={circleTransitionStyle}
            blurFilterId="cloud-blur-bg2"
            stdDeviation={3}
          />

          {/* LAYER 3 & 4: Foreground & Highlights (Base layer) */}
          <div className="relative">
            <svg
              viewBox="0 0 300 240"
              className={sizeClass}
              style={{ overflow: 'visible' }}
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Main white puff base */}
              <g filter="url(#cloud-blur)" fillOpacity="0.99" className="fill-white dark:fill-slate-50">
                {dynamicCirclesLayer3.map((c, idx) => (
                  <circle 
                    key={`fg-${idx}`} 
                    cx={c.cx} 
                    cy={c.cy} 
                    r={c.r} 
                    style={circleTransitionStyle}
                  />
                ))}
              </g>

              {/* LAYER 4: Highlight Puffs (moves fastest, overlapping, creating 3D volume shifts) */}
              <g fillOpacity="0.95" className="fill-slate-50/80 dark:fill-white/20">
                {dynamicHighlightCircles.map((c, idx) => (
                  <circle
                    key={`hl-${idx}`}
                    cx={c.cx}
                    cy={c.cy}
                    r={c.r}
                    style={circleTransitionStyle}
                  />
                ))}
              </g>

              {/* Face: entire group rotates as a compass toward screen center */}
              <g
                style={{
                  opacity: clicked ? 1 : 0,
                  transform: clicked
                    ? `rotate(${faceRotDeg}deg) scale(1)`
                    : `rotate(${faceRotDeg}deg) scale(0.3)`,
                  transformOrigin: '150px 135px',
                  transition: clicked
                    ? 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                {/* Eyes */}
                <circle cx={leftEye.x} cy={leftEye.y} r="7" fill="#bae6fd" />
                <circle cx={rightEye.x} cy={rightEye.y} r="7" fill="#bae6fd" />
                {/* Mouth: always a smile U-shape in local face space */}
                <path
                  d={`M ${mouthLeft.x} ${mouthLeft.y} Q ${mouthCtrl.x} ${mouthCtrl.y} ${mouthRight.x} ${mouthRight.y}`}
                  stroke="#bae6fd"
                  strokeWidth="7"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              <defs>
                <filter id="cloud-blur" filterUnits="userSpaceOnUse" x="-100" y="-100" width="540" height="440">
                  <feGaussianBlur stdDeviation="1.5" />
                </filter>
              </defs>
            </svg>
            
            {/* Content container */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-12 pt-6 pointer-events-none">
              <div
                style={{
                  opacity: clicked ? 0 : 1,
                  transform: clicked ? 'scale(0.8) translateY(-10px)' : 'scale(1) translateY(0)',
                  transition: 'opacity 0.4s ease-out, transform 0.4s ease-out'
                }}
              >
                <p className={`text-center text-slate-800 dark:text-slate-900 font-extrabold text-[15px] sm:text-base leading-relaxed max-w-[230px] ${textTranslateClass}`}>
                  {message}
                </p>
              </div>
            </div>
          </div>

          {/* Pointer hit area — sized to match the visible cloud puff, not the SVG bounding box */}
          <div
            role="button"
            aria-label="Drag cloud"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="absolute cursor-grab active:cursor-grabbing select-none pointer-events-auto touch-none"
            style={{
              left: '26%',
              top: '26.25%',
              width: '48%',
              height: '60%',
              borderRadius: '50%'
            }}
          />
        </div>
      </div>
    </div>
  );
}