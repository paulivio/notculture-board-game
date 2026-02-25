import { ref, set, update, get } from "firebase/database";
import { db } from "./config";

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(
  playerName: string
): Promise<{ roomCode: string; playerId: string }> {
  const roomCode = generateRoomCode();
  const playerId = Date.now().toString();

  await set(ref(db, `rooms/${roomCode}`), {
    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        position: 0,
      },
    },
    playerOrder: [playerId],
    currentPlayerIndex: 0,
    currentRoll: null,
    currentQuestion: null,
    answerResult: null,
    gameState: "waiting",
  });

  return { roomCode, playerId };
}

export async function joinRoom(
  roomCode: string,
  playerName: string,
  existingPlayerId?: string
): Promise<{ playerId: string } | null> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) return null;

  const roomData = snapshot.val();
  const playerId = existingPlayerId ?? Date.now().toString();

  const existingPlayers = roomData.players || {};
  const existingOrder = roomData.playerOrder || [];

  // Reconnect if already in room
  if (existingPlayers[playerId]) {
    return { playerId };
  }

  await update(roomRef, {
    [`players/${playerId}`]: {
      id: playerId,
      name: playerName,
      position: 0,
    },
    playerOrder: [...existingOrder, playerId],
  });

  return { playerId };
}

export async function leaveRoom(
  roomCode: string,
  playerId: string
): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const players = roomData.players || {};
  const playerOrder: string[] = roomData.playerOrder || [];

  delete players[playerId];
  const newOrder = playerOrder.filter((id) => id !== playerId);

  if (newOrder.length === 0) {
    await set(roomRef, null);
    return;
  }

  await update(roomRef, {
    players,
    playerOrder: newOrder,
  });
}

export async function rollDice(
  roomCode: string,
  playerId: string
): Promise<boolean> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) return false;

  const roomData = snapshot.val();
  const playerKeys = Object.keys(roomData.players || {});
  const activeIndex = roomData.currentPlayerIndex || 0;
  const activePlayerKey = (roomData.playerOrder || playerKeys)[activeIndex];

  if (playerId !== activePlayerKey) return false;

  const roll = Math.floor(Math.random() * 6) + 1;

  await update(roomRef, {
    currentRoll: { value: roll, id: Date.now() },
  });

  return true;
}

export async function setCurrentQuestion(
  roomCode: string,
  questionId: string
): Promise<void> {
  await update(ref(db, `rooms/${roomCode}`), {
    currentQuestion: questionId,
  });
}

export async function submitAnswer(
  roomCode: string,
  selectedIndex: number,
  correctIndex: number,
  wasCorrect: boolean
): Promise<void> {
  await update(ref(db, `rooms/${roomCode}`), {
    answerResult: { selectedIndex, correctIndex, wasCorrect },
  });
}

export async function updatePlayerPosition(
  roomCode: string,
  playerId: string,
  newPosition: number
): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
    position: newPosition,
  });
}

export async function advanceTurn(roomCode: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const playerOrder: string[] = roomData.playerOrder || [];
  const currentIndex = roomData.currentPlayerIndex || 0;
  const nextIndex = (currentIndex + 1) % playerOrder.length;

  await update(roomRef, {
    currentPlayerIndex: nextIndex,
    currentQuestion: null,
    currentRoll: null,
    answerResult: null,
  });
}

export async function clearTurnState(roomCode: string): Promise<void> {
  await update(ref(db, `rooms/${roomCode}`), {
    currentQuestion: null,
    currentRoll: null,
    answerResult: null,
  });
}
