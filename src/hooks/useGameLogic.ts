import { useState, useCallback, useRef } from "react";
import { useGame, useGameDispatch } from "../context/GameContext";
import { useOnline } from "../context/OnlineContext";
import { useQuestions } from "./useQuestions";
import { useSound } from "./useSound";
import {
  SPIRAL_PATH,
  CATEGORIES,
  MAX_POSITION,
  MOVE_DURATION,
} from "../lib/constants";
import type { Category } from "../types/game";
import {
  rollDice,
  setCurrentQuestion,
  submitAnswer,
  updatePlayerPosition,
  advanceTurn,
} from "../firebase/roomService";

export interface DiceState {
  rolling: boolean;
  finalValue: number;
  displayValue: number;
  onComplete: (() => void) | null;
}

export function useGameLogic() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { identity } = useOnline();
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
    (playerId: number, startPos: number, steps: number, onComplete?: () => void) => {
      if (movingRef.current) return;
      movingRef.current = true;

      let current = startPos;
      let remaining = steps;

      function step() {
        if (remaining <= 0) {
          movingRef.current = false;
          onComplete?.();
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

      let category: Category;
      if (pathIndex === 0 || pathIndex === SPIRAL_PATH.length - 1) {
        category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      } else {
        category = CATEGORIES[pathIndex % CATEGORIES.length];
      }

      dispatch({ type: "SET_PENDING_CATEGORY", category });

      const question = getQuestion(category, roll);
      if (question) {
        dispatch({ type: "SET_ACTIVE_QUESTION", question, roll });

        // In online mode, write question ID to Firebase so other players see it
        if (state.gameMode === "online" && identity.roomCode) {
          setCurrentQuestion(identity.roomCode, question.id);
        }
      }
    },
    [state.players, state.currentPlayerIndex, state.gameMode, identity.roomCode, getQuestion, dispatch]
  );

  // Trigger dice animation with a server-provided value (used by online mode)
  const triggerDiceAnimation = useCallback(
    (roll: number, onComplete: () => void) => {
      if (state.debugMode) {
        setDiceState((prev) => ({ ...prev, displayValue: roll }));
        onComplete();
        return;
      }
      playSound("dice");
      setDiceState({
        rolling: true,
        finalValue: roll,
        displayValue: roll,
        onComplete: () => {
          setDiceState((prev) => ({ ...prev, rolling: false }));
          onComplete();
        },
      });
    },
    [state.debugMode, playSound]
  );

  const handleDiceRoll = useCallback(() => {
    if (state.isTurnLocked) return;

    // Online mode: write roll to Firebase; useRoom listener handles animation + logic
    if (state.gameMode === "online" && identity.roomCode && identity.playerId) {
      rollDice(identity.roomCode, identity.playerId);
      return;
    }

    // Local mode
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
  }, [state.isTurnLocked, state.gameMode, state.debugMode, identity, dispatch, playSound, processRoll]);

  const handleAnswer = useCallback(
    (selectedIndex: number) => {
      if (!state.activeQuestion) return;

      const correct = selectedIndex === state.activeQuestion.correctIndex;
      playSound(correct ? "correct" : "wrong");

      // In online mode, write answer result to Firebase
      if (state.gameMode === "online" && identity.roomCode) {
        submitAnswer(
          identity.roomCode,
          selectedIndex,
          state.activeQuestion.correctIndex,
          correct
        );
      }

      return { correct, correctIndex: state.activeQuestion.correctIndex };
    },
    [state.activeQuestion, state.gameMode, identity.roomCode, playSound]
  );

  const afterAnswer = useCallback(
    (correct: boolean) => {
      const currentPlayer = state.players[state.currentPlayerIndex];

      dispatch({ type: "SHOW_QUESTION_MODAL", show: false });
      dispatch({ type: "CLEAR_QUESTION" });

      if (state.gameMode === "online" && identity.roomCode && identity.playerId) {
        dispatch({ type: "ADVANCE_TURN" });
        dispatch({ type: "UNLOCK_TURN" });

        if (correct) {
          const newPosition = Math.min(
            currentPlayer.position + state.pendingMove,
            MAX_POSITION
          );
          // Advance turn first — this clears currentQuestion in Firebase,
          // which closes the modal on all clients before movement starts
          advanceTurn(identity.roomCode);
          animateMovement(currentPlayer.id, currentPlayer.position, state.pendingMove);
          setTimeout(() => {
            updatePlayerPosition(identity.roomCode!, identity.playerId!, newPosition);
          }, state.pendingMove * MOVE_DURATION + 100);
        } else {
          advanceTurn(identity.roomCode);
        }
        return;
      }

      // Local mode
      if (correct) {
        animateMovement(currentPlayer.id, currentPlayer.position, state.pendingMove);
        setTimeout(() => {
          dispatch({ type: "ADVANCE_TURN" });
          dispatch({ type: "UNLOCK_TURN" });
        }, state.pendingMove * MOVE_DURATION + 100);
      } else {
        dispatch({ type: "ADVANCE_TURN" });
        dispatch({ type: "UNLOCK_TURN" });
      }
    },
    [state.players, state.currentPlayerIndex, state.pendingMove, state.gameMode, identity, dispatch, animateMovement]
  );

  const handleSkip = useCallback(() => {
    if (!state.debugMode) return;
    const currentPlayer = state.players[state.currentPlayerIndex];

    dispatch({ type: "SHOW_QUESTION_MODAL", show: false });
    dispatch({ type: "CLEAR_QUESTION" });

    animateMovement(currentPlayer.id, currentPlayer.position, state.pendingMove);

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
    triggerDiceAnimation,
  };
}
