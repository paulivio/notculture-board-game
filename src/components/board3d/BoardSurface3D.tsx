import { useMemo, Suspense } from "react";
import { Text, RoundedBox } from "@react-three/drei";
import { useGame } from "../../context/GameContext";
import {
  SPIRAL_PATH,
  TOTAL_CELLS,
  CULTURE_POSITIONS,
  NOT_POSITIONS,
  CATEGORY_COLORS,
} from "../../lib/constants";
import { gridIndexTo3D, CELL_SIZE, TILE_HEIGHT } from "./utils3d";
import type { Category } from "../../types/game";

const TILE_COLORS: Record<string, string> = {
  start: "#ffffff",
  finish: "#f59e0b",
  culture: "#c026d3",
  not: "#f97316",
  ...CATEGORY_COLORS,
};

const TILE_W = CELL_SIZE * 0.88;

interface TileMeshProps {
  position: [number, number, number];
  color: string;
  label?: string;
}

function TileMesh({ position, color, label }: TileMeshProps) {
  return (
    <RoundedBox
      args={[TILE_W, TILE_HEIGHT, TILE_W]}
      radius={0.06}
      smoothness={4}
      position={position}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
      {label && (
        <Suspense fallback={null}>
          <Text
            position={[0, TILE_HEIGHT / 2 + 0.01, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.17}
            color={color === "#ffffff" ? "#333333" : "white"}
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            maxWidth={TILE_W * 0.9}
            textAlign="center"
          >
            {label}
          </Text>
        </Suspense>
      )}
    </RoundedBox>
  );
}

export default function BoardSurface3D() {
  const state = useGame();

  const gridToPath = useMemo(() => {
    const m = new Map<number, number>();
    SPIRAL_PATH.forEach((gridIndex, pathIndex) => m.set(gridIndex, pathIndex));
    return m;
  }, []);

  const tiles = useMemo(() => {
    const result: { gridIndex: number; position: [number, number, number]; color: string; label?: string }[] = [];

    for (let gridIndex = 0; gridIndex < TOTAL_CELLS; gridIndex++) {
      const pathIndex = gridToPath.get(gridIndex);
      if (pathIndex === undefined) continue;

      const isStart = pathIndex === 0;
      const isFinish = pathIndex === SPIRAL_PATH.length - 1;
      const isCulture = !isStart && !isFinish && CULTURE_POSITIONS.has(pathIndex);
      const isNot = !isStart && !isFinish && NOT_POSITIONS.has(pathIndex);

      let tileKey: string;
      let label: string | undefined;

      if (isStart) {
        tileKey = "start";
        label = "START";
      } else if (isFinish) {
        tileKey = "finish";
        label = "FINISH";
      } else if (isCulture) {
        tileKey = "culture";
        label = "CULTURE";
      } else if (isNot) {
        tileKey = "not";
        label = "NOT";
      } else {
        const cat = state.activeCategories[pathIndex % state.activeCategories.length] as Category;
        tileKey = cat;
      }

      const color = TILE_COLORS[tileKey] ?? "#888888";
      const [x, , z] = gridIndexTo3D(gridIndex);
      const position: [number, number, number] = [x, TILE_HEIGHT / 2, z];
      result.push({ gridIndex, position, color, label });
    }

    return result;
  }, [gridToPath, state.activeCategories]);

  return (
    <group>
      {/* Path tiles */}
      {tiles.map(({ gridIndex, position, color, label }) => (
        <TileMesh key={gridIndex} position={position} color={color} label={label} />
      ))}
    </group>
  );
}
