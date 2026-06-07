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
  /** Live drag-offset i pixlar relativt anchorPos. Fyrar varje gång användaren
   *  drar molnet så föräldern kan rita t.ex. slangbella-gummiband som hänger
   *  med molnet i realtid. (0, 0) när molnet inte är draget. */
  onLiveOffsetChange?: (ox: number, oy: number) => void;
  /** Rapporterar molnets nuvarande (manuellt valda) mood uppåt — så föräldern
   *  kan föra över det till det andra molnet när man drar ett moln över det. */
  onMoodChange?: (mood: CloudExpression | null) => void;
  /** Mood som "stämplas" på molnet utifrån (när ett annat moln dras över det).
   *  Tillämpas när incomingMoodNonce ökar. */
  incomingMood?: CloudExpression | null;
  incomingMoodNonce?: number;
  /** Fyrar vid ett tryck (utan drag) på molnet — sol-molnet använder det för
   *  att fälla tillbaka kartans lutning. */
  onTap?: () => void;
  /** True när kartan är lutad. Då stabiliseras molnet rakt upp (ingen spin-
   *  rotation) så ansiktet står rakt — ögon upp, mun ner. */
  tilted?: boolean;
  /** Föräldern svarar med molnets perspektiv-djup vid en given skärmpunkt
   *  (1 = normalt djup, < 1 = långt bort i lutad vy). Anropas varje glide-frame
   *  med molnets nuvarande punkt så att friktionen ökar progressivt när molnet
   *  glider in i horisonten — då bromsas det in och flyger inte ut över kanten.
   *  Returnera 1 (eller utelämna proppen) för platt vy / ingen dämpning. */
  getDepthAtPoint?: (screenX: number, screenY: number) => number;
  /** Stacking-ordning för molnets overlay. Föräldern sätter det så att det
   *  MINSTA molnet alltid ligger överst (det stora hamnar bakom). Default 9999. */
  zIndex?: number;
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


// Ansiktet ritas i lokala face-koordinater (SVG); föräldern ger oss positionerna
// för ögon och mun-anchor + kontrollpunkt. Färgen "#bae6fd" matchar resten av
// uttrycken (sky-200). En `<g>`-wrapper gör att uttrycksbyten kan animeras med
// opacity/transform om vi vill, men nu räcker ett direkt byte.
type FacePoints = {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  mouthLeft: { x: number; y: number };
  mouthRight: { x: number; y: number };
  mouthCtrl: { x: number; y: number };
};

export type CloudExpression = 'neutral' | 'blink' | 'wink' | 'dizzy' | 'sleepy' | 'happy' | 'cool' | 'love' | 'surprised' | 'sad';

// Moods man bläddrar igenom genom att klicka på molnet (i ordning). Efter sista
// moodet → tillbaka till det levande auto-läget (slumpvisa blinkningar m.m.).
const MOOD_CYCLE: CloudExpression[] = ['neutral', 'happy', 'wink', 'cool', 'love', 'surprised', 'sad', 'sleepy', 'dizzy'];

