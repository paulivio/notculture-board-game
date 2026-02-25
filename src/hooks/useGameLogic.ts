import { useState, useCallback, useRef } from "react";
import { useGame, useGameDispatch } from "../context/GameContext";
import { useQuestions } from "./useQuestions";
import { useSound } from "./useSound";
import {
  SPIRAL_PATH,
  CATEGORIES,
  MAX_POSITION,
  MOVE_DURATION,
} from "../lib/constants";
import type { Category } from "../types/game";

export interface DiceState {
  rolling: boolean;
  finalValue: number;
  displayValue: number;
  onComplete: (() => void) | null;
}

export function useGameLogic() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { getQuestion } = useQuestions();
  const { playSound } = useSound();

  const [diceState, setDiceState] = useState<DiceState>({
    rolling: false,
    finalValue: 1,
    displayValue: 1,
    onComplete: null,
  });

  const movingRef = useRef(false);

  const animateMovement = useCallback(
    (playerId: number, startPos: number, steps: number) => {
      if (movingRef.current) return;
      movingRef.current = true;

      let current = startPos;
      let remaining = steps;

      function step() {
        if (remaining <= 0) {
          movingRef.current = false;
          // Win check
          if (current >= MAX_POSITION) {
            dispatch({ type: "SHOW_WIN_MODAL", show: true });
          }
          return;
        }

        if (current < MAX_POSITION) {
          playSound("move");
          current++;
          dispatch({
            type: "SET_PLAYER_POSITION",
            playerId,
            position: current,
          });
        }

        remaining--;
        setTimeout(step, MOVE_DURATION);
      }

      step();
    },
    [dispatch, playSound]
  );

  const processRoll = useCallback(
    (roll: number) => {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const pathIndex = currentPlayer.position;
      const gridIndex = SPIRAL_PATH[pathIndex];

      // Determine category from current cell
      let category: Category;
      if (pathIndex === 0 || pathIndex === SPIRAL_PATH.length - 1) {
        // START or FINISH — pick random category
        category =
          CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      } else {
        category = CATEGORIES[pathIndex % CATEGORIES.length];
      }

      dispatch({ type: "SET_PENDING_CATEGORY", category });

      const question = getQuestion(category, roll);
      if (question) {
        dispatch({ type: "SET_ACTIVE_QUESTION", question, roll });
      }
    },
    [state.players, state.currentPlayerIndex, getQuestion, dispatch]
  );

  const handleDiceRoll = useCallback(() => {
    if (state.isTurnLocked) return;
    dispatch({ type: "LOCK_TURN" });

    const roll = Math.floor(Math.random() * 6) + 1;

    if (state.debugMode) {
      setDiceState((prev) => ({ ...prev, displayValue: roll }));
      processRoll(roll);
      return;
    }

    playSound("dice");

    setDiceState({
      rolling: true,
      finalValue: roll,
      displayValue: roll,
      onComplete: () => {
        setDiceState((prev) => ({ ...prev, rolling: false }));
        processRoll(roll);
      },
    });
  }, [state.isTurnLocked, state.debugMode, dispatch, playSound, processRoll]);

  const handleAnswer = useCallback(
    (selectedIndex: number) => {
      if (!state.activeQuestion) return;

      const correct = selectedIndex === state.activeQuestion.correctIndex;
      playSound(correct ? "correct" : "wrong");

      return { correct, correctIndex: state.activeQuestion.correctIndex };
    },
    [state.activeQuestion, playSound]
  );

  const afterAnswer = useCallback(
    (correct: boolean) => {
      const currentPlayer = state.players[state.currentPlayerIndex];

      dispatch({ type: "SHOW_QUESTION_MODAL", show: false });
      dispatch({ type: "CLEAR_QUESTION" });

      if (correct) {
        animateMovement(
          currentPlayer.id,
          currentPlayer.position,
          state.pendingMove
        );
        // Delay turn advance until movement finishes
        setTimeout(() => {
          dispatch({ type: "ADVANCE_TURN" });
          dispatch({ type: "UNLOCK_TURN" });
        }, state.pendingMove * MOVE_DURATION + 100);
      } else {
        dispatch({ type: "ADVANCE_TURN" });
        dispatch({ type: "UNLOCK_TURN" });
      }
    },
    [state.players, state.currentPlayerIndex, state.pendingMove, dispatch, animateMovement]
  );

  const handleSkip = useCallback(() => {
    if (!state.debugMode) return;
    const currentPlayer = state.players[state.currentPlayerIndex];

    dispatch({ type: "SHOW_QUESTION_MODAL", show: false });
    dispatch({ type: "CLEAR_QUESTION" });

    animateMovement(
      currentPlayer.id,
      currentPlayer.position,
      state.pendingMove
    );

    setTimeout(() => {
      dispatch({ type: "ADVANCE_TURN" });
      dispatch({ type: "UNLOCK_TURN" });
    }, state.pendingMove * MOVE_DURATION + 100);
  }, [
    state.debugMode,
    state.players,
    state.currentPlayerIndex,
    state.pendingMove,
    dispatch,
    animateMovement,
  ]);

  return {
    handleDiceRoll,
    handleAnswer,
    afterAnswer,
    handleSkip,
    diceState,
    animateMovement,
    processRoll,
  };
}
