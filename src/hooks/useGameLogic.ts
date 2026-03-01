import { useState, useCallback, useRef, useEffect } from "react";
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
import cultureData from "../data/culture.json";
import {
  rollDice,
  rollDiceTeam,
  setCurrentQuestion,
  submitAnswer,
  updatePlayerPosition,
  updateTeamPosition,
  advanceTurn,
  advanceTeamTurn,
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
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const usedNotIds = useRef(new Set<string>());
  const turnLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Use refs so this callback is stable across renders — changing state.players
      // or state.gameMode refs on every Firebase sync was causing useRoom to
      // re-subscribe in an infinite loop.
      const s = stateRef.current;
      const id = identityRef.current;
      const currentPlayer = s.players[s.currentPlayerIndex];
      if (!currentPlayer) return; // Guard: players array may be empty during online sync
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
        if (s.gameMode === "online" && id.roomCode) {
          setCurrentQuestion(id.roomCode, question.id);
        }
      }
    },
    [getQuestion, dispatch]
  );

  // Safety valve: if the turn is locked in online mode but no modal is visible after 10s,
  // the Firebase write likely failed silently — auto-unlock so the game can continue.
  useEffect(() => {
    if (!stateRef.current.isTurnLocked || stateRef.current.gameMode !== "online") return;
    if (stateRef.current.showCultureModal || stateRef.current.showNotModal || stateRef.current.showQuestionModal) return;

    turnLockTimeoutRef.current = setTimeout(() => {
      dispatch({ type: "UNLOCK_TURN" });
    }, 10_000);

    return () => {
      if (turnLockTimeoutRef.current !== null) {
        clearTimeout(turnLockTimeoutRef.current);
        turnLockTimeoutRef.current = null;
      }
    };
  }, [state.isTurnLocked, state.gameMode, state.showCultureModal, state.showNotModal, state.showQuestionModal, dispatch]);

  // Auto-trigger Not/Culture modal when a player starts their turn already sitting on one
  // of those tiles. Landing on a Not/Culture tile via a correct-answer move just advances
  // the turn; the modal fires automatically at the start of the player's next turn here.
  useEffect(() => {
    if (state.isTurnLocked) return;
    if (state.showCultureModal || state.showNotModal) return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer) return;
    const pos = currentPlayer.position;
    if (pos <= 0 || pos >= MAX_POSITION) return;
    if (!CULTURE_POSITIONS.has(pos) && !NOT_POSITIONS.has(pos)) return;

    if (state.gameMode === "online") {
      // Only the designated answerer writes to Firebase (prevents double-trigger in team mode)
      if (!identity.roomCode) return;
      if (state.isTeamMode) {
        if (!identity.playerId || identity.playerId !== state.currentAnswererId) return;
      } else {
        if (!identity.playerName || currentPlayer.name !== identity.playerName) return;
      }
      dispatch({ type: "LOCK_TURN" });
      if (CULTURE_POSITIONS.has(pos)) {
        const cultures = cultureData as { id: string; question: string; answers: string[] }[];
        const seed = state.currentPlayerIndex + pos;
        const questionIndex = seed % cultures.length;
        activateCulture(identity.roomCode, questionIndex);
      } else {
        const cards = notData as { id: string; answers: string[] }[];
        let pool = cards.filter((c) => !usedNotIds.current.has(c.id));
        if (pool.length === 0) { usedNotIds.current.clear(); pool = cards; }
        const card = pool[Math.floor(Math.random() * pool.length)];
        usedNotIds.current.add(card.id);
        activateNot(identity.roomCode, card);
      }
    } else {
      dispatch({ type: "LOCK_TURN" });
      if (CULTURE_POSITIONS.has(pos)) {
        dispatch({ type: "SHOW_CULTURE_MODAL", show: true });
      } else {
        const cards = notData as { id: string; answers: string[] }[];
        let pool = cards.filter((c) => !usedNotIds.current.has(c.id));
        if (pool.length === 0) { usedNotIds.current.clear(); pool = cards; }
        const card = pool[Math.floor(Math.random() * pool.length)];
        usedNotIds.current.add(card.id);
        dispatch({ type: "SET_NOT_CARD", card });
        dispatch({ type: "SHOW_NOT_MODAL", show: true });
      }
    }
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    state.currentPlayerIndex,
    state.isTurnLocked,
    state.showCultureModal,
    state.showNotModal,
    state.gameMode,
    state.isTeamMode,
    state.currentAnswererId,
    state.players,
    identity.playerName,
    identity.playerId,
    identity.roomCode,
    dispatch,
  ]);

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
      if (state.isTeamMode) {
        // Only active team members can roll; server validates
        if (state.activeTeamId && identity.teamId !== state.activeTeamId) return;
        rollDiceTeam(identity.roomCode, identity.playerId);
      } else {
        rollDice(identity.roomCode, identity.playerId);
      }
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
  }, [state.isTurnLocked, state.gameMode, state.debugMode, state.isTeamMode, state.activeTeamId, identity, dispatch, processRoll]);

  const handleAnswer = useCallback(
    (selectedIndex: number) => {
      if (!state.activeQuestion) return;

      const correct = selectedIndex === state.activeQuestion.correctIndex;
      playSound(correct ? "correct" : "wrong");

      // In online mode, write answer result to Firebase
      // In team mode, only the designated answerer may submit
      if (state.gameMode === "online" && identity.roomCode) {
        const canSubmit = !state.isTeamMode || identity.playerId === state.currentAnswererId;
        if (canSubmit) {
          submitAnswer(
            identity.roomCode,
            selectedIndex,
            state.activeQuestion.correctIndex,
            correct
          ).catch((err) => {
            console.error("[submitAnswer] Firebase write failed:", err);
          });
        }
      }

      return { correct, correctIndex: state.activeQuestion.correctIndex };
    },
    [state.activeQuestion, state.gameMode, state.isTeamMode, state.currentAnswererId, identity, playSound]
  );

  const afterAnswer = useCallback(
    (correct: boolean) => {
      // Use stateRef.current so this callback always reads the latest state,
      // even if React re-rendered between the answer click and this firing.
      const s = stateRef.current;
      const currentPlayer = s.players[s.currentPlayerIndex];

      dispatch({ type: "SHOW_QUESTION_MODAL", show: false });
      dispatch({ type: "CLEAR_QUESTION" });

      if (s.gameMode === "online" && identity.roomCode && identity.playerId) {
        dispatch({ type: "ADVANCE_TURN" });
        dispatch({ type: "UNLOCK_TURN" });

        if (correct) {
          const newPosition = Math.min(
            currentPlayer.position + s.pendingMove,
            MAX_POSITION
          );
          // Advance turn first — this clears currentQuestion in Firebase,
          // which closes the modal on all clients before movement starts
          if (s.isTeamMode && identity.teamId) {
            advanceTeamTurn(identity.roomCode).catch((err) => {
              console.error("[advanceTeamTurn] Firebase write failed:", err);
            });
            animateMovement(currentPlayer.id, currentPlayer.position, s.pendingMove);
            setTimeout(() => {
              updateTeamPosition(identity.roomCode!, identity.teamId!, newPosition).catch((err) => {
                console.error("[updateTeamPosition] Firebase write failed:", err);
              });
            }, s.pendingMove * MOVE_DURATION + 100);
          } else {
            advanceTurn(identity.roomCode).catch((err) => {
              console.error("[advanceTurn] Firebase write failed:", err);
            });
            animateMovement(currentPlayer.id, currentPlayer.position, s.pendingMove);
            setTimeout(() => {
              updatePlayerPosition(identity.roomCode!, identity.playerId!, newPosition).catch((err) => {
                console.error("[updatePlayerPosition] Firebase write failed:", err);
              });
            }, s.pendingMove * MOVE_DURATION + 100);
          }
        } else {
          if (s.isTeamMode) {
            advanceTeamTurn(identity.roomCode).catch((err) => {
              console.error("[advanceTeamTurn] Firebase write failed:", err);
            });
          } else {
            advanceTurn(identity.roomCode).catch((err) => {
              console.error("[advanceTurn] Firebase write failed:", err);
            });
          }
        }
        return;
      }

      // Local mode
      if (correct) {
        animateMovement(currentPlayer.id, currentPlayer.position, s.pendingMove);
        setTimeout(() => {
          dispatch({ type: "ADVANCE_TURN" });
          dispatch({ type: "UNLOCK_TURN" });
        }, s.pendingMove * MOVE_DURATION + 100);
      } else {
        dispatch({ type: "ADVANCE_TURN" });
        dispatch({ type: "UNLOCK_TURN" });
      }
    },
    [dispatch, animateMovement, identity]
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
        if (stateRef.current.gameMode === "online" && identity.roomCode) {
          if (stateRef.current.isTeamMode && identity.teamId) {
            updateTeamPosition(identity.roomCode, identity.teamId, newPos);
            advanceTeamTurn(identity.roomCode);
          } else if (identity.playerId) {
            updatePlayerPosition(identity.roomCode, identity.playerId, newPos);
            advanceTurn(identity.roomCode);
          }
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
        if (stateRef.current.gameMode === "online" && identity.roomCode) {
          if (stateRef.current.isTeamMode && identity.teamId) {
            updateTeamPosition(identity.roomCode, identity.teamId, newPos);
            advanceTeamTurn(identity.roomCode);
          } else if (identity.playerId) {
            updatePlayerPosition(identity.roomCode, identity.playerId, newPos);
            advanceTurn(identity.roomCode);
          }
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
          const cultures = cultureData as { id: string; question: string; answers: string[] }[];
          const seed = state.currentPlayerIndex + position;
          const questionIndex = seed % cultures.length;
          activateCulture(identity.roomCode, questionIndex);
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
    if (!currentPlayer) return;

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
