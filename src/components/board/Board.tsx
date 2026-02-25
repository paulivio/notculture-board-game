import { useRef } from "react";
import { useGame } from "../../context/GameContext";
import Cell from "./Cell";
import BoardCanvas from "./BoardCanvas";
import PlayerToken from "./PlayerToken";
import { TOTAL_CELLS, SPIRAL_PATH, CATEGORIES } from "../../lib/constants";

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
      className="relative grid grid-cols-7 grid-rows-7 gap-[clamp(4px,1.2vw,10px)] rounded-xl bg-board-bg p-2 w-[min(92vw,92vh)] aspect-square lg:flex-1 lg:max-h-[80vh] lg:max-w-[80vh] lg:w-auto"
    >
      <BoardCanvas boardRef={boardRef} cellRefs={cellRefs} />

      {/* Logo */}
      <img
        src={`${import.meta.env.BASE_URL}assets/logo.png`}
        alt="NotCulture"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[3] h-auto w-[43%] -translate-x-1/2 -translate-y-1/2"
      />

      {/* Cells */}
      {Array.from({ length: TOTAL_CELLS }, (_, gridIndex) => {
        const pathIndex = gridToPath.get(gridIndex);
        const isOnPath = pathIndex !== undefined;
        const isStart = pathIndex === 0;
        const isFinish = pathIndex === SPIRAL_PATH.length - 1;

        let category: string | null = null;
        if (isOnPath && !isStart && !isFinish) {
          category = CATEGORIES[pathIndex % CATEGORIES.length];
        }

        // Figure out connection direction to next cell
        let connectClass = "";
        if (isOnPath && pathIndex < SPIRAL_PATH.length - 1) {
          const nextGridIndex = SPIRAL_PATH[pathIndex + 1];
          const curRow = Math.floor(gridIndex / 7);
          const curCol = gridIndex % 7;
          const nextRow = Math.floor(nextGridIndex / 7);
          const nextCol = nextGridIndex % 7;

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