function renderFace(
  expression: CloudExpression,
  p: FacePoints
) {
  const C = '#bae6fd';
  const smile = (
    <path
      d={`M ${p.mouthLeft.x} ${p.mouthLeft.y} Q ${p.mouthCtrl.x} ${p.mouthCtrl.y} ${p.mouthRight.x} ${p.mouthRight.y}`}
      stroke={C} strokeWidth="7" strokeLinecap="round" fill="none"
    />
  );
  const eyeOpen = (cx: number, cy: number) => (
    <circle cx={cx} cy={cy} r="7" fill={C} />
  );
  // Tunn vågrät linje = stängt öga (blink).
  const eyeClosed = (cx: number, cy: number) => (
    <line x1={cx - 7} y1={cy} x2={cx + 7} y2={cy} stroke={C} strokeWidth="5" strokeLinecap="round" />
  );
  // ^^ — glada kisögon.
  const eyeHappy = (cx: number, cy: number) => (
    <path
      d={`M ${cx - 7} ${cy + 3} Q ${cx} ${cy - 6} ${cx + 7} ${cy + 3}`}
      stroke={C} strokeWidth="5" strokeLinecap="round" fill="none"
    />
  );
  // Halvmåne = sömnigt halvslutet öga.
  const eyeSleepy = (cx: number, cy: number) => (
    <path
      d={`M ${cx - 7} ${cy + 1} Q ${cx} ${cy + 6} ${cx + 7} ${cy + 1}`}
      stroke={C} strokeWidth="5" strokeLinecap="round" fill="none"
    />
  );
  // Spiral för dizzy (förenklat som en X-formad markering — tydligt på små storlekar).
  const eyeDizzy = (cx: number, cy: number) => (
    <g stroke={C} strokeWidth="3.5" strokeLinecap="round" fill="none">
      <path d={`M ${cx - 7} ${cy - 7} L ${cx + 7} ${cy + 7}`} />
      <path d={`M ${cx + 7} ${cy - 7} L ${cx - 7} ${cy + 7}`} />
    </g>
  );

  switch (expression) {
    case 'happy':
      return (
        <>
          {eyeHappy(p.leftEye.x, p.leftEye.y)}
          {eyeHappy(p.rightEye.x, p.rightEye.y)}
          <ellipse cx={150} cy={p.leftEye.y + 36} rx="9" ry="11" fill={C} />
        </>
      );
    case 'blink':
      return (
        <>
          {eyeClosed(p.leftEye.x, p.leftEye.y)}
          {eyeClosed(p.rightEye.x, p.rightEye.y)}
          {smile}
        </>
      );
    case 'wink':
      return (
        <>
          {eyeClosed(p.leftEye.x, p.leftEye.y)}
          {eyeOpen(p.rightEye.x, p.rightEye.y)}
          {smile}
        </>
      );
    case 'dizzy':
      return (
        <>
          {eyeDizzy(p.leftEye.x, p.leftEye.y)}
          {eyeDizzy(p.rightEye.x, p.rightEye.y)}
          {/* Vågig mun. */}
          <path
            d={`M ${p.mouthLeft.x} ${p.mouthLeft.y + 4} q 6 -8 12 0 t 12 0 t 12 0`}
            stroke={C} strokeWidth="5" strokeLinecap="round" fill="none"
          />
        </>
      );
    case 'sleepy':
      return (
        <>
          {eyeSleepy(p.leftEye.x, p.leftEye.y)}
          {eyeSleepy(p.rightEye.x, p.rightEye.y)}
          {/* Liten avslappnad mun. */}
          <path
            d={`M ${p.mouthLeft.x + 4} ${p.mouthCtrl.y - 4} Q ${p.mouthCtrl.x} ${p.mouthCtrl.y - 1} ${p.mouthRight.x - 4} ${p.mouthCtrl.y - 4}`}
            stroke={C} strokeWidth="5" strokeLinecap="round" fill="none"
          />
        </>
      );
    case 'cool': {
      // Solglasögon: två mörka linser + brygga, plus avslappnat leende.
      const lw = 20, lh = 14, ry = p.leftEye.y;
      return (
        <>
          <rect x={p.leftEye.x - lw / 2} y={ry - lh / 2} width={lw} height={lh} rx="5" fill="#0f172a" opacity="0.92" />
          <rect x={p.rightEye.x - lw / 2} y={ry - lh / 2} width={lw} height={lh} rx="5" fill="#0f172a" opacity="0.92" />
          <line x1={p.leftEye.x + lw / 2 - 2} y1={ry} x2={p.rightEye.x - lw / 2 + 2} y2={ry} stroke="#0f172a" strokeWidth="3" />
          <line x1={p.leftEye.x - 5} y1={ry - 3} x2={p.leftEye.x - 1} y2={ry - 3} stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          {smile}
        </>
      );
    }
    case 'love': {
      // Hjärtögon (två puffar + en triangel = rent hjärta) + stort leende.
      const heart = (cx: number, cy: number) => (
        <g fill="#fb7185">
          <circle cx={cx - 3.2} cy={cy - 2} r="4" />
          <circle cx={cx + 3.2} cy={cy - 2} r="4" />
          <path d={`M ${cx - 6.6} ${cy - 0.2} L ${cx} ${cy + 7} L ${cx + 6.6} ${cy - 0.2} Z`} />
        </g>
      );
      return (
        <>
          {heart(p.leftEye.x, p.leftEye.y)}
          {heart(p.rightEye.x, p.rightEye.y)}
          {smile}
        </>
      );
    }
    case 'surprised':
      return (
        <>
          <circle cx={p.leftEye.x} cy={p.leftEye.y} r="9" fill={C} />
          <circle cx={p.rightEye.x} cy={p.rightEye.y} r="9" fill={C} />
          {/* Liten "O"-mun. */}
          <ellipse cx={150} cy={p.mouthCtrl.y} rx="6" ry="8" fill={C} />
        </>
      );
    case 'sad':
      return (
        <>
          {/* Lite hängande bryn + små ögon + nedåtböjd mun. */}
          <line x1={p.leftEye.x - 7} y1={p.leftEye.y - 9} x2={p.leftEye.x + 5} y2={p.leftEye.y - 5} stroke={C} strokeWidth="3" strokeLinecap="round" />
          <line x1={p.rightEye.x + 7} y1={p.rightEye.y - 9} x2={p.rightEye.x - 5} y2={p.rightEye.y - 5} stroke={C} strokeWidth="3" strokeLinecap="round" />
          <circle cx={p.leftEye.x} cy={p.leftEye.y + 1} r="6" fill={C} />
          <circle cx={p.rightEye.x} cy={p.rightEye.y + 1} r="6" fill={C} />
          <path
            d={`M ${p.mouthLeft.x} ${p.mouthLeft.y + 4} Q ${p.mouthCtrl.x} ${p.mouthLeft.y - 6} ${p.mouthRight.x} ${p.mouthLeft.y + 4}`}
            stroke={C} strokeWidth="7" strokeLinecap="round" fill="none"
          />
        </>
      );
    case 'neutral':
    default:
      return (
        <>
          {eyeOpen(p.leftEye.x, p.leftEye.y)}
          {eyeOpen(p.rightEye.x, p.rightEye.y)}
          {smile}
        </>
      );
  }
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
  glideStateRef,
  onLiveOffsetChange,
  onMoodChange,
  incomingMood,
  incomingMoodNonce,
  onTap,
  tilted = false,
  getDepthAtPoint,
  zIndex = 9999
}: CloudPopupProps) {
  // Ref-cache så glide-tick alltid läser senaste callbacken utan att bindas om.
  const getDepthAtPointRef = useRef(getDepthAtPoint);
  getDepthAtPointRef.current = getDepthAtPoint;
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
  // Karaktärsuttryck — molnet är en levande karaktär:
  //   neutral   — default leende
  //   blink     — kort blink (~150ms), kommer slumpvis var 3–6:e sekund
  //   wink      — vänster öga blundar, höger är öppet — typ var 4:e blink
  //   surprised — stora ögon + liten O-mun, triggas medan man håller molnet
  //   dizzy     — spiralögon + vågig mun, efter en kraftig spin
  //   sleepy    — tunga ögonlock + litet leende, efter lång inaktivitet
  //   happy     — ^^-ögon + öppen glad mun, samma som följa-läget
  type Expression = CloudExpression;
  const [expression, setExpression] = useState<Expression>('neutral');
  // Manuellt valt mood via klick. null = det levande auto-läget (blink/wink/…).
  const [manualMood, setManualMood] = useState<Expression | null>(null);

  // Rapportera molnets mood uppåt så föräldern kan föra över det till det andra
  // molnet när man drar ett moln över det.
  const onMoodChangeRef = useRef(onMoodChange);
  onMoodChangeRef.current = onMoodChange;
  useEffect(() => {
    onMoodChangeRef.current?.(manualMood);
  }, [manualMood]);

  // Stämpla på ett mood utifrån (när det andra molnet dras över detta). Körs när
  // nonce ökar, så samma mood kan stämplas på flera gånger.
  const prevIncomingNonceRef = useRef(0);
  useEffect(() => {
    if (incomingMoodNonce && incomingMoodNonce !== prevIncomingNonceRef.current) {
      prevIncomingNonceRef.current = incomingMoodNonce;
      setManualMood(incomingMood ?? null);
      setClicked(true); // se till att ansiktet visas
    }
  }, [incomingMoodNonce, incomingMood]);
  const lastInteractionAtRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const dizzyTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Serietidnings-"GRABB!"-effekt: korta actionlinjer som blixtrar utåt runt
  // molnet vid grepp och fadar bort på ~400ms. En key bumpas vid varje nytt
  // grepp så animationen återstartar även om man greppar igen direkt.
  const [grabBurstKey, setGrabBurstKey] = useState(0);
  const prevIsDraggingRef = useRef(false);
  useEffect(() => {
    if (isDragging && !prevIsDraggingRef.current) {
      setGrabBurstKey(k => k + 1);
    }
    prevIsDraggingRef.current = isDragging;
  }, [isDragging]);
  // Resting rotation = the rotation the cloud has when its position has been
  // stable for a short moment. It only updates after any kind of motion
  // (cloud drag, glide, OR map pan moving anchorPos) has settled. While
  // anything is in motion, this value stays put — the face stays where it was.
  const [restingRotation, setRestingRotation] = useState(0);
  const [dragSpinAngle, setDragSpinAngle] = useState(0);
  // Pausa vind- och float-animationen så fort pekaren är ovanför grab-ytan, så
  // molnet inte "hoppar undan" i samma sekund man försöker ta tag i det.
  const [pointerOverGrab, setPointerOverGrab] = useState(false);
const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Rapportera live drag-offset till föräldern (slangbella-banden använder den
  // för att stretcha med molnet i realtid). Ref-cache så vi inte binder om hookar.
  const onLiveOffsetChangeRef = useRef(onLiveOffsetChange);
  onLiveOffsetChangeRef.current = onLiveOffsetChange;
  useEffect(() => {
    onLiveOffsetChangeRef.current?.(offset.x, offset.y);
  }, [offset.x, offset.y]);

  // Fartvind-svans: när man drar/slänger molnet (det är "taggat flyta") ritas
  // motion-streck BAKOM det i motsatt riktning mot rörelsen. `trail.sp` = farten
  // (px/~16ms) som styr längd + opacitet, (ux, uy) = rörelsens enhetsriktning.
  // En egen rAF-loop mäter molnets faktiska skärmposition per frame (ankare +
  // offset) så svansen tonar ut av sig själv när man håller stilla, och inga
  // "teleport"-hopp (offset→0 vid commit som ankaret kompenserar) ger falska streck.
  const [trail, setTrail] = useState<{ ux: number; uy: number; sp: number }>({ ux: 0, uy: 0, sp: 0 });
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const anchorPosRef = useRef(anchorPos);
  anchorPosRef.current = anchorPos;
  const trailVecRef = useRef({ x: 0, y: 0 });
  const trailPrevPosRef = useRef<{ x: number; y: number } | null>(null);
  const trailRafRef = useRef<number | null>(null);
  useEffect(() => {
    const screenPos = () => {
      const a = anchorPosRef.current;
      const o = offsetRef.current;
      const cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
      const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 500;
      return { x: (a?.x ?? cx) + o.x, y: (a?.y ?? cy) + o.y };
    };
    const hasTail = Math.hypot(trailVecRef.current.x, trailVecRef.current.y) > 0.01;
    if (!isDragging && !isGliding && !hasTail) return;
    trailPrevPosRef.current = screenPos();
    let lastT = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(Math.max(t - lastT, 1), 32);
      lastT = t;
      const cur = screenPos();
      const prev = trailPrevPosRef.current!;
      let ix = cur.x - prev.x;
      let iy = cur.y - prev.y;
      trailPrevPosRef.current = cur;
      // Ignorera teleport-hopp (commit nollar offset medan ankaret kompenserar).
      if (Math.hypot(ix, iy) > 200) { ix = 0; iy = 0; }
      const nx = ix * (16 / dt);
      const ny = iy * (16 / dt);
      const k = 0.4; // utjämning mot momentan rörelse
      trailVecRef.current = {
        x: trailVecRef.current.x + (nx - trailVecRef.current.x) * k,
        y: trailVecRef.current.y + (ny - trailVecRef.current.y) * k
      };
      const sp = Math.hypot(trailVecRef.current.x, trailVecRef.current.y);
      if (sp > 0.4) {
        setTrail({ ux: trailVecRef.current.x / sp, uy: trailVecRef.current.y / sp, sp });
      } else {
        setTrail(prevT => (prevT.sp === 0 ? prevT : { ux: 0, uy: 0, sp: 0 }));
      }
      if (isDragging || isGliding || sp > 0.4) {
        trailRafRef.current = requestAnimationFrame(loop);
      } else {
        trailVecRef.current = { x: 0, y: 0 };
        trailRafRef.current = null;
      }
    };
    trailRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (trailRafRef.current) { cancelAnimationFrame(trailRafRef.current); trailRafRef.current = null; }
    };
  }, [isDragging, isGliding]);
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
  // Tryck-tajming: enkeltryck byter mood, dubbeltryck växlar kamera-följning (POV).
  const lastTapAtRef = useRef(0);
  const moodBeforeTapRef = useRef<Expression | null>(null);

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

    // Tap (no meaningful movement). Enkeltryck = byt molnets mood; dubbeltryck =
    // växla kamera-följning (POV). Inget glid.
    if (!dragMoved.current) {
      setClicked(true);
      velocitySamples.current = [];
      setOffset({ x: 0, y: 0 });
      onTap?.(); // t.ex. sol-molnet: fäll tillbaka kartans lutning

      const now = performance.now();
      const isDouble = now - lastTapAtRef.current < 300;
      lastTapAtRef.current = isDouble ? 0 : now;

      if (isDouble) {
        // Andra trycket i paret: ångra mood-stegningen från första trycket och
        // växla istället kamera-följningen.
        setManualMood(moodBeforeTapRef.current);
        onToggleFollow?.();
      } else {
        // Enkeltryck: stega till nästa mood. Efter sista moodet → null = det
        // levande auto-läget (slumpvisa blinkningar igen).
        setManualMood(prev => {
          moodBeforeTapRef.current = prev;
          if (prev === null) return MOOD_CYCLE[0];
          const i = MOOD_CYCLE.indexOf(prev);
          return i === MOOD_CYCLE.length - 1 ? null : MOOD_CYCLE[i + 1];
        });
      }
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

      // Djup-skalad friktion: i lutad vy returnerar föräldern < 1 för molnets
      // nuvarande skärmpunkt när det ligger långt bort. Vi delar friktionen
      // med djupet → ju mindre djup desto snabbare avtagande hastighet, så
      // ett moln som kastas in i horisonten bromsas in och stannar innan det
      // glider ut över skärmkanten. Platt vy / ingen callback → depth = 1.
      const depthCb = getDepthAtPointRef.current;
      const depth = depthCb
        ? Math.max(depthCb(baseX + curX, baseY + curY), 0.25)
        : 1;
      const effectiveFriction = friction / depth;
      const decay = Math.exp(-effectiveFriction * dt / 1000);
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

  // Räkna det som "interaktion" varje gång molnet rörs (drag, glide, follow-toggle).
  // Sleepy-läget triggas bara när inget hänt på en stund.
  useEffect(() => {
    if (isDragging || isGliding || following) {
      lastInteractionAtRef.current = performance.now();
    }
  }, [isDragging, isGliding, following]);

  // Driver expression-tillståndet utifrån interaktion + en slumpvis blink/wink-loop.
  // Prio: leaving > dizzy > surprised > happy > sleepy > blink/wink/neutral.
  useEffect(() => {
    if (!visible || !clicked) return;

    // Manuellt valt mood (via klick) låser ansiktet — auto-blinkandet pausas.
    if (manualMood !== null) return;

    // Höga prio: follow tar över direkt. Drag tar INTE över längre — molnet
    // behåller sitt vanliga uttryck när man greppar, och en grabb-burst-effekt
    // (actionlinjer) ritas separat utanför ansiktet.
    if (following) {
      setExpression('happy');
      return;
    }
    if (isDragging) return; // ingen ändring — sitt kvar i nuvarande uttryck

    // Schemaläggning av blink/wink/sleepy via timer.
    let timer: NodeJS.Timeout;
    const schedule = () => {
      const sinceLast = performance.now() - lastInteractionAtRef.current;
      // Inaktiv > 25s → halvblunda av och till.
      if (sinceLast > 25_000 && Math.random() < 0.45) {
        setExpression('sleepy');
        timer = setTimeout(() => { setExpression('neutral'); schedule(); }, 1800);
        return;
      }
      // ~12% av blinkningarna blir winks för lite personlighet.
      const isWink = Math.random() < 0.12;
      setExpression(isWink ? 'wink' : 'blink');
      timer = setTimeout(() => {
        setExpression('neutral');
        // Nästa blink om 2.5–5.5s.
        const next = 2500 + Math.random() * 3000;
        timer = setTimeout(schedule, next);
      }, isWink ? 280 : 140);
    };
    // Lite slumpvis fördröjning innan första blinken så molnen inte synkar.
    const startDelay = 1500 + Math.random() * 2500;
    timer = setTimeout(schedule, startDelay);
    return () => clearTimeout(timer);
  }, [visible, clicked, isDragging, following, manualMood]);

  // När ett glid är slut OCH spinnet varit stort → kort dizzy-snurr.
  // Hooked in på handlePointerUp-flödet via dragSpinAngle-jämförelser hade krävt
  // mer state-trådning; istället övervakar vi förändringar i restingRotation:
  // ett stort hopp = nyss bakat in spin → dizzy en stund.
  const prevRestingRotRef = useRef(restingRotation);
  useEffect(() => {
    const delta = Math.abs(restingRotation - prevRestingRotRef.current);
    prevRestingRotRef.current = restingRotation;
    if (delta > 270 && !isDragging && !following) {
      setExpression('dizzy');
      if (dizzyTimerRef.current) clearTimeout(dizzyTimerRef.current);
      dizzyTimerRef.current = setTimeout(() => setExpression('neutral'), 1400);
    }
  }, [restingRotation, isDragging, following]);

  useEffect(() => () => { if (dizzyTimerRef.current) clearTimeout(dizzyTimerRef.current); }, []);

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
  // När kartan är lutad stabiliseras molnet rakt upp (rotation 0) så ansiktet
  // står rakt — ögon upp, mun ner — istället för att luta med ev. kast-spin.
  const currentRotation = tilted ? 0 : (restingRotation + dragSpinAngle);
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

  // z-index sätts via inline-stil (zIndex-propen) så föräldern kan ordna molnen
  // sinsemellan — minsta överst. Behåller annars samma lager som tidigare (9999).
  const outerClassName = isAnchored
    ? "fixed inset-0 pointer-events-none"
    : `fixed inset-0 flex pointer-events-none ${wrapperPositionClass}`;

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
  // När kartan är lutad återgår molnet till den breda formen (som i start-läget)
  // — då ser det bättre ut i 3D-vyn. `clicked` styr fortfarande ansikte/text,
  // så ansiktet och all funktionalitet behålls; `tilted` styr bara silhuetten.
  const activeCircles = (clicked && !tilted) ? baseCircles : elongatedCircles;

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

        {/* LAYER 2.5: Fartvind-svans — motion-streck BAKOM molnkroppen i motsatt
            riktning mot rörelsen (molnet är "taggat flyta"). Skärm-orienterad
            (ingen body-rotation) så strecken pekar längs den faktiska rörelsen.
            Ligger ovanför de suddiga skugglagren men UNDER de vita puffarna, så
            de inre ändarna göms av molnet och svansarna sticker ut bakåt. Längd +
            opacitet skalar med farten och tonar ut när man stannar. */}
        {trail.sp > 0.6 && (() => {
          const bx = -trail.ux, by = -trail.uy;   // bakåt (motsatt rörelse)
          const px = -by, py = bx;                 // vinkelrätt mot rörelsen
          // Strecken måste sträcka sig långt FÖRBI molnkroppen (radie ~95) för att
          // synas — annars göms de helt av puffarna. Därför rejäl längd.
          const baseLen = Math.min(Math.max(trail.sp * 14, 70), 270);
          const baseOp = Math.min(0.25 + trail.sp * 0.06, 0.8);
          const streaks = [-50, -32, -15, -2, 16, 34, 50];
          return (
            <svg
              viewBox="0 0 300 240"
              className={`${sizeClass} absolute inset-0 pointer-events-none`}
              style={{ overflow: 'visible', opacity: baseOp }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <g stroke="#ffffff" strokeLinecap="round" fill="none">
                {streaks.map((o, i) => {
                  const edgeFade = 1 - 0.5 * Math.min(Math.abs(o) / 52, 1);
                  const len = baseLen * edgeFade;
                  const startR = 26;
                  const sx = 150 + px * o + bx * startR;
                  const sy = 135 + py * o + by * startR;
                  const ex = sx + bx * len;
                  const ey = sy + by * len;
                  const sw = (5.5 - Math.abs(o) / 16) * edgeFade + 1.2;
                  return (
                    <line key={i} x1={sx} y1={sy} x2={ex} y2={ey} strokeWidth={sw} opacity={0.5 + 0.5 * edgeFade} />
                  );
                })}
              </g>
            </svg>
          );
        })()}

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
              {renderFace(following ? 'happy' : (manualMood ?? expression), { leftEye, rightEye, mouthLeft, mouthRight, mouthCtrl })}
            </g>

            {/* Serietidnings-grabb-effekt: 10 korta actionlinjer i en cirkel runt
                molnet, en burst per gång man tar tag. key=grabBurstKey gör att
                <g> remountas vid varje grepp så CSS-animationen startar om. */}
            {grabBurstKey > 0 && (
              <g key={`grab-burst-${grabBurstKey}`} className="animate-cloud-grab-burst" style={{ pointerEvents: 'none' }}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                  const rInner = 110;
                  const rOuter = 138;
                  const x1 = 150 + Math.cos(angle) * rInner;
                  const y1 = 135 + Math.sin(angle) * rInner;
                  const x2 = 150 + Math.cos(angle) * rOuter;
                  const y2 = 135 + Math.sin(angle) * rOuter;
                  return (
                    <line
                      key={i}
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="#0284c7"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            )}

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
    <div className={outerClassName} style={{ zIndex }}>
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
        <div
          className={isDragging || isGliding || leaving ? '' : 'animate-cloud-windy-intro'}
          style={pointerOverGrab ? { animationPlayState: 'paused' } : undefined}
        >
        <div
          className={`${!hasPoppedIn ? 'animate-cloud-pop-in' : ''} ${isDragging || isGliding || leaving ? '' : 'animate-cloud-float'}`}
          style={pointerOverGrab ? { animationPlayState: 'paused' } : undefined}
        >

          {renderCloudBody(cloudBodyRotation, cloudBodyRotTransition)}

          {/* Pointer hit area — sized to match the visible cloud puff, not the SVG bounding box */}
          <div
            role="button"
            aria-label="Drag cloud"
            onPointerEnter={() => setPointerOverGrab(true)}
            onPointerLeave={() => setPointerOverGrab(false)}
            onPointerDown={(e) => { setPointerOverGrab(true); handlePointerDown(e); }}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => { setPointerOverGrab(false); handlePointerUp(e); }}
            onPointerCancel={(e) => { setPointerOverGrab(false); handlePointerCancel(e); }}
            onWheel={handleWheel}
            className="absolute cursor-grab active:cursor-grabbing select-none pointer-events-auto touch-none"
            style={{
              left: '14%',
              top: '20%',
              width: '72%',
              height: '70%',
              borderRadius: '50%'
            }}
          />
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}