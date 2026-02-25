import { useEffect, useRef, useCallback } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "./config";
import { useGame, useGameDispatch } from "../context/GameContext";
import { useSound } from "../hooks/useSound";
import type { RoomData, Player } from "../types/game";

interface UseRoomOptions {
  roomCode: string | null;
  myPlayerId: string | null;
  onDiceRoll?: (value: number, callback: () => void) => void;
  onQuestionReady?: (questionId: string, rollValue: number) => void;
}

export function useRoom({
  roomCode,
  myPlayerId,
  onDiceRoll,
  onQuestionReady,
}: UseRoomOptions) {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { playSound } = useSound();

  const lastProcessedRollId = useRef<number | null>(null);
  const previousPlayersRef = useRef<Player[]>([]);
  const isActivePlayerRef = useRef(false);

  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const roomData: RoomData | null = snapshot.val();
      if (!roomData) return;

      // Sync players
      const firebasePlayers = roomData.players || {};
      const playerOrder = roomData.playerOrder || [];
      const activeIndex = roomData.currentPlayerIndex || 0;
      const activePlayerKey = playerOrder[activeIndex];

      isActivePlayerRef.current = myPlayerId === activePlayerKey;

      const playersArray: Player[] = playerOrder
        .filter((key) => firebasePlayers[key])
        .map((key, index) => ({
          id: index + 1,
          name: firebasePlayers[key].name,
          position: firebasePlayers[key].position,
        }));

      const previousPlayers = previousPlayersRef.current;

      dispatch({
        type: "SYNC_ONLINE_STATE",
        players: playersArray,
        currentPlayerIndex: activeIndex,
      });

      previousPlayersRef.current = playersArray;

      // Handle dice roll
      if (roomData.currentRoll) {
        const { value, id } = roomData.currentRoll;
        if (id !== lastProcessedRollId.current) {
          lastProcessedRollId.current = id;

          if (onDiceRoll) {
            onDiceRoll(value, () => {
              // After animation, only active player processes the roll
            });
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

      // Handle answer result for non-active players
      if (roomData.answerResult && myPlayerId !== activePlayerKey) {
        playSound(roomData.answerResult.wasCorrect ? "correct" : "wrong");
      }
    });

    return () => unsubscribe();
  }, [roomCode, myPlayerId, dispatch, playSound, state.questionsLoaded, onDiceRoll, onQuestionReady]);

  return { isActivePlayer: isActivePlayerRef };
}
