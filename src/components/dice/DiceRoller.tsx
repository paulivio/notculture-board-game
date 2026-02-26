import { useRef, useEffect, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface DiceRollerProps {
  rolling: boolean;
  finalValue: number;
  onComplete: (() => void) | null;
}

// Camera is at [0, 0, 8] looking in -Z direction (default, no lookAt needed).
// The face MOST visible to this camera is the +Z face (dot product = 1.0).
// So FINAL_EULER must put the correct face on +Z (facing the camera).
//
// BoxGeometry face normals: +X, -X, +Y, -Y, +Z, -Z (material indices 0-5)
// Texture assignment:
//   index 0 → +X → dice-2
//   index 1 → -X → dice-5
//   index 2 → +Y → dice-1
//   index 3 → -Y → dice-6
//   index 4 → +Z → dice-3  ← faces camera with identity rotation
//   index 5 → -Z → dice-4
//
// FINAL_EULER[n]: rotation that brings face-n's normal to +Z
const FINAL_EULER: Record<number, [number, number, number]> = {
  1: [Math.PI / 2, 0, 0],    // +Y → +Z via rotateX(+90°)
  2: [0, -Math.PI / 2, 0],   // +X → +Z via rotateY(-90°)
  3: [0, 0, 0],               // +Z → +Z: already faces camera
  4: [0, Math.PI, 0],         // -Z → +Z via rotateY(180°)
  5: [0, Math.PI / 2, 0],    // -X → +Z via rotateY(+90°)
  6: [-Math.PI / 2, 0, 0],   // -Y → +Z via rotateX(-90°)
};

// Timeline
const ROLL_END   = 2.2;  // seconds — rolling phase ends
const SETTLE_END = 2.7;  // seconds — 500 ms snap to correct face
const DONE_MS    = 3500; // ms  — onComplete fires, overlay fades

const START_X  = -7;  // off-screen left (just outside ±tan(43°)×8 ≈ ±7.5 visible units)
const SETTLE_Y = 0;   // dice settles at world origin, camera centre

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeOutQuad(t: number)  { return 1 - Math.pow(1 - t, 2); }

const BASE_URL = import.meta.env.BASE_URL ?? "/";

function DiceScene({ rolling, finalValue, onComplete }: DiceRollerProps) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const startRef = useRef(0);
  const activeRef = useRef(false);

  // Captured once when the rolling phase ends so the settle slerp starts correctly
  const settleStarted = useRef(false);
  const settleFrom    = useRef(new THREE.Quaternion());
  const targetQuat    = useRef(new THREE.Quaternion());

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
  const textures = useTexture([
    `${BASE_URL}assets/dice/dice-2.png`, // +X
    `${BASE_URL}assets/dice/dice-5.png`, // -X
    `${BASE_URL}assets/dice/dice-1.png`, // +Y
    `${BASE_URL}assets/dice/dice-6.png`, // -Y
    `${BASE_URL}assets/dice/dice-3.png`, // +Z  ← faces camera at rest
    `${BASE_URL}assets/dice/dice-4.png`, // -Z
  ]);

  const materials = useMemo(
    () =>
      textures.map(
        (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.05 })
      ),
    [textures]
  );

  useEffect(() => {
    if (!rolling) {
      activeRef.current = false;
      return;
    }

    const mesh = meshRef.current;
    if (!mesh) return;

    // Random initial orientation so every roll looks different
    mesh.quaternion.setFromEuler(
      new THREE.Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      )
    );
    mesh.position.set(START_X, SETTLE_Y, 0);

    // Pre-build the exact target rotation
    const e = FINAL_EULER[finalValue] ?? FINAL_EULER[1];
    targetQuat.current.setFromEuler(new THREE.Euler(...e));

    startRef.current   = performance.now();
    settleStarted.current = false;
    activeRef.current  = true;

    const t = setTimeout(() => {
      activeRef.current = false;
      onCompleteRef.current?.();
    }, DONE_MS);

    return () => clearTimeout(t);
  }, [rolling, finalValue]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !activeRef.current) return;

    const elapsed = (performance.now() - startRef.current) / 1000;

    // ── 1. ROLLING (0 → ROLL_END) ──────────────────────────────────────
    if (elapsed < ROLL_END) {
      const t = elapsed / ROLL_END;

      // Move right from off-screen with ease-out (fast entry → natural slowdown)
      mesh.position.x = START_X + (-START_X) * easeOutCubic(t);
      // Gentle arc: starts at floor, peaks mid-travel, returns to floor
      mesh.position.y = SETTLE_Y + 1.2 * Math.sin(t * Math.PI);
      mesh.position.z = 0;

      // Spin proportional to movement speed so it looks like actual rolling.
      // easeOutCubic derivative = 3(1-t)² → fast at start, slows to zero.
      const speed = 3 * Math.pow(1 - t, 2);
      const spin = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          delta * 0.6 * speed,   // light X wobble (tumbling variety)
          delta * 0.2 * speed,   // light Y wobble
          delta * -3.5 * speed   // dominant -Z = rolling rightward
        )
      );
      // premultiply = apply in world space → correct rolling behaviour
      mesh.quaternion.premultiply(spin);

    // ── 2. SETTLING (ROLL_END → SETTLE_END, 500 ms snap) ───────────────
    } else if (elapsed < SETTLE_END) {
      // Capture the rotation at the exact frame the roll ends
      if (!settleStarted.current) {
        settleFrom.current.copy(mesh.quaternion);
        settleStarted.current = true;
        // Guarantee shortest-path slerp
        if (settleFrom.current.dot(targetQuat.current) < 0) {
          const q = targetQuat.current;
          q.set(-q.x, -q.y, -q.z, -q.w);
        }
      }

      const st = Math.min((elapsed - ROLL_END) / (SETTLE_END - ROLL_END), 1);
      // slerpQuaternions(a, b, t) is exact at t=1 — no floating point drift
      mesh.quaternion.slerpQuaternions(settleFrom.current, targetQuat.current, easeOutQuad(st));
      mesh.position.set(0, SETTLE_Y, 0);

    // ── 3. DISPLAY (SETTLE_END → DONE_MS/1000) ─────────────────────────
    } else {
      // Explicitly hold the exact target rotation — no drift possible
      mesh.quaternion.copy(targetQuat.current);
      mesh.position.set(0, SETTLE_Y, 0);
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      {materials.map((mat, i) => (
        <primitive key={i} object={mat} attach={`material-${i}`} />
      ))}
    </mesh>
  );
}

export default function DiceRoller({ rolling, finalValue, onComplete }: DiceRollerProps) {
  return (
    <AnimatePresence>
      {rolling && (
        <motion.div
          className="fixed inset-0 z-[5000] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
        >
          <Canvas
            // [0, 0, 8] looks directly along -Z — the +Z face is 100% facing
            // the camera when settled. No lookAt/CameraSetup hack needed.
            camera={{ position: [0, 0, 8], fov: 55 }}
            gl={{ alpha: true, antialias: true }}
            style={{ background: "transparent", width: "100%", height: "100%" }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[4, 6, 8]} intensity={1.0} castShadow />
            <pointLight position={[-4, 4, 2]} intensity={0.5} />
            <Suspense fallback={null}>
              <DiceScene
                rolling={rolling}
                finalValue={finalValue}
                onComplete={onComplete}
              />
            </Suspense>
          </Canvas>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
