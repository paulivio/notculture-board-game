import PlayerBar from "../controls/PlayerBar";
import { useGame } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import { TextureButton } from "../ui/TextureButton";
import DiceRoller from "../dice/DiceRoller";

export default function TopPanel() {
  const state = useGame();
  const { handleDiceRoll, diceState } = useGameLogicContext();

  return (
    <div className="flex flex-col items-center gap-1.5">
      <h1 className="text-xl font-bold lg:text-2xl">NotCulture Board Game</h1>
      <PlayerBar />

      <div className="flex flex-col items-center gap-0.5">
        <TextureButton
          variant="primary"
          onClick={handleDiceRoll}
          disabled={state.isTurnLocked}
        >
          Roll Dice
        </TextureButton>
        <img
          src={`/assets/dice/dice-${diceState.displayValue}.png`}
          alt="Dice"
          className="my-5 h-20 w-20"
        />
      </div>

      <DiceRoller
        rolling={diceState.rolling}
        finalValue={diceState.finalValue}
        onComplete={diceState.onComplete}
      />
    </div>
  );
}
