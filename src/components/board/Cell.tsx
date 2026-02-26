import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { CATEGORY_BG_COLORS } from "../../lib/constants";
import type { Category } from "../../types/game";

interface CellProps {
  gridIndex: number;
  pathIndex: number | undefined;
  isOnPath: boolean;
  isStart: boolean;
  isFinish: boolean;
  isCulture: boolean;
  category: string | null;
  connectClass: string;
  debugMode: boolean;
}

const Cell = forwardRef<HTMLDivElement, CellProps>(
  (
    { pathIndex, isOnPath, isStart, isFinish, isCulture, category, debugMode },
    ref
  ) => {
    if (!isOnPath) {
      // Inactive cell — invisible
      return <div ref={ref} className="w-full h-full" />;
    }

    const bgColor = isStart
      ? "bg-white text-black"
      : isFinish
        ? "bg-amber-400 text-black"
        : isCulture
          ? "bg-fuchsia-600 text-white"
          : category
            ? CATEGORY_BG_COLORS[category as Category]
            : "bg-white";

    const label = isStart
      ? "START"
      : isFinish
        ? "FINISH"
        : isCulture
          ? debugMode && pathIndex !== undefined
            ? String(pathIndex)
            : "★"
          : debugMode && pathIndex !== undefined
            ? String(pathIndex)
            : "";

    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-xl text-[clamp(10px,2vw,16px)] font-bold shadow-md transition-transform duration-200 hover:scale-105 z-[2]",
          bgColor
        )}
      >
        {isCulture && !(debugMode && pathIndex !== undefined) ? (
          <div className="flex flex-col items-center leading-none gap-0.5">
            <span>★</span>
            <span className="text-[0.65em]">Culture</span>
          </div>
        ) : (
          label
        )}
      </div>
    );
  }
);

Cell.displayName = "Cell";
export default Cell;
