import { motion, AnimatePresence } from "framer-motion";
import PlayerBar from "../controls/PlayerBar";
import { useGame } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import DiceRoller from "../dice/DiceRoller";

export default function TopPanel() {
  const state = useGame();
  const { handleDiceRoll, diceState } = useGameLogicContext();
  const locked = state.isTurnLocked;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <h1 className="text-xl font-bold lg:text-2xl">NotCulture Board Game</h1>
      <PlayerBar />

      <div className="flex flex-col items-center gap-1 my-3">
        <AnimatePresence>
          {!diceState.rolling && (
            <motion.img
              key="dice-image"
              src={`${import.meta.env.BASE_URL}assets/dice/dice-${diceState.displayValue}.png`}
              alt="Roll Dice"
              onClick={!locked ? handleDiceRoll : undefined}
              className={`h-28 w-28 select-none ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.25 }}
              whileHover={!locked ? { scale: 1.08 } : undefined}
              whileTap={!locked ? { scale: 0.95 } : undefined}
            />
          )}
        </AnimatePresence>
        {!locked && (
          <p className="text-xs text-white/50 select-none">Tap to roll</p>
        )}
      </div>

      <DiceRoller
        rolling={diceState.rolling}
        finalValue={diceState.finalValue}
        onComplete={diceState.onComplete}
      />
    </div>
  );
}
