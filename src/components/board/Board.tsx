import { useRef } from "react";
import { useGame } from "../../context/GameContext";
import Cell from "./Cell";
import BoardCanvas from "./BoardCanvas";
import PlayerToken from "./PlayerToken";
import { TOTAL_CELLS, SPIRAL_PATH, CULTURE_POSITIONS, NOT_POSITIONS, GRID_SIZE } from "../../lib/constants";
import type { Category } from "../../types/game";

export default function Board() {
  const state = useGame();
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const customConfig = state.customBoardConfig;

  const setCellRef = (gridIndex: number, el: HTMLDivElement | null) => {
    if (el) {
      cellRefs.current.set(gridIndex, el);
    } else {
      cellRefs.current.delete(gridIndex);
    }
  };

  // Build a lookup from grid index → path index
  const gridToPath = new Map<number, number>();
  SPIRAL_PATH.forEach((gridIndex, pathIndex) => {
    gridToPath.set(gridIndex, pathIndex);
  });

  // When a custom board is active, the effective finish tile is at totalTiles - 1
  const customFinish = customConfig ? customConfig.totalTiles - 1 : null;

  return (
    <div
      ref={boardRef}
      className="relative grid grid-cols-8 grid-rows-8 gap-[clamp(4px,1.2vw,10px)] w-[min(92vw,92vh)] aspect-square 2xl:flex-1 2xl:max-h-[90vh] 2xl:max-w-[90vh] 2xl:w-auto"
      style={{
        backgroundImage: `url('${import.meta.env.BASE_URL}assets/logo.svg')`,
        backgroundSize: "44%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      <BoardCanvas boardRef={boardRef} cellRefs={cellRefs} customTotalTiles={customConfig?.totalTiles ?? null} />

      {/* Cells */}
      {Array.from({ length: TOTAL_CELLS }, (_, gridIndex) => {
        const pathIndex = gridToPath.get(gridIndex);
        const isOnPath = pathIndex !== undefined;

        // When custom board is active, tiles past the custom finish are off-path
        const effectiveOnPath = isOnPath && (customConfig === null || pathIndex! <= customFinish!);

        const isStart = effectiveOnPath && pathIndex === 0;
        const isFinish = effectiveOnPath && (
          customConfig ? pathIndex === customFinish : pathIndex === SPIRAL_PATH.length - 1
        );

        let isCulture = false;
        let isNot = false;
        let category: string | null = null;

        if (effectiveOnPath && !isStart && !isFinish) {
          if (customConfig) {
            const tileType = customConfig.tiles[pathIndex!];
            isCulture = tileType === "culture";
            isNot = tileType === "not";
            if (!isCulture && !isNot) {
              category = tileType as Category;
            }
          } else {
            isCulture = CULTURE_POSITIONS.has(pathIndex!);
            isNot = NOT_POSITIONS.has(pathIndex!);
            if (!isCulture && !isNot) {
              category = state.activeCategories[pathIndex! % state.activeCategories.length];
            }
          }
        }

        // Figure out connection direction to next cell
        let connectClass = "";
        const pathLength = customConfig ? customConfig.totalTiles : SPIRAL_PATH.length;
        if (effectiveOnPath && pathIndex! < pathLength - 1) {
          const nextGridIndex = SPIRAL_PATH[pathIndex! + 1];
          const curRow = Math.floor(gridIndex / GRID_SIZE);
          const curCol = gridIndex % GRID_SIZE;
          const nextRow = Math.floor(nextGridIndex / GRID_SIZE);
          const nextCol = nextGridIndex % GRID_SIZE;

          if (nextRow === curRow && nextCol === curCol + 1)
            connectClass = "connect-right";
          else if (nextRow === curRow && nextCol === curCol - 1)
            connectClass = "connect-left";
          else if (nextCol === curCol && nextRow === curRow + 1)
            connectClass = "connect-down";
          else if (nextCol === curCol && nextRow === curRow - 1)
            connectClass = "connect-up";
        }

        return (
          <Cell
            key={gridIndex}
            ref={(el) => setCellRef(gridIndex, el)}
            gridIndex={gridIndex}
            pathIndex={pathIndex}
            isOnPath={effectiveOnPath}
            isStart={isStart}
            isFinish={isFinish}
            isCulture={isCulture}
            isNot={isNot}
            category={category}
            connectClass={connectClass}
            debugMode={state.debugMode}
          />
        );
      })}

      {/* Player tokens */}
      {state.players.map((player) => (
        <PlayerToken
          key={player.id}
          player={player}
          boardRef={boardRef}
          cellRefs={cellRefs}
          allPlayers={state.players}
        />
      ))}
    </div>
  );
}
