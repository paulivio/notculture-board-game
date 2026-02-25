import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DiceRollerProps {
  rolling: boolean;
  finalValue: number;
  onComplete: (() => void) | null;
}

const FACE_ROTATIONS: Record<number, { rotateX: number; rotateY: number }> = {
  1: { rotateX: 0, rotateY: 0 },
  2: { rotateX: 0, rotateY: -90 },
  3: { rotateX: 0, rotateY: -180 },
  4: { rotateX: 0, rotateY: 90 },
  5: { rotateX: -90, rotateY: 0 },
  6: { rotateX: 90, rotateY: 0 },
};

const FACE_TRANSFORMS = [
  { rotateX: 0, rotateY: 0, translateZ: 60 },      // face 1
  { rotateX: 0, rotateY: 90, translateZ: 60 },      // face 2
  { rotateX: 0, rotateY: 180, translateZ: 60 },     // face 3
  { rotateX: 0, rotateY: -90, translateZ: 60 },     // face 4
  { rotateX: 90, rotateY: 0, translateZ: 60 },      // face 5
  { rotateX: -90, rotateY: 0, translateZ: 60 },     // face 6
];

type Phase = "flying" | "spinning" | "landing" | "done";

export default function DiceRoller({
  rolling,
  finalValue,
  onComplete,
}: DiceRollerProps) {
  const [phase, setPhase] = useState<Phase>("done");
  const [spinRotation, setSpinRotation] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!rolling) return;

    setPhase("flying");
    setSpinRotation({ x: 0, y: 0 });

    // Spin phase
    const spinTimer = setTimeout(() => {
      setPhase("spinning");
      setSpinRotation({ x: 720, y: 576 });
    }, 100);

    // Land phase
    const landTimer = setTimeout(() => {
      setPhase("landing");
    }, 800);

    // Complete
    const doneTimer = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 3200);

    return () => {
      clearTimeout(spinTimer);
      clearTimeout(landTimer);
      clearTimeout(doneTimer);
    };
  }, [rolling, finalValue, onComplete]);

  const finalRotation = FACE_ROTATIONS[finalValue] ?? FACE_ROTATIONS[1];

  return (
    <AnimatePresence>
      {rolling && phase !== "done" && (
        <motion.div
          className="fixed z-[5000] pointer-events-none"
          style={{ perspective: 1000, top: "50%", left: "50%" }}
          initial={{ x: "-150vw", y: "-50%" }}
          animate={
            phase === "flying"
              ? { x: "-150vw", y: "-50%" }
              : { x: "-50%", y: "-50%" }
          }
          exit={{ opacity: 0 }}
          transition={
            phase === "flying"
              ? { duration: 0.05 }
              : { type: "spring", stiffness: 80, damping: 14, mass: 1 }
          }
        >
          <motion.div
            className="relative w-[120px] h-[120px]"
            style={{ transformStyle: "preserve-3d" }}
            animate={
              phase === "landing"
                ? {
                    rotateX: finalRotation.rotateX,
                    rotateY: finalRotation.rotateY,
                  }
                : {
                    rotateX: spinRotation.x,
                    rotateY: spinRotation.y,
                  }
            }
            transition={
              phase === "landing"
                ? { duration: 0.8, ease: [0.17, 0.67, 0.25, 1.2] }
                : { duration: 0.7, ease: "easeOut" }
            }
          >
            {FACE_TRANSFORMS.map((face, i) => (
              <div
                key={i}
                className="absolute w-[120px] h-[120px] bg-white rounded-2xl flex items-center justify-center text-5xl font-bold text-black border-2 border-gray-300"
                style={{
                  transform: `rotateX(${face.rotateX}deg) rotateY(${face.rotateY}deg) translateZ(${face.translateZ}px)`,
                  backfaceVisibility: "hidden",
                }}
              >
                {i + 1}
              </div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
