import PlayerBar from "../controls/PlayerBar";
import { useGame } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import WheelSpinner from "../dice/WheelSpinner";

export default function TopPanel() {
  const state = useGame();
  const { handleDiceRoll, diceState } = useGameLogicContext();
  const locked = state.isTurnLocked;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <h1 className="text-xl font-bold lg:text-2xl">NotCulture Board Game</h1>
      <PlayerBar />

      <div className="my-3">
        <WheelSpinner
          rolling={diceState.rolling}
          finalValue={diceState.finalValue}
          onComplete={diceState.onComplete}
          onClick={handleDiceRoll}
          locked={locked}
        />
      </div>
    </div>
  );
}
