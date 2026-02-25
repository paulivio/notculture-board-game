import { createContext, useContext, type ReactNode } from "react";
import { useGameLogic, type DiceState } from "../hooks/useGameLogic";

interface GameLogicValue {
  handleDiceRoll: () => void;
  handleAnswer: (selectedIndex: number) => { correct: boolean; correctIndex: number } | undefined;
  afterAnswer: (correct: boolean) => void;
  handleSkip: () => void;
  diceState: DiceState;
  triggerDiceAnimation: (roll: number, onComplete: () => void) => void;
  processRoll: (roll: number) => void;
  animateMovement: (playerId: number, startPos: number, steps: number, onComplete?: () => void) => void;
}

const GameLogicContext = createContext<GameLogicValue | null>(null);

export function GameLogicProvider({ children }: { children: ReactNode }) {
  const logic = useGameLogic();

  return (
    <GameLogicContext.Provider value={logic}>
      {children}
    </GameLogicContext.Provider>
  );
}

export function useGameLogicContext() {
  const ctx = useContext(GameLogicContext);
  if (!ctx) throw new Error("useGameLogicContext must be used within GameLogicProvider");
  return ctx;
}
