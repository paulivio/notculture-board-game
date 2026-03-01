import { useEffect, useRef } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "./config";

const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour
import { useGame, useGameDispatch } from "../context/GameContext";
import { useSound } from "../hooks/useSound";
import { MAX_POSITION, PLAYER_COLORS } from "../lib/constants";
import type { RoomData, Player, TeamData } from "../types/game";

interface UseRoomOptions {
  roomCode: string | null;
  myPlayerId: string | null;
  onDiceRoll?: (value: number, callback: () => void, isActive: boolean) => void;
  onQuestionReady?: (questionId: string, rollValue: number) => void;
  onPlayerMove?: (playerId: number, startPos: number, steps: number, onComplete: () => void) => void;
}

export function useRoom({
  roomCode,
  myPlayerId,
  onDiceRoll,
  onQuestionReady,
  onPlayerMove,
}: UseRoomOptions) {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { playSound } = useSound();

  const lastProcessedRollId = useRef<number | null>(null);
  const previousPlayersRef = useRef<Player[]>([]);
  const isActivePlayerRef = useRef(false);
  const canRollRef = useRef(true);
  const lastResetId = useRef<number | null>(null);
  const prevCultureEventRef = useRef<{ active: boolean; timerStartedAt?: number; score?: number } | null>(null);
  const prevNotEventRef = useRef<{ active: boolean; timerStartedAt?: number; score?: number; question?: { id: string; answers: string[] } } | null>(null);
  // Track which player IDs are currently mid-animation on this client
  const animatingPlayersRef = useRef(new Set<number>());
  // Always-current snapshot of local state for use inside onValue callback
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Clear animation tracking whenever the room disconnects so stale state
  // doesn't carry over into a new session.
  useEffect(() => {
    if (!roomCode) {
      animatingPlayersRef.current.clear();
      previousPlayersRef.current = [];
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);

    const unsubscribe = onValue(roomRef, async (snapshot) => {
      const roomData: RoomData | null = snapshot.val();
      if (!roomData) return;

      // Auto-delete rooms older than 1 hour and bail out
      if (roomData.createdAt && Date.now() - roomData.createdAt > ROOM_TTL_MS) {
        await set(roomRef, null);
        dispatch({ type: "RESET_GAME" });
        return;
      }

      const isTeamMode = !!roomData.isTeamMode;
      const currentAnswererId = roomData.currentAnswererId ?? null;
      const currentDescriberId = roomData.currentDescriberId ?? null;
      const teamOrder: string[] = roomData.teamOrder || [];
      const teams: Record<string, TeamData> = (roomData.teams as Record<string, TeamData>) || {};
      const currentTeamIndex: number = roomData.currentTeamIndex || 0;
      const activeTeamId = teamOrder[currentTeamIndex] ?? null;

      const firebasePlayers = roomData.players || {};
      const playerOrder = roomData.playerOrder || [];
      const activeIndex = roomData.currentPlayerIndex || 0;
      const activePlayerKey = playerOrder[activeIndex];

      // Determine active player and can-roll state
      if (isTeamMode) {
        isActivePlayerRef.current = myPlayerId === currentAnswererId;
        const activeTeam = activeTeamId ? teams[activeTeamId] : null;
        canRollRef.current = (activeTeam?.playerIds ?? []).includes(myPlayerId ?? "");
      } else {
        isActivePlayerRef.current = myPlayerId === activePlayerKey;
        canRollRef.current = true;
      }

      let playersArray: Player[];

      if (isTeamMode) {
        playersArray = teamOrder
          .filter((tid) => teams[tid])
          .map((tid, index) => ({
            id: index + 1,
            name: teams[tid].name,
            position: teams[tid].position ?? 0,
            color: PLAYER_COLORS[index + 1] ?? PLAYER_COLORS[1],
          }));
      } else {
        playersArray = playerOrder
          .filter((key) => firebasePlayers[key])
          .map((key, index) => ({
            id: index + 1,
            name: firebasePlayers[key].name,
            position: firebasePlayers[key].position ?? 0,
            color: PLAYER_COLORS[index + 1],
          }));
      }

      const previousPlayers = previousPlayersRef.current;

      // Determine which slot is "local" (i.e. being animated by this client).
      // In team mode: ALL members of a team protect their own team's slot so that
      // Firebase position updates after advanceTeamTurn don't trigger a second animation
      // on the answerer's device. Describer sees the token teleport rather than step-move,
      // which is acceptable and much better than the revert-then-reanimate bug.
      let myLocalIndex: number;
      if (isTeamMode) {
        myLocalIndex = teamOrder.findIndex((tid) =>
          (teams[tid]?.playerIds ?? []).includes(myPlayerId ?? "")
        );
      } else {
        myLocalIndex = playerOrder.indexOf(myPlayerId ?? "");
      }

      // Build the array to dispatch. For non-local players that are animating or
      // just started animating, use their current local position so SYNC_ONLINE_STATE
      // never interrupts mid-animation movement.
      const playersForSync = playersArray.map((player, idx) => {
        const prev = previousPlayers.find((p) => p.id === player.id);

        // Always let the answerer/local player's own position through untouched —
        // the "don't go backwards" rule in the reducer handles that side.
        if (idx === myLocalIndex || !prev) return player;

        // Already animating this player — preserve the current local position
        if (animatingPlayersRef.current.has(player.id)) {
          const localPos = stateRef.current.players.find(
            (p) => p.id === player.id
          )?.position;
          if (localPos !== undefined) {
            return { ...player, position: localPos };
          }
        }

        // Position advanced for a non-local player → start animation
        if (player.position > prev.position && onPlayerMove) {
          animatingPlayersRef.current.add(player.id);
          onPlayerMove(
            player.id,
            prev.position,
            player.position - prev.position,
            () => animatingPlayersRef.current.delete(player.id)
          );
          // Show win modal immediately — don't wait for animation to finish
          if (player.position >= MAX_POSITION) {
            dispatch({ type: "SHOW_WIN_MODAL", show: true });
          }
          // Dispatch old position; animation will move it step-by-step
          return { ...player, position: prev.position };
        }

        return player;
      });

      // Store actual Firebase values so each position change only triggers once
      previousPlayersRef.current = playersArray;

      // Detect game reset — dispatch RESET_GAME on all clients when resetId changes
      const currentResetId = roomData.resetId || 0;
      if (lastResetId.current !== null && currentResetId !== lastResetId.current) {
        dispatch({ type: "RESET_GAME" });
      }
      lastResetId.current = currentResetId;

      // Sync team mode state before the general sync
      dispatch({ type: "SET_TEAM_MODE", value: isTeamMode });
      dispatch({ type: "SET_ANSWERER_IDS", answererId: currentAnswererId, describerId: currentDescriberId });
      dispatch({ type: "SET_ACTIVE_TEAM", teamId: activeTeamId });

      dispatch({
        type: "SYNC_ONLINE_STATE",
        players: playersForSync,
        currentPlayerIndex: isTeamMode ? currentTeamIndex : activeIndex,
      });

      // Handle dice roll
      if (roomData.currentRoll) {
        const { value, id } = roomData.currentRoll;
        if (id !== lastProcessedRollId.current) {
          lastProcessedRollId.current = id;
          if (onDiceRoll) {
            onDiceRoll(value, () => {}, isActivePlayerRef.current);
          }
        }
      }

      if (!roomData.currentRoll) {
        lastProcessedRollId.current = null;
      }

      // Handle question sync
      if (roomData.currentQuestion && state.questionsLoaded) {
        const rollValue = roomData.currentRoll?.value ?? 1;
        onQuestionReady?.(roomData.currentQuestion, rollValue);
      }

      if (!roomData.currentQuestion) {
        dispatch({ type: "SHOW_QUESTION_MODAL", show: false });
      }

      // Sync answer result to all players so the modal shows feedback everywhere
      if (roomData.answerResult) {
        dispatch({ type: "SET_ANSWER_RESULT", result: roomData.answerResult });
        // Play sound for everyone except the answerer (who heard it on submit)
        const isAnswerer = isTeamMode
          ? myPlayerId === currentAnswererId
          : myPlayerId === activePlayerKey;
        if (!isAnswerer) {
          playSound(roomData.answerResult.wasCorrect ? "correct" : "wrong");
        }
      } else {
        dispatch({ type: "SET_ANSWER_RESULT", result: null });
      }

      // Culture tile events
      const cultureEvent = roomData.cultureEvent ?? null;
      const prevCulture = prevCultureEventRef.current;

      if (cultureEvent?.active && !prevCulture?.active) {
        dispatch({ type: "SHOW_CULTURE_MODAL", show: true });
        if (cultureEvent.questionIndex !== undefined) {
          dispatch({ type: "SET_CULTURE_QUESTION_INDEX", index: cultureEvent.questionIndex });
        }
      }

      if (!cultureEvent?.active && prevCulture?.active) {
        dispatch({ type: "SHOW_CULTURE_MODAL", show: false });
      }

      if (cultureEvent?.timerStartedAt && cultureEvent.timerStartedAt !== prevCulture?.timerStartedAt) {
        dispatch({ type: "SET_CULTURE_TIMER_START", startedAt: cultureEvent.timerStartedAt });
      }

      if (cultureEvent?.score !== undefined && prevCulture?.score === undefined) {
        dispatch({ type: "SET_CULTURE_SCORE", score: cultureEvent.score });
      }

      prevCultureEventRef.current = cultureEvent;

      // Not tile events
      const notEvent = roomData.notEvent ?? null;
      const prevNot = prevNotEventRef.current;

      if (notEvent?.active && !prevNot?.active) {
        if (notEvent.question) {
          dispatch({ type: "SET_NOT_CARD", card: notEvent.question });
        }
        dispatch({ type: "SHOW_NOT_MODAL", show: true });
      }

      if (!notEvent?.active && prevNot?.active) {
        dispatch({ type: "SHOW_NOT_MODAL", show: false });
      }

      if (notEvent?.timerStartedAt && notEvent.timerStartedAt !== prevNot?.timerStartedAt) {
        dispatch({ type: "SET_NOT_TIMER_START", startedAt: notEvent.timerStartedAt });
      }

      if (notEvent?.score !== undefined && prevNot?.score === undefined) {
        dispatch({ type: "SET_NOT_SCORE", score: notEvent.score });
      }

      prevNotEventRef.current = notEvent;
    });

    return () => unsubscribe();
  }, [roomCode, myPlayerId, dispatch, playSound, state.questionsLoaded, onDiceRoll, onQuestionReady, onPlayerMove]);

  return { isActivePlayer: isActivePlayerRef, canRoll: canRollRef };
}
