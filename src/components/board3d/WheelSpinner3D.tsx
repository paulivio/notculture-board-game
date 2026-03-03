import { useRef, useEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Text3D, Center } from "@react-three/drei";
import * as THREE from "three";
import type { FontData } from "@react-three/drei";
import { useSound } from "../../hooks/useSound";
// three.js bundled font — JSON is allowed by resolveJsonModule: true
import helvetikerBold from "three/examples/fonts/helvetiker_bold.typeface.json";

interface WheelSpinner3DProps {
  rolling: boolean;
  finalValue: number;
  onComplete: (() => void) | null;
  onClick: () => void;
  locked: boolean;
  segmentColors: string[];
}

const WHEEL_R = 1.3;
const THICKNESS = 0.10;
const LABEL_R = WHEEL_R * 0.55;
const DEG2RAD = Math.PI / 180;
const SPIN_DURATION = 3000;

// Cubic bezier easing: [0.05, 0.7, 0.1, 1.0]
function bezierAt(t: number) {
  const mt = 1 - t;
  return {
    x: 3 * mt * mt * t * 0.05 + 3 * mt * t * t * 0.1 + t * t * t,
    y: 3 * mt * mt * t * 0.7 + 3 * mt * t * t * 1.0 + t * t * t,
  };
}

function timeForProgress(p: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bezierAt(mid).y < p) lo = mid;
    else hi = mid;
  }
  return bezierAt((lo + hi) / 2).x;
}

function buildSegmentGeo(index: number): THREE.ExtrudeGeometry {
  const start = (-90 + index * 60) * DEG2RAD;
  const end = start + 60 * DEG2RAD;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(Math.cos(start) * WHEEL_R, Math.sin(start) * WHEEL_R);
  shape.absarc(0, 0, WHEEL_R, start, end, false);
  shape.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(shape, { depth: THICKNESS, bevelEnabled: false });
}

