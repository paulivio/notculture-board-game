import { useRef } from "react";
import { useGame } from "../../context/GameContext";
import Cell from "./Cell";
import BoardCanvas from "./BoardCanvas";
import PlayerToken from "./PlayerToken";
import { TOTAL_CELLS, SPIRAL_PATH, CATEGORIES, CULTURE_POSITIONS, GRID_SIZE } from "../../lib/constants";

export default function Board() {
  const state = useGame();
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  return (
    <div
      ref={boardRef}
      className="relative grid grid-cols-8 grid-rows-8 gap-[clamp(4px,1.2vw,10px)] rounded-xl bg-board-bg p-2 w-[min(92vw,92vh)] aspect-square lg:flex-1 lg:max-h-[80vh] lg:max-w-[80vh] lg:w-auto"
      style={{
        backgroundImage: `url('${import.meta.env.BASE_URL}assets/logo.png')`,
        backgroundSize: "44%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      <BoardCanvas boardRef={boardRef} cellRefs={cellRefs} />

      {/* Cells */}
      {Array.from({ length: TOTAL_CELLS }, (_, gridIndex) => {
        const pathIndex = gridToPath.get(gridIndex);
        const isOnPath = pathIndex !== undefined;
        const isStart = pathIndex === 0;
        const isFinish = pathIndex === SPIRAL_PATH.length - 1;

        const isCulture = isOnPath && !isStart && !isFinish && CULTURE_POSITIONS.has(pathIndex!);

        let category: string | null = null;
        if (isOnPath && !isStart && !isFinish && !isCulture) {
          category = CATEGORIES[pathIndex % CATEGORIES.length];
        }

        // Figure out connection direction to next cell
        let connectClass = "";
        if (isOnPath && pathIndex < SPIRAL_PATH.length - 1) {
          const nextGridIndex = SPIRAL_PATH[pathIndex + 1];
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
            isOnPath={isOnPath}
            isStart={isStart}
            isFinish={isFinish}
            isCulture={isCulture}
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
