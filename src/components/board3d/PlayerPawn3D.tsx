import { useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { LatheGeometry, Vector2, Vector3 } from "three";
import type * as THREE from "three";
import { multiPlayerPositions } from "./utils3d";
import { MOVE_DURATION } from "../../lib/constants";
import type { Player } from "../../types/game";

const PAWN_SCALE = 0.28;
const HOP_HEIGHT = 0.35;

// Chess-pawn profile [radius, y] — created once at module load and shared across instances
const PAWN_PROFILE: [number, number][] = [
  [0.30, 0.00],
  [0.35, 0.05],
  [0.25, 0.10],
  [0.12, 0.15],
  [0.10, 0.40],
  [0.22, 0.55],
  [0.25, 0.65],
  [0.20, 0.80],
  [0.00, 0.88],
];

const pawnGeometry = new LatheGeometry(
  PAWN_PROFILE.map(([r, y]) => new Vector2(r, y)),
  16,
);

interface Props {
  player: Player;
  allPlayers: Player[];
}

export default function PlayerPawn3D({ player, allPlayers }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  const playersAtPos = useMemo(
    () => allPlayers.filter((p) => p.position === player.position),
    [allPlayers, player.position],
  );
  const myIndex = playersAtPos.findIndex((p) => p.id === player.id);
  const totalAtPos = playersAtPos.length;

  const target = multiPlayerPositions(player.position, myIndex, totalAtPos);

  // Hop animation state
  const hopStartRef = useRef(new Vector3(target[0], target[1], target[2]));
  const hopTargetRef = useRef(new Vector3(target[0], target[1], target[2]));
  const hopStartTimeRef = useRef<number | null>(null);
  const currentVec = useRef(new Vector3(target[0], target[1], target[2]));

  // Trigger a hop whenever position changes
  useEffect(() => {
    const newTarget = new Vector3(target[0], target[1], target[2]);
    // Only hop if the XZ destination actually changed (not just stacking reorder)
    if (
      Math.abs(newTarget.x - hopTargetRef.current.x) > 0.001 ||
      Math.abs(newTarget.z - hopTargetRef.current.z) > 0.001
    ) {
      hopStartRef.current.copy(currentVec.current);
      hopTargetRef.current.copy(newTarget);
      hopStartTimeRef.current = performance.now();
    } else {
      // Stacking adjustment — just update target, no hop
      hopTargetRef.current.copy(newTarget);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.position, myIndex, totalAtPos]);

  // Set initial mesh position before the first rendered frame to avoid a flash from origin
  useLayoutEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(currentVec.current);
    }
  }, []); // mount only

  useFrame(() => {
    if (!meshRef.current) return;

    if (hopStartTimeRef.current !== null) {
      const elapsed = performance.now() - hopStartTimeRef.current;
      const rawT = Math.min(elapsed / MOVE_DURATION, 1);
      // Smooth ease-in-out
      const t = rawT < 0.5 ? 2 * rawT * rawT : -1 + (4 - 2 * rawT) * rawT;

      const x = hopStartRef.current.x + (hopTargetRef.current.x - hopStartRef.current.x) * t;
      const z = hopStartRef.current.z + (hopTargetRef.current.z - hopStartRef.current.z) * t;
      const yBase = hopStartRef.current.y + (hopTargetRef.current.y - hopStartRef.current.y) * t;
      const yArc = Math.sin(Math.PI * rawT) * HOP_HEIGHT;

      meshRef.current.position.set(x, yBase + yArc, z);
      currentVec.current.set(x, yBase, z);

      if (rawT >= 1) {
        hopStartTimeRef.current = null;
        meshRef.current.position.copy(hopTargetRef.current);
        currentVec.current.copy(hopTargetRef.current);
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={pawnGeometry}
      scale={PAWN_SCALE}
      castShadow
    >
      <meshStandardMaterial
        color={player.color ?? "#888888"}
        roughness={0.3}
        metalness={0.25}
      />
    </mesh>
  );
}
