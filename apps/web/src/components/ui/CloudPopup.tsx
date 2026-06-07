'use client';

import { useState, useEffect, useRef } from 'react';

interface CloudPopupProps {
  message: React.ReactNode;
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
  /** Multiplier for the face features (eyes + mouth) when clicked. 1 = default. */
  faceScale?: number;
  /** Ms delay before the cloud pops in. Default 600 (lets the page settle).
   *  Pass 0 for immediate appearance (e.g. on a user-triggered spawn). */
  showDelayMs?: number;
  /** Uniform scale of the whole cloud. 1 = default. Used to let a map-anchored
   *  cloud grow/shrink with the map zoom. */
  scale?: number;
  /** True when the camera is locked to / following this cloud. Drives a
   *  focused face expression. */
  following?: boolean;
  /** Fired on a tap (pointer down+up without dragging) — used to toggle the
   *  camera-follow mode for this cloud. */
  onToggleFollow?: () => void;
  /** While following: release velocity (px/ms) + the screen point the cloud
   *  was let go at, so the parent can pin the cloud there and fling the camera
   *  with matching momentum/friction. */
  onFollowFling?: (vx: number, vy: number, holdX: number, holdY: number) => void;
  /** Live snapshot of the cloud's screen position + velocity while it is
   *  gliding from a fling. Null whenever the cloud is at rest. Lets the parent
   *  latch the camera onto a mid-flight throw (focus button) and chase its
   *  predicted landing point. */
  glideStateRef?: React.MutableRefObject<{ sp: { x: number; y: number }; vx: number; vy: number } | null>;
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

// Avlång "klassisk moln"-form — bredare än hög, lummig topp, flackare botten.
// Detta är vilo-formen (innan man klickat). Index 1:1 mot baseCircles så formen
// kan morpha mjukt (cx/cy/r-transition) till det runda "default"-molnet vid klick.
// cy-värdena är förskjutna uppåt så att moln-kroppens mitt hamnar runt rutans
// vertikala mitt — då sitter texten (som centreras i rutan) mitt i molnet.
const elongatedCircles = [
  { cx: 150, cy: 130, r: 42 }, // core
  { cx: 212, cy: 140, r: 30 }, // right (bred)
  { cx: 188, cy: 152, r: 28 }, // bottom-right
  { cx: 150, cy: 156, r: 30 }, // bottom
  { cx: 112, cy: 152, r: 28 }, // bottom-left
  { cx: 88,  cy: 140, r: 30 }, // left (bred)
  { cx: 112, cy: 108, r: 30 }, // top-left
  { cx: 150, cy: 96,  r: 34 }, // top
  { cx: 188, cy: 108, r: 30 }  // top-right
];

// Spin-fysik vid kast. Vinkelhastigheten = greppets avstånd från centrum
// (kryssprodukt med kasthastigheten), så ett kast greppat ute vid kanten
// snurrar molnet — ett kast greppat i mitten gör det inte.
const SPIN_STRENGTH = 1.6;   // deg/ms per (grepp × hastighet). Högre = mer snurr.
const GLIDE_FRICTION = 2.2;  // hastighetsavtagande per sekund under glidet.

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
  onDragEnd,
  faceScale = 1,
  showDelayMs = 600,
  scale = 1,
  following = false,
  onToggleFollow,
  onFollowFling,
  glideStateRef
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
  const [isGliding, setIsGliding] = useState(false);
  // Resting rotation = the rotation the cloud has when its position has been
  // stable for a short moment. It only updates after any kind of motion
  // (cloud drag, glide, OR map pan moving anchorPos) has settled. While
  // anything is in motion, this value stays put — the face stays where it was.
  const [restingRotation, setRestingRotation] = useState(0);
  const [dragSpinAngle, setDragSpinAngle] = useState(0);
const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [throwDirection, setThrowDirection] = useState<{ x: number; y: number } | null>(null);
  // When releasing in anchored mode the parent updates anchorPos to compensate
  // for the new (0, 0) offset in the same commit — but a CSS transform transition
  // would still animate from the pre-release translate, overshooting past the
  // release point. We skip the transition for one frame so the swap is invisible.
  const [skipTransition, setSkipTransition] = useState(false);
  // One-shot pop-in: plays once when the cloud first appears, never re-fires.
  const [hasPoppedIn, setHasPoppedIn] = useState(false);

  useEffect(() => {
    if (!skipTransition) return;
    const id = requestAnimationFrame(() => setSkipTransition(false));
    return () => cancelAnimationFrame(id);
  }, [skipTransition]);

