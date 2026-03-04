import { useState, useCallback, useRef, useEffect } from "react";
import { useGame, useGameDispatch } from "../context/GameContext";
import { useOnline } from "../context/OnlineContext";
import { useQuestions } from "./useQuestions";
import { useSound } from "./useSound";
import {
  SPIRAL_PATH,
  CULTURE_POSITIONS,
  NOT_POSITIONS,
  MAX_POSITION,
  MOVE_DURATION,
  PLATFORMING_TEST_MODE,
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
        const effectiveMax = stateRef.current.customBoardConfig
          ? stateRef.current.customBoardConfig.totalTiles - 1
          : MAX_POSITION;

        if (remaining <= 0) {
          movingRef.current = false;
          onComplete?.();
          if (current >= effectiveMax) {
            dispatch({ type: "SHOW_WIN_MODAL", show: true });
          }
          return;
        }

        if (current < effectiveMax) {
          current++;
          dispatch({
            type: "SET_PLAYER_POSITION",
            playerId,
            position: current,
          });
          // Delay sound to match when the token visually lands
          setTimeout(() => playSound("move"), MOVE_DURATION * 0.99);
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

      const customConfig = s.customBoardConfig;
      const effectiveMax = customConfig ? customConfig.totalTiles - 1 : MAX_POSITION;

      let category: Category;
      if (customConfig) {
        // Use the tile type from the custom board config
        const tileType = customConfig.tiles[pathIndex];
        if (pathIndex === 0 || pathIndex >= effectiveMax) {
          // Start/finish: pick a random category
          const cats = s.activeCategories;
          category = cats[Math.floor(Math.random() * cats.length)];
        } else if (tileType === "not" || tileType === "culture" || tileType === "start" || tileType === "finish") {
          // Special tiles handled elsewhere (auto-trigger effect); use random as fallback
          const cats = s.activeCategories;
          category = cats[Math.floor(Math.random() * cats.length)];
        } else if (tileType === "auto") {
          // "auto" tiles fall back to cycling category
          category = s.activeCategories[pathIndex % s.activeCategories.length];
        } else {
          category = tileType as Category;
        }
      } else {
        const activeCategories = s.activeCategories;
        if (pathIndex === 0 || pathIndex === SPIRAL_PATH.length - 1) {
          category = activeCategories[Math.floor(Math.random() * activeCategories.length)];
        } else {
          category = activeCategories[pathIndex % activeCategories.length];
        }
      }

      // Test mode: skip question entirely, go straight to platforming
      if (PLATFORMING_TEST_MODE && s.gameMode !== "online") {
        const target = Math.min(currentPlayer.position + roll, effectiveMax);
        dispatch({ type: "ACTIVATE_PLATFORMING", target });
        return;
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
    const customConfig = state.customBoardConfig;
    const effectiveMax = customConfig ? customConfig.totalTiles - 1 : MAX_POSITION;
    if (pos <= 0 || pos >= effectiveMax) return;

    const isCulturePos = customConfig
      ? (customConfig.tiles[pos] === "culture")
      : CULTURE_POSITIONS.has(pos);
    const isNotPos = customConfig
      ? (customConfig.tiles[pos] === "not")
      : NOT_POSITIONS.has(pos);
    // "auto" tiles are never culture or not
    if (!isCulturePos && !isNotPos) return;

    if (state.gameMode === "online") {
      // Only the designated answerer writes to Firebase (prevents double-trigger in team mode)
      if (!identity.roomCode) return;
      if (state.isTeamMode) {
        if (!identity.playerId || identity.playerId !== state.currentAnswererId) return;
      } else {
        if (!identity.playerName || currentPlayer.name !== identity.playerName) return;
      }
      dispatch({ type: "LOCK_TURN" });
      if (isCulturePos) {
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
      if (isCulturePos) {
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
    state.customBoardConfig,
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

      // In local mode, dispatch answer result so character animations (e.g. hit) can react
      if (state.gameMode !== "online" && !correct) {
        dispatch({
          type: "SET_ANSWER_RESULT",
          result: { wasCorrect: false, selectedIndex, correctIndex: state.activeQuestion.correctIndex },
        });
        setTimeout(() => dispatch({ type: "SET_ANSWER_RESULT", result: null }), 1500);
      }

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
          const effectiveMax = s.customBoardConfig
            ? s.customBoardConfig.totalTiles - 1
            : MAX_POSITION;
          const newPosition = Math.min(
            currentPlayer.position + s.pendingMove,
            effectiveMax
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
        if (PLATFORMING_TEST_MODE) {
          const effectiveMax = s.customBoardConfig
            ? s.customBoardConfig.totalTiles - 1
            : MAX_POSITION;
          const target = Math.min(currentPlayer.position + s.pendingMove, effectiveMax);
          dispatch({ type: "ACTIVATE_PLATFORMING", target });
          // Turn stays locked; PlatformingController calls handlePlatformingComplete
        } else {
          animateMovement(currentPlayer.id, currentPlayer.position, s.pendingMove);
          setTimeout(() => {
            dispatch({ type: "ADVANCE_TURN" });
            dispatch({ type: "UNLOCK_TURN" });
          }, s.pendingMove * MOVE_DURATION + 100);
        }
      } else {
        dispatch({ type: "ADVANCE_TURN" });
        dispatch({ type: "UNLOCK_TURN" });
      }
    },
    [dispatch, animateMovement, identity]
  );

  const handlePlatformingComplete = useCallback(() => {
    const s = stateRef.current;
    const p = s.players[s.currentPlayerIndex];
    if (!p || s.platformingTarget === null) return;
    dispatch({ type: "DEACTIVATE_PLATFORMING" });
    dispatch({ type: "SET_PLAYER_POSITION", playerId: p.id, position: s.platformingTarget });
    const max = s.customBoardConfig ? s.customBoardConfig.totalTiles - 1 : MAX_POSITION;
    if (s.platformingTarget >= max) dispatch({ type: "SHOW_WIN_MODAL", show: true });
    dispatch({ type: "ADVANCE_TURN" });
    dispatch({ type: "UNLOCK_TURN" });
  }, [dispatch]);

  const handleCultureScore = useCallback(
    (score: number) => {
      dispatch({ type: "SHOW_CULTURE_MODAL", show: false });
      const currentPlayer = stateRef.current.players[stateRef.current.currentPlayerIndex];
      const culturePos = currentPlayer.position;

      animateMovement(currentPlayer.id, culturePos, score, () => {
        const effectiveMax = stateRef.current.customBoardConfig
          ? stateRef.current.customBoardConfig.totalTiles - 1
          : MAX_POSITION;
        const newPos = Math.min(culturePos + score, effectiveMax);
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
        const effectiveMax = stateRef.current.customBoardConfig
          ? stateRef.current.customBoardConfig.totalTiles - 1
          : MAX_POSITION;
        const newPos = Math.min(notPos + score, effectiveMax);
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
      const customConfig = state.customBoardConfig;
      const effectiveMax = customConfig ? customConfig.totalTiles - 1 : MAX_POSITION;
      if (position === 0 || position >= effectiveMax) return;

      dispatch({ type: "LOCK_TURN" });

      const isCulturePos = customConfig
        ? customConfig.tiles[position] === "culture"
        : CULTURE_POSITIONS.has(position);
      const isNotPos = customConfig
        ? customConfig.tiles[position] === "not"
        : NOT_POSITIONS.has(position);

      if (isCulturePos) {
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

      if (isNotPos) {
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

      const rawTile = customConfig?.tiles[position];
      const category = rawTile && rawTile !== "start" && rawTile !== "finish" && rawTile !== "not" && rawTile !== "culture" && rawTile !== "auto"
        ? rawTile as Category
        : state.activeCategories[position % state.activeCategories.length];
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
    [state.customBoardConfig, state.gameMode, state.activeCategories, state.currentPlayerIndex, identity.roomCode, dispatch, getQuestion]
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
    handlePlatformingComplete,
  };
}
