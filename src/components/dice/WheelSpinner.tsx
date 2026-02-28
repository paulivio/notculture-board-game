import { useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { useSound } from "../../hooks/useSound";

interface WheelSpinnerProps {
  rolling: boolean;
  finalValue: number;
  onComplete: (() => void) | null;
  onClick: () => void;
  locked: boolean;
}

// Segment colours for values 1–6 — one unique colour per segment
// film=#800080, science=#4682b4, general=#008000, history=#ffa500, culture=#c026d3, not=#f97316
const SEGMENT_COLORS: Record<number, string> = {
  1: "#800080",
  2: "#4682b4",
  3: "#008000",
  4: "#ffa500",
  5: "#c026d3",
  6: "#f97316",
};

const CX = 100;
const CY = 100;
const R = 88;
const LABEL_R = 60;
const SPIN_DURATION_MS = 3000;

// Cubic bezier easing: [0.05, 0.7, 0.1, 1.0] — matches the controls.start transition
// Maps t∈[0,1] to { x: normalised-time, y: progress }
function bezierAt(t: number) {
  const mt = 1 - t;
  return {
    x: 3 * mt * mt * t * 0.05 + 3 * mt * t * t * 0.1 + t * t * t,
    y: 3 * mt * mt * t * 0.7  + 3 * mt * t * t * 1.0 + t * t * t,
  };
}

// Binary-search for the normalised time (x) when progress = p
function timeForProgress(p: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bezierAt(mid).y < p) lo = mid; else hi = mid;
  }
  return bezierAt((lo + hi) / 2).x;
}

/** SVG arc path for one 60° pie segment (index 0–5). */
function buildSegmentPath(index: number): string {
  const startDeg = index * 60 - 90;
  const endDeg = startDeg + 60;
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const x1 = CX + R * Math.cos(startRad);
  const y1 = CY + R * Math.sin(startRad);
  const x2 = CX + R * Math.cos(endRad);
  const y2 = CY + R * Math.sin(endRad);
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
}

/** Centre position and rotation angle for a segment label. */
function labelTransform(index: number): { x: number; y: number; rotate: number } {
  // midDeg: angle of segment centre, clockwise from 12 o'clock (SVG convention)
  const midDeg = index * 60 - 90 + 30;
  const midRad = (midDeg * Math.PI) / 180;
  return {
    x: CX + LABEL_R * Math.cos(midRad),
    y: CY + LABEL_R * Math.sin(midRad),
    rotate: midDeg, // rotate text so it radiates from centre
  };
}

export default function WheelSpinner({
  rolling,
  finalValue,
  onComplete,
  onClick,
  locked,
}: WheelSpinnerProps) {
  const controls = useAnimation();
  const rotationRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const tickTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { playTick } = useSound();

  useEffect(() => {
    if (!rolling) return;

    // Segment N's centre is at (N-1)*60 + 30° clockwise from 12 o'clock.
    // We want that centre to land at 0° (12 o'clock / pointer position).
    // targetAngle = absolute effective rotation that shows value N at top.
    // delta = how much MORE to rotate from current position to reach targetAngle.
    // Using delta (not targetAngle directly) fixes drift on consecutive spins.
    const segCentre = (finalValue - 1) * 60 + 30;
    const targetAngle = (360 - segCentre) % 360;
    const currentAngle = rotationRef.current % 360;
    const delta = (targetAngle - currentAngle + 360) % 360;
    const totalDeg = 1440 + delta;
    const next = rotationRef.current + totalDeg;
    rotationRef.current = next;

    // Schedule one tick per 60° boundary crossing, timed to match the easing curve
    tickTimeoutsRef.current.forEach(clearTimeout);
    tickTimeoutsRef.current = [];
    const clickCount = Math.floor(totalDeg / 60);
    for (let k = 1; k <= clickCount; k++) {
      const progress = (k * 60) / totalDeg;
      const ms = timeForProgress(progress) * SPIN_DURATION_MS;
      tickTimeoutsRef.current.push(setTimeout(playTick, ms));
    }

    controls
      .start({
        rotate: next,
        transition: { duration: 3, ease: [0.05, 0.7, 0.1, 1] },
      })
      .then(() => {
        onCompleteRef.current?.();
      });

    return () => {
      tickTimeoutsRef.current.forEach(clearTimeout);
      tickTimeoutsRef.current = [];
    };
  }, [rolling]); // eslint-disable-line react-hooks/exhaustive-deps

  const isClickable = !locked && !rolling;

  return (
    <div className="flex flex-col items-center select-none">
      <div
        className={`relative w-[120px] lg:w-[180px] ${isClickable ? "cursor-pointer" : locked ? "opacity-50 cursor-not-allowed" : "cursor-default"}`}
        onClick={isClickable ? onClick : undefined}
      >
        <svg
          viewBox="0 0 200 210"
          width="100%"
          height="auto"
          aria-label="Spin the wheel"
        >
          {/* Downward-pointing pointer above the wheel, apex touching the rim */}
          <polygon
            points="88,0 112,0 100,16"
            fill="#ef4444"
            stroke="#b91c1c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Rotating wheel group — fill-box makes transform-origin relative to
              this element's own bounding box, so 50% 50% = exact wheel centre */}
          <motion.g
            style={{
              transformBox: "fill-box",
              transformOrigin: "50% 50%",
            }}
            animate={controls}
          >
            {Array.from({ length: 6 }, (_, i) => {
              const value = i + 1;
              const { x, y, rotate } = labelTransform(i);
              return (
                <g key={value}>
                  <path
                    d={buildSegmentPath(i)}
                    fill={SEGMENT_COLORS[value]}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize="20"
                    fontWeight="bold"
                    transform={`rotate(${rotate + 90}, ${x}, ${y})`}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {value}
                  </text>
                </g>
              );
            })}
            {/* Centre cap */}
            <circle cx={CX} cy={CY} r="10" fill="white" stroke="#aaa" strokeWidth="1" />
          </motion.g>
        </svg>
      </div>
    </div>
  );
}