  useEffect(() => {
    if (!visible || hasPoppedIn) return;
    const t = setTimeout(() => setHasPoppedIn(true), 600);
    return () => clearTimeout(t);
  }, [visible, hasPoppedIn]);

  // Refs for tracking pointer
  const pointerId = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const grabOffset = useRef({ x: 0, y: 0 });
  // Pointer velocity sampling for the post-release glide ("airhockey" feel).
  // We keep last two samples so a stale velocity from a long pause before
  // release doesn't get inherited.
  const velocitySamples = useRef<{ x: number; y: number; t: number }[]>([]);
  const glideRaf = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Tap detection: raw pointer-down coords + whether it moved past a small
  // threshold. A pointer-up with no movement is treated as a tap (toggle follow).
  const downClient = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);

  // Small delay so it "pops in" after the page settles
  useEffect(() => {
    if (showDelayMs <= 0) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(true), showDelayMs);
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

    // Cancel any in-flight glide or fade timeout
    if (glideRaf.current !== null) {
      cancelAnimationFrame(glideRaf.current);
      glideRaf.current = null;
    }
    if (glideStateRef) glideStateRef.current = null;
    if (fadeTimeoutRef.current !== null) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    setIsGliding(false);
    // restingRotation handles the freeze automatically — any position change
    // during drag restarts its debounce so it stays put.
    setDragSpinAngle(0);

    const rect = e.currentTarget.getBoundingClientRect();
    const grabX = e.clientX - (rect.left + rect.width / 2);
    const grabY = e.clientY - (rect.top + rect.height / 2);
    const radius = Math.max(rect.width / 2, 1);
    grabOffset.current = { x: grabX / radius, y: grabY / radius };

    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    setIsDragging(true);
    startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    downClient.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    velocitySamples.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
  };

  // Compute clamp range for the drag offset. When anchored we limit so the cloud
  // can reach all screen edges (minus a small margin) regardless of which side
  // it's currently parked on. When unanchored we fall back to symmetric limits
  // around the natural center position.
  const getOffsetLimits = () => {
    const margin = 40;
    if (anchorPos) {
      return {
        minX: margin - anchorPos.x,
        maxX: window.innerWidth - margin - anchorPos.x,
        minY: margin - anchorPos.y,
        maxY: window.innerHeight - margin - anchorPos.y
      };
    }
    const halfW = window.innerWidth / 2 - margin;
    const halfH = window.innerHeight / 2 - margin;
    return { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerId.current !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    const currentX = e.clientX;
    const currentY = e.clientY;

    const newX = currentX - startPos.current.x;
    const newY = currentY - startPos.current.y;

    // Once the pointer has travelled past ~6px it's a drag, not a tap.
    if (!dragMoved.current) {
      const dxDown = currentX - downClient.current.x;
      const dyDown = currentY - downClient.current.y;
      if (dxDown * dxDown + dyDown * dyDown > 36) dragMoved.current = true;
    }

    // Keep the most recent samples (~last 80ms) for release-velocity estimation.
    const now = performance.now();
    velocitySamples.current.push({ x: e.clientX, y: e.clientY, t: now });
    while (velocitySamples.current.length > 1 && now - velocitySamples.current[0].t > 80) {
      velocitySamples.current.shift();
    }

    // In follow mode the cloud still tracks the finger during the drag (so it
    // never feels stuck), but isn't clamped to the viewport — you can pull it
    // anywhere before flinging. Camera follow happens on release.
    if (following) {
      setOffset({ x: newX, y: newY });
      return;
    }

    const { minX, maxX, minY, maxY } = getOffsetLimits();
    const clampedX = Math.min(Math.max(newX, minX), maxX);
    const clampedY = Math.min(Math.max(newY, minY), maxY);

    // No rotation during drag — the cloud is perfectly stiff while held.
    // Spin is computed on release from grabOffset × release-velocity.
    setOffset({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerId.current !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    e.currentTarget.releasePointerCapture(e.pointerId);
    pointerId.current = null;
    setIsDragging(false);

    // Tap (no meaningful movement) → toggle camera-follow, no glide.
    if (!dragMoved.current) {
      setClicked(true);
      onToggleFollow?.();
      velocitySamples.current = [];
      setOffset({ x: 0, y: 0 });
      return;
    }

    // Estimate release velocity from the last sample window (px/ms).
    const samples = velocitySamples.current;
    let vx = 0;
    let vy = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) {
        vx = (last.x - first.x) / dt;
        vy = (last.y - first.y) / dt;
      }
    }
    velocitySamples.current = [];

    // Follow mode: the cloud holds wherever you released it (its current screen
    // point), and the camera flies with the release momentum — so the cloud
    // tracks the camera the whole way. Spin is baked in for feel.
    if (following && onFollowFling) {
      const holdX = (anchorPos?.x ?? 0) + offset.x;
      const holdY = (anchorPos?.y ?? 0) + offset.y;
      const gx = grabOffset.current.x;
      const gy = grabOffset.current.y;
      const vSpin = -(gx * vy - gy * vx) * 0.7;
      // Total spin = integral of vSpin·e^(-k t) = vSpin / k, k = friction/1000.
      setRestingRotation(prev => prev + vSpin / (2.2 / 1000));
      setDragSpinAngle(0);
      // Hold point updates to the release position in the same commit, so
      // resetting offset to 0 doesn't visibly snap the cloud.
      setSkipTransition(true);
      onFollowFling(vx, vy, holdX, holdY);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const commit = (cx: number, cy: number) => {
      if (onDragEnd) {
        // Anchor parent absorbs (cx, cy) while we reset offset to 0 in the
        // same commit — skip the transition so the swap is invisible.
        setSkipTransition(true);
        onDragEnd(cx, cy);
        setOffset({ x: 0, y: 0 });
      } else {
        setOffset({ x: cx, y: cy });
      }
    };

    const { minX, maxX, minY, maxY } = getOffsetLimits();
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Below this release speed there's no perceivable glide — but a flick at the
    // rim should still spin the cloud. Bake the edge-throw spin straight into the
    // resting rotation (same model as follow-mode) and commit in place.
    if (speed < 0.1) {
      const clampedX = Math.min(Math.max(offset.x, minX), maxX);
      const clampedY = Math.min(Math.max(offset.y, minY), maxY);

      const gx = grabOffset.current.x;
      const gy = grabOffset.current.y;
      const vSpin = -(gx * vy - gy * vx) * SPIN_STRENGTH;
      // Total spin = integral of vSpin·e^(-k t) = vSpin / k, k = friction/1000.
      setRestingRotation(prev => prev + vSpin / (GLIDE_FRICTION / 1000));
      setDragSpinAngle(0);
      commit(clampedX, clampedY);
      return;
    }

    // Airhockey glide: integrate velocity with per-second friction and land
    // wherever momentum runs out. No walls and no auto-dismiss — the cloud
    // commits to the physics-predicted resting position.
    setIsGliding(true);
    const gx = grabOffset.current.x;
    const gy = grabOffset.current.y;
    let vSpin = -(gx * vy - gy * vx) * SPIN_STRENGTH; // angular velocity in deg/ms (inverted)
    let curSpinAngle = dragSpinAngle;

    let curX = offset.x;
    let curY = offset.y;
    let curVx = vx; // px/ms
    let curVy = vy;
    const friction = GLIDE_FRICTION; // velocity halves roughly every ~315ms
    const stopThreshold = 0.04; // px/ms
    let lastT = performance.now();

    const baseX = anchorPos?.x ?? 0;
    const baseY = anchorPos?.y ?? 0;
    if (glideStateRef) {
      glideStateRef.current = {
        sp: { x: baseX + curX, y: baseY + curY },
        vx: curVx,
        vy: curVy
      };
    }

    const tick = (t: number) => {
      const dt = Math.min(t - lastT, 32); // cap to avoid huge jumps after tab blur
      lastT = t;

      curX += curVx * dt;
      curY += curVy * dt;
      curSpinAngle += vSpin * dt;

      setOffset({ x: curX, y: curY });
      setDragSpinAngle(curSpinAngle);

      const decay = Math.exp(-friction * dt / 1000);
      curVx *= decay;
      curVy *= decay;
      vSpin *= decay;

      if (glideStateRef) {
        glideStateRef.current = {
          sp: { x: baseX + curX, y: baseY + curY },
          vx: curVx,
          vy: curVy
        };
      }

      const remaining = Math.sqrt(curVx * curVx + curVy * curVy);
      if (remaining < stopThreshold) {
        glideRaf.current = null;
        setIsGliding(false);
        if (glideStateRef) glideStateRef.current = null;
        // Cloud has stopped — bake the accumulated spin into the persistent
        // restingRotation so the new orientation sticks for next interaction.
        setRestingRotation(prev => prev + curSpinAngle);
        setDragSpinAngle(0);
        commit(curX, curY);
        return;
      }
      glideRaf.current = requestAnimationFrame(tick);
    };
    glideRaf.current = requestAnimationFrame(tick);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current === e.pointerId) {
      pointerId.current = null;
      setIsDragging(false);
      // Keep it exactly where it was dragged when pointer left viewport, no snapping back
    }
  };

  // Forward wheel events to whatever sits beneath the cloud (typically the map).
  // The hit area has pointer-events:auto so it would otherwise swallow scroll/zoom.
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const prev = target.style.pointerEvents;
    target.style.pointerEvents = 'none';
    const below = document.elementFromPoint(e.clientX, e.clientY);
    target.style.pointerEvents = prev;
    if (!below || below === target) return;
    below.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode,
      clientX: e.clientX,
      clientY: e.clientY,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey
    }));
  };

  useEffect(() => {
    return () => {
      if (glideRaf.current !== null) cancelAnimationFrame(glideRaf.current);
      if (fadeTimeoutRef.current !== null) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  const isAnchored = !!anchorPos;

  const wrapperPositionClass =
    position === 'top-left'
      ? 'items-start justify-start pt-[68px] pl-2 sm:pl-4'
      : 'items-center justify-center';

  const sizeClass = size === 'md' ? 'w-[300px] sm:w-[340px]' : 'w-[370px] sm:w-[440px]';
  // Storleksskillnaden start↔default görs via en inline scale-transform nedan
  // (pålitligt) i stället för nya Tailwind-bredder som kanske inte hinner genereras.
  const stateScale = clicked ? 1.0 : 1.7; // avlångt startmoln stort, runt default-moln mindre
  const textTranslateClass = size === 'md' ? 'translate-y-0' : 'translate-y-[10px]';

  // Screen center & cloud-to-center vector (used for face rotation + shadow offset).
  // Calculated up front so shadow shifts can use it.
  const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
  const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 500;

  const faceVec = {
    x: (anchorPos?.x ?? screenCenterX) + offset.x - screenCenterX,
    y: (anchorPos?.y ?? screenCenterY) + offset.y - screenCenterY
  };
  const faceDist = Math.sqrt(faceVec.x * faceVec.x + faceVec.y * faceVec.y);
  const faceBlend = Math.min(faceDist / 50, 1);
  const rawAngleDeg = Math.atan2(faceVec.y, faceVec.x) * (180 / Math.PI) + 90;
  const faceRotDeg = faceBlend * rawAngleDeg;

  // restingRotation is no longer auto-driven toward screen center. The cloud's
  // orientation is determined solely by the spin accumulated from throws —
  // glide ticks add to dragSpinAngle, and that value is folded into
  // restingRotation when the cloud comes to rest.

  const transitionStyle = (isDragging || isGliding || skipTransition)
    ? 'none'
    : 'transform 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease-out';

  let transformStyle = '';
  let opacityStyle = 1;

  // Pure-translate during interaction — no tilt/skew/scale on drag, so the cloud
  // looks identical whether held or released. The dismiss "throw" still rotates
  // for personality, but it derives rotation from throw direction, not drag.
  if (leaving && throwDirection) {
    const throwDistance = Math.max(window.innerWidth, window.innerHeight) * 1.3;
    const tx = throwDirection.x * throwDistance;
    const ty = throwDirection.y * throwDistance;
    const throwRot = Math.atan2(throwDirection.y, throwDirection.x) * (180 / Math.PI) + 45;
    transformStyle = `translate3d(${tx}px, ${ty}px, 0) rotate(${throwRot}deg) scale(0.75)`;
    opacityStyle = 0;
  } else if (isAnchored) {
    transformStyle = `translate3d(calc(-50% + ${offset.x}px), calc(-56.25% + 20px + ${offset.y}px), 0)`;
  } else {
    transformStyle = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
  }

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

  // The cloud body rotates as a single unit toward screen center — shadows,
  // puffs and face all share this rotation so they read as one rigid head.
  // (Disabled during the leaving throw so the dismiss-rotation isn't doubled.)
  // Always use the resting rotation as the base; live faceRotDeg is never used
  // for the visible rotation. Spin from a fling is added on top.
  const currentRotation = restingRotation + dragSpinAngle;
  const cloudBodyRotation = leaving ? '' : `rotate(${currentRotation}deg)`;
  const cloudBodyRotTransition = (isDragging || isGliding || skipTransition)
    ? 'none'
    : 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';

  // Shadow layers don't tilt/scale from drag anymore — only sit slightly larger
  // behind the foreground. Their outward "elongation" comes from offsetting the
  // shadow circles in the direction away from screen center (see getShadowCircles).
  const backTransformStyle = leaving && throwDirection
    ? transformStyle
    : `${cloudBodyRotation} scale(1.05)`;

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

  // Shadow layers shift outward (away from screen center) proportional to the
  // cloud's distance from center. Cloud shape is never deformed — only offset.
  // faceVec is in screen pixels; intensity is in svg-units-per-pixel-ish.
  // Capped so the shadow never drifts absurdly far from the cloud.
  // Vilo-formen är avlång (klassiskt moln); vid klick morphar den till det runda
  // "default"-molnet. Samma uppsättning används av skuggor + förgrund så hela
  // molnet morphar som en enhet (cx/cy/r-transition).
  const activeCircles = clicked ? baseCircles : elongatedCircles;

  const getShadowCircles = (intensity: number, maxShift: number) => {
    const rawDx = faceVec.x * intensity;
    const rawDy = faceVec.y * intensity;
    const mag = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const scale = mag > maxShift ? maxShift / mag : 1;
    const dx = rawDx * scale;
    const dy = rawDy * scale;
    return activeCircles.map((c) => ({
      cx: c.cx + dx,
      cy: c.cy + dy,
      r: c.r
    }));
  };

  const dynamicCirclesLayer1 = getShadowCircles(0.055, 28); // deepest shadow — strongest outward shift
  const dynamicCirclesLayer2 = getShadowCircles(0.028, 16); // mid shadow — subtler shift
  const dynamicCirclesLayer3 = activeCircles;                // foreground — morphar avlång↔rund
  const dynamicHighlightCircles = highlightCircles;          // highlights — never moves/deforms

  if (!visible && !leaving) return null;

  const renderCloudBody = (rotation: string, transitionStr: string) => {
    const shadowRotation = leaving && throwDirection ? transformStyle : `${rotation} scale(1.05)`;
    return (
      <>
        {/* LAYER 1: Deep Background Shadow (moves slowest, sky-300, blurred) */}
        <CloudLayer
          circles={dynamicCirclesLayer1}
          className={`${sizeClass} absolute inset-0 pointer-events-none fill-sky-300 dark:fill-sky-950`}
          style={{
            willChange: 'transform',
            transition: transitionStyle,
            transform: shadowRotation,
            transformOrigin: '50% 56.25%',
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
            transform: shadowRotation,
            transformOrigin: '50% 56.25%',
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
            style={{
              overflow: 'visible',
              transform: rotation,
              transformOrigin: '50% 56.25%',
              transition: transitionStr,
              willChange: 'transform'
            }}
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

            {/* Face: rotation is on the SVG parent now — this group only
                handles the click pop-in scale. */}
            <g
              style={{
                opacity: clicked ? 1 : 0,
                transform: clicked ? `scale(${faceScale})` : `scale(${0.3 * faceScale})`,
                transformOrigin: '150px 135px',
                transition: 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {following ? (
                <>
                  {/* Focused "flight mode": happy squinted eyes (^ ^) + open
                      excited mouth — signals the camera is locked on. */}
                  <path
                    d={`M ${leftEye.x - 7} ${leftEye.y + 3} Q ${leftEye.x} ${leftEye.y - 6} ${leftEye.x + 7} ${leftEye.y + 3}`}
                    stroke="#bae6fd" strokeWidth="5" strokeLinecap="round" fill="none"
                  />
                  <path
                    d={`M ${rightEye.x - 7} ${rightEye.y + 3} Q ${rightEye.x} ${rightEye.y - 6} ${rightEye.x + 7} ${rightEye.y + 3}`}
                    stroke="#bae6fd" strokeWidth="5" strokeLinecap="round" fill="none"
                  />
                  <ellipse cx={150} cy={135 + 18} rx="9" ry="11" fill="#bae6fd" />
                </>
              ) : (
                <>
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
                </>
              )}
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
              <p className={`text-center text-slate-800 dark:text-slate-900 font-extrabold text-[14px] sm:text-[15px] leading-relaxed max-w-[250px] whitespace-pre-line ${textTranslateClass}`}>
                {message}
              </p>
            </div>
          </div>
        </div>
      </>
    );
  };

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
        {/* Zoom-scale wrapper — kept separate from the float div so its inline
            transform isn't overridden by the float animation's transform.
            Det avlånga start-molnet visas i full storlek; när man klickat och det
            morphar till det runda default-molnet krymper det också (× 0.8). */}
        <div
          style={{
            transform: `scale(${scale * stateScale})`,
            transformOrigin: '50% 56.25%',
            transition: (isDragging || isGliding || skipTransition) ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
        <div className={`${!hasPoppedIn ? 'animate-cloud-pop-in' : ''} ${isDragging || isGliding || leaving ? '' : 'animate-cloud-float'}`}>

          {renderCloudBody(cloudBodyRotation, cloudBodyRotTransition)}

          {/* Pointer hit area — sized to match the visible cloud puff, not the SVG bounding box */}
          <div
            role="button"
            aria-label="Drag cloud"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onWheel={handleWheel}
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
    </div>
  );
}