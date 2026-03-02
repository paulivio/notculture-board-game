import { useRef, useState } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useGame, useGameDispatch } from "../../context/GameContext";
import Cell from "./Cell";
import BoardCanvas from "./BoardCanvas";
import PlayerToken from "./PlayerToken";
import { TOTAL_CELLS, SPIRAL_PATH, CULTURE_POSITIONS, NOT_POSITIONS, GRID_SIZE, CATEGORY_COLORS } from "../../lib/constants";
import type { Category, TileType } from "../../types/game";

const PICKER_TILES: { type: TileType; label: string; color: string }[] = [
  { type: "film",    label: "Film",    color: CATEGORY_COLORS.film },
  { type: "science", label: "Science", color: CATEGORY_COLORS.science },
  { type: "general", label: "General", color: CATEGORY_COLORS.general },
  { type: "history", label: "History", color: CATEGORY_COLORS.history },
  { type: "sports",  label: "Sports",  color: CATEGORY_COLORS.sports },
  { type: "not",     label: "NOT",     color: "#d97706" },
  { type: "culture", label: "CULTURE", color: "#c026d3" },
  { type: "auto",    label: "⌫ Blank", color: "#52525b" },
];

interface BuilderCellProps {
  pathIndex: number;
  tileType: TileType;
  onCellClick: () => void;
  children: React.ReactNode;
}

function BuilderCell({ pathIndex, tileType, onCellClick, children }: BuilderCellProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `cell-${pathIndex}` });
  const { setNodeRef: setDragRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `board-${pathIndex}`,
    data: { tileType, sourcePathIndex: pathIndex },
    disabled: tileType === "auto",
  });

  // h-full w-full block-flow (not absolute) so the height chain works in the grid
  return (
    <div
      ref={setDropRef}
      className={`h-full w-full ${isOver ? "ring-2 ring-white ring-inset rounded-xl" : ""}`}
      onClick={onCellClick}
    >
      <div
        ref={setDragRef}
        style={{
          transform: CSS.Transform.toString(transform),
          opacity: isDragging ? 0 : 1,
          height: "100%",
          width: "100%",
        }}
        {...attributes}
        {...listeners}
      >
        {children}
      </div>
    </div>
  );
}

export default function Board() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [editingPathIndex, setEditingPathIndex] = useState<number | null>(null);

  // Preview config takes priority over applied config while builder is open
  const activeConfig = state.boardPreviewConfig ?? state.customBoardConfig;

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

  const customFinish = activeConfig ? activeConfig.totalTiles - 1 : null;
  const isBuilderOpen = state.boardPreviewConfig !== null;

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
      <BoardCanvas boardRef={boardRef} cellRefs={cellRefs} customTotalTiles={activeConfig?.totalTiles ?? null} />

      {/* Cells */}
      {Array.from({ length: TOTAL_CELLS }, (_, gridIndex) => {
        const pathIndex = gridToPath.get(gridIndex);
        const isOnPath = pathIndex !== undefined;

        // Whether this tile is within the active game path
        const isWithinActivePath = isOnPath && (activeConfig === null || pathIndex! <= customFinish!);

        // In builder mode, show ALL spiral positions (even beyond current path length)
        // so the user can see the full spiral layout and understand where tiles will go.
        const isOutsidePath = isBuilderOpen && isOnPath && !isWithinActivePath;
        const effectiveOnPath = isWithinActivePath || isOutsidePath;

        const isStart = effectiveOnPath && pathIndex === 0;
        const isFinish = isWithinActivePath && (
          activeConfig ? pathIndex === customFinish : pathIndex === SPIRAL_PATH.length - 1
        );

        let isCulture = false;
        let isNot = false;
        let category: string | null = null;

        // Only assign tile types for cells inside the active path
        if (isWithinActivePath && !isStart && !isFinish) {
          if (activeConfig) {
            const tileType = activeConfig.tiles[pathIndex!];
            if (tileType !== "auto" && tileType !== "start" && tileType !== "finish") {
              isCulture = tileType === "culture";
              isNot = tileType === "not";
              if (!isCulture && !isNot) category = tileType as Category;
            }
          } else {
            isCulture = CULTURE_POSITIONS.has(pathIndex!);
            isNot = NOT_POSITIONS.has(pathIndex!);
            if (!isCulture && !isNot) {
              category = state.activeCategories[pathIndex! % state.activeCategories.length];
            }
          }
        }

        // Connect direction to next cell — show for all effective tiles in builder,
        // only within active path otherwise.
        let connectClass = "";
        const connectLength = (isBuilderOpen && isOnPath)
          ? SPIRAL_PATH.length
          : (activeConfig ? activeConfig.totalTiles : SPIRAL_PATH.length);
        if (effectiveOnPath && pathIndex! < connectLength - 1) {
          const nextGridIndex = SPIRAL_PATH[pathIndex! + 1];
          const curRow = Math.floor(gridIndex / GRID_SIZE);
          const curCol = gridIndex % GRID_SIZE;
          const nextRow = Math.floor(nextGridIndex / GRID_SIZE);
          const nextCol = nextGridIndex % GRID_SIZE;

          if (nextRow === curRow && nextCol === curCol + 1) connectClass = "connect-right";
          else if (nextRow === curRow && nextCol === curCol - 1) connectClass = "connect-left";
          else if (nextCol === curCol && nextRow === curRow + 1) connectClass = "connect-down";
          else if (nextCol === curCol && nextRow === curRow - 1) connectClass = "connect-up";
        }

        // Grey auto-style: active unassigned tiles OR outside-path spiral positions.
        // Also treat stale "start"/"finish" values in middle positions as auto (defensive).
        const rawTile = activeConfig?.tiles[pathIndex!];
        const isAutoTile =
          effectiveOnPath &&
          !isStart &&
          !isFinish &&
          (isOutsidePath || (activeConfig !== null && (rawTile === "auto" || rawTile === "start" || rawTile === "finish")));

        const cellElement = (
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
            isAutoTile={isAutoTile}
            isOutsidePath={isOutsidePath}
          />
        );

        // Only active-path (non-edge) cells get DnD wrapping — outside-path cells are
        // visible but not interactive.
        if (isBuilderOpen && isWithinActivePath && !isStart && !isFinish && pathIndex !== undefined) {
          const tileType = activeConfig!.tiles[pathIndex];
          return (
            <BuilderCell key={gridIndex} pathIndex={pathIndex} tileType={tileType} onCellClick={() => setEditingPathIndex(pathIndex)}>
              {cellElement}
            </BuilderCell>
          );
        }

        return cellElement;
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

      {/* Tile picker modal — opens when a builder cell is clicked */}
      {editingPathIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setEditingPathIndex(null)}
        >
          <div
            className="flex flex-col gap-3 rounded-2xl bg-zinc-900 border border-white/10 p-4 shadow-2xl w-64"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Cell #{editingPathIndex} — pick a type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PICKER_TILES.map(({ type, label, color }) => {
                const isCurrent = activeConfig?.tiles[editingPathIndex] === type;
                return (
                  <button
                    key={type}
                    style={{ backgroundColor: color }}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold text-white text-left transition-opacity ${isCurrent ? "ring-2 ring-white" : "opacity-80 hover:opacity-100"}`}
                    onClick={() => {
                      dispatch({ type: "SET_BOARD_PREVIEW_TILE_TYPE", index: editingPathIndex, tileType: type });
                      setEditingPathIndex(null);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
