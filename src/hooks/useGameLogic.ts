import { useState, useCallback, useRef } from "react";
import { useGame, useGameDispatch } from "../context/GameContext";
import { useOnline } from "../context/OnlineContext";
import { useQuestions } from "./useQuestions";
import { useSound } from "./useSound";
import {
  SPIRAL_PATH,
  CATEGORIES,
  CULTURE_POSITIONS,
  NOT_POSITIONS,
  MAX_POSITION,
  MOVE_DURATION,
} from "../lib/constants";
import type { Category } from "../types/game";
import notData from "../data/not.json";
import {
  rollDice,
  setCurrentQuestion,
  submitAnswer,
  updatePlayerPosition,
  advanceTurn,
  activateCulture,
  activateNot,
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
  const stateRef = useRef(state);
  stateRef.current = state;
  const usedNotIds = useRef(new Set<string>());

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
      const destination = Math.min(currentPlayer.position + roll, MAX_POSITION);

      // Culture tile check — bypass question flow entirely
      if (CULTURE_POSITIONS.has(destination)) {
        animateMovement(currentPlayer.id, currentPlayer.position, roll, async () => {
          if (state.gameMode === "online" && identity.roomCode && identity.playerId) {
            await updatePlayerPosition(identity.roomCode, identity.playerId, destination);
            await activateCulture(identity.roomCode);
          } else {
            dispatch({ type: "SHOW_CULTURE_MODAL", show: true });
          }
        });
        return;
      }

      // Not tile check — describe-and-guess mechanic
      if (NOT_POSITIONS.has(destination)) {
        const cards = notData as { id: string; answers: string[] }[];
        let pool = cards.filter((c) => !usedNotIds.current.has(c.id));
        if (pool.length === 0) {
          usedNotIds.current.clear();
          pool = cards;
        }
        const card = pool[Math.floor(Math.random() * pool.length)];
        usedNotIds.current.add(card.id);

        animateMovement(currentPlayer.id, currentPlayer.position, roll, async () => {
          if (state.gameMode === "online" && identity.roomCode && identity.playerId) {
            await updatePlayerPosition(identity.roomCode, identity.playerId, destination);
            await activateNot(identity.roomCode, card);
          } else {
            dispatch({ type: "SET_NOT_CARD", card });
            dispatch({ type: "SHOW_NOT_MODAL", show: true });
          }
        });
        return;
      }

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
    [state.players, state.currentPlayerIndex, state.gameMode, identity, animateMovement, getQuestion, dispatch]
  );

  // Trigger dice animation with a server-provided value (used by online mode)
  const triggerDiceAnimation = useCallback(
    (roll: number, onComplete: () => void) => {
      if (state.debugMode) {
        setDiceState((prev) => ({ ...prev, displayValue: roll }));
        onComplete();
        return;
      }
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
    [state.debugMode]
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

    setDiceState({
      rolling: true,
      finalValue: roll,
      displayValue: roll,
      onComplete: () => {
        setDiceState((prev) => ({ ...prev, rolling: false }));
        processRoll(roll);
      },
    });
  }, [state.isTurnLocked, state.gameMode, state.debugMode, identity, dispatch, processRoll]);

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

  const handleCultureScore = useCallback(
    (score: number) => {
      dispatch({ type: "SHOW_CULTURE_MODAL", show: false });
      const currentPlayer = stateRef.current.players[stateRef.current.currentPlayerIndex];
      const culturePos = currentPlayer.position;

      animateMovement(currentPlayer.id, culturePos, score, () => {
        const newPos = Math.min(culturePos + score, MAX_POSITION);
        // Unlock immediately — don't wait on Firebase so a network hiccup never
        // leaves the wheel stuck locked.
        dispatch({ type: "ADVANCE_TURN" });
        dispatch({ type: "UNLOCK_TURN" });
        if (stateRef.current.gameMode === "online" && identity.roomCode && identity.playerId) {
          updatePlayerPosition(identity.roomCode, identity.playerId, newPos);
          advanceTurn(identity.roomCode);
        }
      });
    },
    [dispatch, animateMovement, identity]
  );

  const handleNotScore = useCallback(
    (score: number) => {
      dispatch({ type: "SHOW_NOT_MODAL", show: false });
      const currentPlayer = stateRef.current.players[stateRef.current.currentPlayerIndex];
      const notPos = currentPlayer.position;

      animateMovement(currentPlayer.id, notPos, score, () => {
        const newPos = Math.min(notPos + score, MAX_POSITION);
        dispatch({ type: "ADVANCE_TURN" });
        dispatch({ type: "UNLOCK_TURN" });
        if (stateRef.current.gameMode === "online" && identity.roomCode && identity.playerId) {
          updatePlayerPosition(identity.roomCode, identity.playerId, newPos);
          advanceTurn(identity.roomCode);
        }
      });
    },
    [dispatch, animateMovement, identity]
  );

  // Debug-only: trigger the tile effect at an arbitrary position
  const triggerTileAt = useCallback(
    (position: number) => {
      if (position === 0 || position >= MAX_POSITION) return;

      dispatch({ type: "LOCK_TURN" });

      if (CULTURE_POSITIONS.has(position)) {
        if (state.gameMode === "online" && identity.roomCode) {
          activateCulture(identity.roomCode);
        } else {
          dispatch({ type: "SHOW_CULTURE_MODAL", show: true });
        }
        return;
      }

      if (NOT_POSITIONS.has(position)) {
        const cards = notData as { id: string; answers: string[] }[];
        let pool = cards.filter((c) => !usedNotIds.current.has(c.id));
        if (pool.length === 0) {
          usedNotIds.current.clear();
          pool = cards;
        }
        const card = pool[Math.floor(Math.random() * pool.length)];
        usedNotIds.current.add(card.id);
        if (state.gameMode === "online" && identity.roomCode) {
          activateNot(identity.roomCode, card);
        } else {
          dispatch({ type: "SET_NOT_CARD", card });
          dispatch({ type: "SHOW_NOT_MODAL", show: true });
        }
        return;
      }

      const category = CATEGORIES[position % CATEGORIES.length];
      dispatch({ type: "SET_PENDING_CATEGORY", category });

      const roll = Math.floor(Math.random() * 6) + 1;
      const question = getQuestion(category, roll);
      if (question) {
        dispatch({ type: "SET_ACTIVE_QUESTION", question, roll });
        if (state.gameMode === "online" && identity.roomCode) {
          setCurrentQuestion(identity.roomCode, question.id);
        }
      }
    },
    [state.gameMode, identity.roomCode, dispatch, getQuestion]
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
    handleCultureScore,
    handleNotScore,
    triggerTileAt,
    diceState,
    animateMovement,
    processRoll,
    triggerDiceAnimation,
  };
}
