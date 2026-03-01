import { ref, set, update, get } from "firebase/database";

const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour
import { db } from "./config";
import type { TeamData } from "../types/game";

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(
  playerName: string
): Promise<{ roomCode: string; playerId: string }> {
  const roomCode = generateRoomCode();
  const playerId = Date.now().toString();

  await set(ref(db, `rooms/${roomCode}`), {
    createdAt: Date.now(),
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

  // Delete and reject rooms older than 1 hour
  if (roomData.createdAt && Date.now() - roomData.createdAt > ROOM_TTL_MS) {
    await set(roomRef, null);
    return null;
  }

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
    cultureEvent: null,
    notEvent: null,
  });
}

export async function activateCulture(roomCode: string, questionIndex: number): Promise<void> {
  await set(ref(db, `rooms/${roomCode}/cultureEvent`), { active: true, questionIndex });
}

export async function startCultureTimer(roomCode: string): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/cultureEvent`), {
    timerStartedAt: Date.now(),
  });
}

export async function finishCultureTimerEarly(roomCode: string): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/cultureEvent`), {
    timerStartedAt: Date.now() - 999_000,
  });
}

export async function submitCultureScore(roomCode: string, score: number): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/cultureEvent`), { score });
}

export async function activateNot(roomCode: string, question: { id: string; answers: string[] }): Promise<void> {
  await set(ref(db, `rooms/${roomCode}/notEvent`), { active: true, question });
}

export async function startNotTimer(roomCode: string): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/notEvent`), {
    timerStartedAt: Date.now(),
  });
}

export async function finishNotTimerEarly(roomCode: string): Promise<void> {
  // Backdate timerStartedAt so all clients compute elapsed >> timer duration → timeLeft = 0
  await update(ref(db, `rooms/${roomCode}/notEvent`), {
    timerStartedAt: Date.now() - 999_000,
  });
}

