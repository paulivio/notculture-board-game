import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TOUCH } from "three";
import { useGame } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import { SPIRAL_PATH, CATEGORY_COLORS } from "../../lib/constants";
import { TILE_HEIGHT } from "./utils3d";
import BoardSurface3D from "./BoardSurface3D";
import PathLine3D from "./PathLine3D";
import PlayersLayer3D from "./PlayersLayer3D";
import WheelSpinner3D from "./WheelSpinner3D";

const CULTURE_COLOR = "#c026d3";
const NOT_COLOR = "#f97316";

function Scene() {
  const state = useGame();
  const { handleDiceRoll, diceState } = useGameLogicContext();
  const activeConfig = state.boardPreviewConfig ?? state.customBoardConfig;
  const totalTiles = activeConfig?.totalTiles ?? SPIRAL_PATH.length;

  const segmentColors = [
    ...state.activeCategories.map((c) => CATEGORY_COLORS[c]),
    CULTURE_COLOR,
    NOT_COLOR,
  ];

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 6, -5]} intensity={0.35} />

      <OrbitControls
        makeDefault
        enablePan={true}
        minDistance={4}
        maxDistance={20}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      />

      <BoardSurface3D />
      <PathLine3D totalTiles={totalTiles} />
      <PlayersLayer3D />

      {state.wheelMode === "3d" && (
        <group position={[0, TILE_HEIGHT + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <WheelSpinner3D
            rolling={diceState.rolling}
            finalValue={diceState.finalValue}
            onComplete={diceState.onComplete}
            onClick={handleDiceRoll}
            locked={state.isTurnLocked}
            segmentColors={segmentColors}
          />
        </group>
      )}
    </>
  );
}

export default function Board3D() {
  return (
    <div className="w-full h-full relative">
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [0, 8, 7], fov: 45 }}
        shadows
      >
        <Scene />
      </Canvas>
    </div>
  );
}
