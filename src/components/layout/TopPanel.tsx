import PlayerBar from "../controls/PlayerBar";
import { useGame } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import WheelSpinner from "../dice/WheelSpinner";
import { CATEGORY_COLORS } from "../../lib/constants";

// Fixed tile colours — match Cell.tsx: bg-fuchsia-600 and bg-orange-500
const CULTURE_COLOR = "#c026d3";
const NOT_COLOR = "#f97316";

export default function TopPanel() {
  const state = useGame();
  const { handleDiceRoll, diceState } = useGameLogicContext();
  const locked = state.isTurnLocked;

  // Segments 1–4: active categories in order; segment 5: Culture; segment 6: Not
  const segmentColors = [
    ...state.activeCategories.map((c) => CATEGORY_COLORS[c]),
    CULTURE_COLOR,
    NOT_COLOR,
  ];

  return (
    <div className="flex flex-col items-center gap-0.5 2xl:gap-1.5">
      <PlayerBar />

      <div className="my-1 2xl:my-3">
        <WheelSpinner
          rolling={diceState.rolling}
          finalValue={diceState.finalValue}
          onComplete={diceState.onComplete}
          onClick={handleDiceRoll}
          locked={locked}
          segmentColors={segmentColors}
        />
      </div>
    </div>
  );
}