export default function WheelSpinner3D({
  rolling,
  finalValue,
  onComplete,
  onClick,
  locked,
  segmentColors,
}: WheelSpinner3DProps) {
  const { playTick } = useSound();

  const wheelRef = useRef<THREE.Group>(null!);
  const tickerRef = useRef<THREE.Group>(null!);

  const startRotRef = useRef(0);
  const targetRotRef = useRef(0);
  const startTimeRef = useRef(0);
  const isSpinningRef = useRef(false);
  const accumRotRef = useRef(0);
  const tickerDeflectRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const tickTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Build segment geometries and materials once
  const segmentGeosRef = useRef<THREE.ExtrudeGeometry[]>([]);
  const segmentMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  if (segmentGeosRef.current.length === 0) {
    for (let i = 0; i < 6; i++) {
      segmentGeosRef.current.push(buildSegmentGeo(i));
      segmentMatsRef.current.push(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(segmentColors[i] ?? "#888888"),
        })
      );
    }
  }

  useEffect(() => {
    segmentMatsRef.current.forEach((mat, i) => {
      mat.color.set(segmentColors[i] ?? "#888888");
    });
  }, [segmentColors]);


  useEffect(() => {
    if (!rolling) return;

    const segCentre = (finalValue - 1) * 60 + 30;
    const targetAngle = (360 - segCentre) % 360;
    const currentAngle = accumRotRef.current % 360;
    const delta = (targetAngle - currentAngle + 360) % 360;
    const totalDeg = 1440 + delta;
    accumRotRef.current += totalDeg;

    startRotRef.current = accumRotRef.current - totalDeg;
    targetRotRef.current = accumRotRef.current;
    startTimeRef.current = performance.now();
    isSpinningRef.current = true;

    tickTimeoutsRef.current.forEach(clearTimeout);
    tickTimeoutsRef.current = [];

    // Pegs are spaced every 60°. Figure out how far the wheel already is past
    // the last peg so the first tick aligns with the actual first peg contact,
    // not just "60° from wherever the previous spin happened to stop".
    const remainder = startRotRef.current % 60;
    const degToFirstPeg = remainder === 0 ? 60 : (60 - remainder);

    for (let deg = degToFirstPeg; deg <= totalDeg; deg += 60) {
      const progress = deg / totalDeg;
      const ms = timeForProgress(progress) * SPIN_DURATION;
      tickTimeoutsRef.current.push(
        setTimeout(playTick, ms),
        setTimeout(() => {
          tickerDeflectRef.current = 0.32;
        }, ms)
      );
    }

    return () => {
      tickTimeoutsRef.current.forEach(clearTimeout);
      tickTimeoutsRef.current = [];
    };
  }, [rolling]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!wheelRef.current || !tickerRef.current) return;

    if (isSpinningRef.current) {
      const elapsed = performance.now() - startTimeRef.current;
      const t = Math.min(elapsed / SPIN_DURATION, 1);
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (bezierAt(mid).x < t) lo = mid;
        else hi = mid;
      }
      const eased = bezierAt((lo + hi) / 2).y;
      const rot = startRotRef.current + (targetRotRef.current - startRotRef.current) * eased;
      wheelRef.current.rotation.z = -rot * DEG2RAD;

      if (t >= 1) {
        isSpinningRef.current = false;
        wheelRef.current.rotation.z = -targetRotRef.current * DEG2RAD;
        onCompleteRef.current?.();
      }
    }

    tickerDeflectRef.current *= Math.pow(0.001, delta);
    tickerRef.current.rotation.z = tickerDeflectRef.current;
  });

  const isClickable = !locked && !rolling;

  // 6 peg positions at each segment boundary (0°, 60°, … from −90° base)
  const pegAngles = Array.from({ length: 6 }, (_, i) => (-90 + i * 60) * DEG2RAD);

  return (
    <group>
      {/* Rotating wheel group */}
      <group ref={wheelRef}>
        {/* Segments */}
        {segmentGeosRef.current.map((geo, i) => (
          <mesh
            key={i}
            geometry={geo}
            material={segmentMatsRef.current[i]}
            position={[0, 0, -THICKNESS / 2]}
            onClick={isClickable ? onClick : undefined}
            onPointerEnter={() => {
              if (isClickable) document.body.style.cursor = "pointer";
            }}
            onPointerLeave={() => {
              document.body.style.cursor = "";
            }}
          />
        ))}

        {/* Small cylinder pegs at each segment boundary at the rim — no long lines */}
        {pegAngles.map((angleRad, i) => {
          const px = Math.cos(angleRad) * (WHEEL_R - 0.04);
          const py = Math.sin(angleRad) * (WHEEL_R - 0.04);
          return (
            <mesh key={`peg-${i}`} position={[px, py, 0]} rotation={[Math.PI / 2, 0, 0]}>
              {/* CylinderGeometry default axis is Y; rotate PI/2 around X to align with Z */}
              <cylinderGeometry args={[0.04, 0.04, THICKNESS + 0.06, 8]} />
              <meshStandardMaterial color="white" />
            </mesh>
          );
        })}

        {/* Centre hub */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, THICKNESS + 0.04, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Extruded numbers 1–6, one per segment */}
        <Suspense fallback={null}>
          {Array.from({ length: 6 }, (_, i) => {
            const value = i + 1;
            // Segment i spans angles (-90 + i*60)° to (-90 + i*60 + 60)°
            // Centre of segment i in the XY plane:
            const midAngle = (-90 + i * 60 + 30) * DEG2RAD;
            const cx = Math.cos(midAngle) * LABEL_R;
            const cy = Math.sin(midAngle) * LABEL_R;
            return (
              <Center
                key={`num-${i}`}
                position={[cx, cy, THICKNESS / 2]}
                rotation={[0, 0, midAngle - Math.PI / 2]}
              >
                <Text3D
                  font={helvetikerBold as unknown as FontData}
                  size={0.28}
                  height={0.07}
                  curveSegments={8}
                  bevelEnabled={false}
                >
                  {String(value)}
                  <meshStandardMaterial color="white" roughness={0.3} metalness={0.1} />
                </Text3D>
              </Center>
            );
          })}
        </Suspense>
      </group>

      {/* Outer decorative ring (fixed, not rotating) */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[WHEEL_R + 0.06, 0.04, 8, 64]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Ticker — shorter pointer at 12 o'clock */}
      <group ref={tickerRef} position={[0, WHEEL_R + 0.06, THICKNESS / 2]}>
        <mesh position={[0, -0.10, 0]}>
          <boxGeometry args={[0.05, 0.20, 0.07]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>
    </group>
  );
}
