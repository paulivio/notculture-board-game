import { useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { LatheGeometry, Vector2, Vector3 } from "three";
import type * as THREE from "three";
import { multiPlayerPositions } from "./utils3d";
import type { Player } from "../../types/game";

const PAWN_SCALE = 0.28;

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
  // target[1] = TILE_HEIGHT — the pawn's LatheGeometry base (local y=0) sits on the tile surface

  // Stable refs for lerp — avoids allocating Vector3 every frame
  const targetVec = useRef(new Vector3(target[0], target[1], target[2]));
  const currentVec = useRef(new Vector3(target[0], target[1], target[2]));

  // Update target when player position (or stacking order) changes
  useEffect(() => {
    targetVec.current.set(target[0], target[1], target[2]);
  }, [target[0], target[1], target[2]]);

  // Set initial mesh position before the first rendered frame to avoid flash from origin
  useLayoutEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(currentVec.current);
    }
  }, []); // mount only

  // Smooth lerp animation toward target position
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    currentVec.current.lerp(targetVec.current, Math.min(1, delta * 8));
    meshRef.current.position.copy(currentVec.current);
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