export async function submitNotScore(roomCode: string, score: number): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/notEvent`), { score });
}

export async function clearTurnState(roomCode: string): Promise<void> {
  await update(ref(db, `rooms/${roomCode}`), {
    currentQuestion: null,
    currentRoll: null,
    answerResult: null,
  });
}

export async function resetRoom(roomCode: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const players = roomData.players || {};
  const currentResetId = roomData.resetId || 0;

  const resetPlayers: Record<string, { id: string; name: string; position: number }> = {};
  for (const [key, player] of Object.entries(players)) {
    resetPlayers[key] = { ...(player as { id: string; name: string; position: number }), position: 0 };
  }

  await update(roomRef, {
    players: resetPlayers,
    currentPlayerIndex: 0,
    currentQuestion: null,
    currentRoll: null,
    answerResult: null,
    resetId: currentResetId + 1,
  });
}

// ─── Team mode functions ────────────────────────────────────────────────────

export async function createTeamRoom(
  playerName: string,
  teamName: string
): Promise<{ roomCode: string; playerId: string; teamId: string }> {
  const roomCode = generateRoomCode();
  const playerId = Date.now().toString();
  const teamId = `team_${Date.now() + 1}`;

  const team: TeamData = {
    name: teamName,
    playerIds: [playerId],
    position: 0,
    answerIndex: 0,
  };

  await set(ref(db, `rooms/${roomCode}`), {
    createdAt: Date.now(),
    players: {
      [playerId]: { id: playerId, name: playerName },
    },
    playerOrder: [],
    currentPlayerIndex: 0,
    currentRoll: null,
    currentQuestion: null,
    answerResult: null,
    gameState: "waiting",
    isTeamMode: true,
    teams: { [teamId]: team },
    teamOrder: [teamId],
    currentTeamIndex: 0,
    currentAnswererId: playerId,
    currentDescriberId: null,
  });

  return { roomCode, playerId, teamId };
}

export async function createTeam(
  roomCode: string,
  teamName: string
): Promise<string | null> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return null;

  const roomData = snapshot.val();
  const teamOrder: string[] = roomData.teamOrder || [];
  if (teamOrder.length >= 4) return null;

  const teamId = `team_${Date.now()}`;
  const team: TeamData = { name: teamName, playerIds: [], position: 0, answerIndex: 0 };

  await update(roomRef, {
    [`teams/${teamId}`]: team,
    teamOrder: [...teamOrder, teamId],
  });

  return teamId;
}

export async function joinTeam(
  roomCode: string,
  playerId: string,
  playerName: string,
  teamId: string
): Promise<boolean> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return false;

  const roomData = snapshot.val();
  const team = roomData.teams?.[teamId] as TeamData | undefined;
  if (!team) return false;

  const playerIds: string[] = team.playerIds || [];
  if (playerIds.length >= 2) return false;
  if (playerIds.includes(playerId)) return true;

  await update(roomRef, {
    [`players/${playerId}`]: { id: playerId, name: playerName },
    [`teams/${teamId}/playerIds`]: [...playerIds, playerId],
  });

  return true;
}

export async function leaveTeam(
  roomCode: string,
  playerId: string,
  teamId: string
): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const teams: Record<string, TeamData> = roomData.teams || {};
  const teamOrder: string[] = roomData.teamOrder || [];
  const team = teams[teamId];
  if (!team) return;

  const newPlayerIds = (team.playerIds || []).filter((id: string) => id !== playerId);
  const players = { ...roomData.players };
  delete players[playerId];

  if (newPlayerIds.length === 0) {
    const newTeams = { ...teams };
    delete newTeams[teamId];
    const newTeamOrder = teamOrder.filter((id) => id !== teamId);

    if (newTeamOrder.length === 0) {
      await set(roomRef, null);
      return;
    }

    await update(roomRef, { players, teams: newTeams, teamOrder: newTeamOrder });
  } else {
    await update(roomRef, {
      players,
      [`teams/${teamId}/playerIds`]: newPlayerIds,
    });
  }
}

export async function rollDiceTeam(
  roomCode: string,
  playerId: string
): Promise<boolean> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return false;

  const roomData = snapshot.val();
  const teamOrder: string[] = roomData.teamOrder || [];
  const currentTeamIndex: number = roomData.currentTeamIndex || 0;
  const activeTeamId = teamOrder[currentTeamIndex];
  const activeTeam: TeamData | undefined = roomData.teams?.[activeTeamId];
  if (!activeTeam) return false;

  const playerIds: string[] = activeTeam.playerIds || [];
  if (!playerIds.includes(playerId)) return false;

  const answerIndex: number = activeTeam.answerIndex ?? 0;
  const answererId = playerIds[answerIndex % Math.max(1, playerIds.length)];
  const describerId =
    playerIds.length > 1
      ? playerIds[(answerIndex + 1) % playerIds.length]
      : null;

  const roll = Math.floor(Math.random() * 6) + 1;

  await update(roomRef, {
    currentRoll: { value: roll, id: Date.now() },
    currentAnswererId: answererId,
    currentDescriberId: describerId,
  });

  return true;
}

export async function advanceTeamTurn(roomCode: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const teamOrder: string[] = roomData.teamOrder || [];
  const teams: Record<string, TeamData> = roomData.teams || {};
  const currentTeamIndex: number = roomData.currentTeamIndex || 0;
  const currentTeamId = teamOrder[currentTeamIndex];
  const currentTeam = teams[currentTeamId];

  const currentPlayerIds: string[] = currentTeam?.playerIds || [];
  const newAnswerIndex =
    currentPlayerIds.length > 1
      ? ((currentTeam?.answerIndex ?? 0) + 1) % currentPlayerIds.length
      : 0;

  const nextTeamIndex = (currentTeamIndex + 1) % teamOrder.length;
  const nextTeamId = teamOrder[nextTeamIndex];
  const nextTeam = teams[nextTeamId];
  const nextPlayerIds: string[] = nextTeam?.playerIds || [];
  // When cycling back to the same team (single-team game), use the already-computed
  // newAnswerIndex so roles actually rotate. Otherwise read the next team's stored index.
  const nextAnswerIndex: number =
    nextTeamId === currentTeamId ? newAnswerIndex : (nextTeam?.answerIndex ?? 0);
  const nextAnswererId =
    nextPlayerIds[nextAnswerIndex % Math.max(1, nextPlayerIds.length)] ?? null;
  const nextDescriberId =
    nextPlayerIds.length > 1
      ? nextPlayerIds[(nextAnswerIndex + 1) % nextPlayerIds.length]
      : null;

  await update(roomRef, {
    currentTeamIndex: nextTeamIndex,
    [`teams/${currentTeamId}/answerIndex`]: newAnswerIndex,
    currentRoll: null,
    currentQuestion: null,
    answerResult: null,
    cultureEvent: null,
    notEvent: null,
    currentAnswererId: nextAnswererId,
    currentDescriberId: nextDescriberId,
  });
}

export async function updateTeamPosition(
  roomCode: string,
  teamId: string,
  newPosition: number
): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/teams/${teamId}`), {
    position: newPosition,
  });
}

export async function resetTeamRoom(roomCode: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const teams: Record<string, TeamData> = roomData.teams || {};
  const teamOrder: string[] = roomData.teamOrder || [];
  const currentResetId: number = roomData.resetId || 0;

  const teamUpdates: Record<string, unknown> = {};
  for (const teamId of Object.keys(teams)) {
    teamUpdates[`teams/${teamId}/position`] = 0;
    teamUpdates[`teams/${teamId}/answerIndex`] = 0;
  }

  const firstTeamId = teamOrder[0];
  const firstTeam = teams[firstTeamId];
  const firstPlayerIds: string[] = firstTeam?.playerIds || [];
  const firstAnswererId = firstPlayerIds[0] ?? null;
  const firstDescriberId = firstPlayerIds.length > 1 ? firstPlayerIds[1] : null;

  await update(roomRef, {
    ...teamUpdates,
    currentTeamIndex: 0,
    currentRoll: null,
    currentQuestion: null,
    answerResult: null,
    cultureEvent: null,
    notEvent: null,
    currentAnswererId: firstAnswererId,
    currentDescriberId: firstDescriberId,
    resetId: currentResetId + 1,
  });
}

export async function getTeamRoomData(
  roomCode: string
): Promise<{ teams: Record<string, TeamData>; teamOrder: string[] } | null> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) return null;
  const roomData = snapshot.val();
  if (!roomData.isTeamMode) return null;
  return {
    teams: roomData.teams || {},
    teamOrder: roomData.teamOrder || [],
  };
}
