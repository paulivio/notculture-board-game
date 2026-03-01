import { useState, useEffect, useCallback, useRef } from "react";
import { get, ref, onValue } from "firebase/database";
import { PLAYER_COLORS, LS_ROOM_CODE, LS_PLAYER_ID, LS_PLAYER_NAME, LS_TEAM_ID, LS_TEAM_NAME } from "../../lib/constants";
import { db } from "../../firebase/config";
import { TextureButton } from "../ui/TextureButton";
import {
  createRoom,
  createTeamRoom,
  createTeam,
  joinRoom,
  joinTeam,
  leaveRoom,
  leaveTeam,
  resetRoom,
  resetTeamRoom,
} from "../../firebase/roomService";
import { useRoom } from "../../firebase/hooks";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import { useOnline } from "../../context/OnlineContext";
import type { TeamData } from "../../types/game";

// Room/player identity is stored in sessionStorage so each browser tab gets its
// own isolated identity — tabs on the same device don't bleed into each other.
// Only the player name is kept in localStorage for cross-session convenience.
const ss = sessionStorage;

function freshPlayerId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export default function OnlineControls() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { triggerDiceAnimation, processRoll, animateMovement } = useGameLogicContext();
  const { identity, setIdentity } = useOnline();

  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [teamNameInput, setTeamNameInput] = useState("");
  const [isTeamModeChecked, setIsTeamModeChecked] = useState(false);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);

  // Team lobby state (shown after joining a team-mode room)
  const [teamLobby, setTeamLobby] = useState<{
    roomCode: string;
    playerId: string;
    playerName: string;
    teams: Record<string, TeamData>;
    teamOrder: string[];
  } | null>(null);
  const [newTeamNameInput, setNewTeamNameInput] = useState("");
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  // Tracks whether this browser session has already started a room (create/join).
  // Used to prevent the auto-reconnect effect from overwriting a freshly created room
  // if the Firebase promise resolves after the user has already set up a new session.
  const sessionStartedRef = useRef(false);

  // Live team roster for the in-room view
  const [teamRoster, setTeamRoster] = useState<{
    teamOrder: string[];
    teams: Record<string, { name: string; playerIds: string[] }>;
    players: Record<string, { name: string }>;
  } | null>(null);

  // Stable ref so onQuestionReady doesn't capture state.questions in its closure.
  // state.questions is a new array reference on every SYNC_ONLINE_STATE dispatch,
  // which would make onQuestionReady unstable → useRoom re-subscribes → infinite loop.
  const questionsRef = useRef(state.questions);
  questionsRef.current = state.questions;

  // Pre-fill name input from localStorage (persists across sessions for convenience)
  useEffect(() => {
    const savedName = localStorage.getItem(LS_PLAYER_NAME);
    if (savedName && !playerNameInput) setPlayerNameInput(savedName);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to live team roster when in a team-mode room
  useEffect(() => {
    if (!identity.roomCode || !state.isTeamMode) {
      setTeamRoster(null);
      return;
    }
    const roomRef = ref(db, `rooms/${identity.roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data?.isTeamMode) return;
      setTeamRoster({
        teamOrder: data.teamOrder || [],
        teams: data.teams || {},
        players: data.players || {},
      });
    });
    return () => unsubscribe();
  }, [identity.roomCode, state.isTeamMode]);

  // Reconnect from sessionStorage (per-tab — won't bleed between tabs)
  useEffect(() => {
    const savedRoom = ss.getItem(LS_ROOM_CODE);
    const savedId = ss.getItem(LS_PLAYER_ID);
    const savedName = localStorage.getItem(LS_PLAYER_NAME); // name stays in localStorage
    const savedTeamId = ss.getItem(LS_TEAM_ID);
    const savedTeamName = ss.getItem(LS_TEAM_NAME);

    if (savedRoom && savedId && savedName) {
      if (savedTeamId) {
        // Team mode reconnect
        joinTeam(savedRoom, savedId, savedName, savedTeamId).then(async (ok) => {
          if (sessionStartedRef.current) return;
          if (ok) {
            setIdentity({
              roomCode: savedRoom,
              playerId: savedId,
              playerName: savedName,
              teamId: savedTeamId,
              teamName: savedTeamName,
            });
          } else {
            // Team was deleted — check if the room still exists
            const snapshot = await get(ref(db, `rooms/${savedRoom}`));
            if (sessionStartedRef.current) return;
            if (!snapshot.exists()) {
              // Room is gone — clear stale session data
              ss.removeItem(LS_ROOM_CODE);
              ss.removeItem(LS_PLAYER_ID);
              ss.removeItem(LS_TEAM_ID);
              ss.removeItem(LS_TEAM_NAME);
            } else if (snapshot.val()?.isTeamMode) {
              // Room exists but original team is gone — show lobby
              const roomData = snapshot.val();
              setTeamLobby({
                roomCode: savedRoom,
                playerId: savedId,
                playerName: savedName,
                teams: roomData.teams || {},
                teamOrder: roomData.teamOrder || [],
              });
            }
          }
        });
      } else {
        // Regular reconnect
        joinRoom(savedRoom, savedName, savedId).then((result) => {
          if (sessionStartedRef.current) return;
          if (result) {
            setIdentity({
              roomCode: savedRoom,
              playerId: result.playerId,
              playerName: savedName,
              teamId: null,
              teamName: null,
            });
          }
        });
      }
    }
  }, [setIdentity]);

  const onDiceRoll = useCallback(
    (value: number, _callback: () => void, isActive: boolean) => {
      if (isActive) dispatch({ type: "LOCK_TURN" });
      triggerDiceAnimation(value, () => {
        if (isActive) {
          processRoll(value);
        }
      });
    },
    [dispatch, triggerDiceAnimation, processRoll]
  );

  const onQuestionReady = useCallback(
    (questionId: string, rollValue: number) => {
      const question = questionsRef.current.find((q) => q.id === questionId);
      if (question) {
        dispatch({ type: "SET_ACTIVE_QUESTION", question, roll: rollValue });
      }
    },
    [dispatch]
  );

  const onPlayerMove = useCallback(
    (playerId: number, startPos: number, steps: number, onComplete: () => void) => {
      animateMovement(playerId, startPos, steps, onComplete);
    },
    [animateMovement]
  );

  useRoom({
    roomCode: identity.roomCode,
    myPlayerId: identity.playerId,
    onDiceRoll,
    onQuestionReady,
    onPlayerMove,
  });

  const handleCreate = async () => {
    const name = playerNameInput.trim();
    const teamName = teamNameInput.trim() || "Team 1";
    if (!name) {
      alert("Enter your name first.");
      return;
    }
    sessionStartedRef.current = true;

    if (isTeamModeChecked) {
      const { roomCode, playerId, teamId } = await createTeamRoom(name, teamName);

      ss.setItem(LS_ROOM_CODE, roomCode);
      ss.setItem(LS_PLAYER_ID, playerId);
      ss.setItem(LS_TEAM_ID, teamId);
      ss.setItem(LS_TEAM_NAME, teamName);
      localStorage.setItem(LS_PLAYER_NAME, name);

      setIdentity({ roomCode, playerId, playerName: name, teamId, teamName });
      setCreatedRoomCode(roomCode);
    } else {
      const { roomCode, playerId } = await createRoom(name);

      ss.setItem(LS_ROOM_CODE, roomCode);
      ss.setItem(LS_PLAYER_ID, playerId);
      ss.removeItem(LS_TEAM_ID);
      ss.removeItem(LS_TEAM_NAME);
      localStorage.setItem(LS_PLAYER_NAME, name);

      setIdentity({ roomCode, playerId, playerName: name, teamId: null, teamName: null });
      setCreatedRoomCode(roomCode);
    }
  };

  const handleJoin = async () => {
    const code = roomCodeInput.trim().toUpperCase();
    const name = playerNameInput.trim();

    if (!code || !name) {
      alert("Enter room code and name.");
      return;
    }

    sessionStartedRef.current = true;

    const snapshot = await get(ref(db, `rooms/${code}`));
    if (!snapshot.exists()) {
      alert("Room does not exist.");
      return;
    }

    const roomData = snapshot.val();

    // Only reuse the saved player ID when rejoining the exact same room in this tab
    // (true reconnect scenario). A fresh tab will have no sessionStorage entry.
    const savedRoomCode = ss.getItem(LS_ROOM_CODE);
    const savedPlayerId = savedRoomCode === code ? ss.getItem(LS_PLAYER_ID) : null;

    if (roomData.isTeamMode) {
      const playerId = savedPlayerId || freshPlayerId();
      setTeamLobby({
        roomCode: code,
        playerId,
        playerName: name,
        teams: roomData.teams || {},
        teamOrder: roomData.teamOrder || [],
      });
      return;
    }

    const result = await joinRoom(code, name, savedPlayerId ?? undefined);
    if (!result) {
      alert("Room does not exist.");
      return;
    }

    ss.setItem(LS_ROOM_CODE, code);
    ss.setItem(LS_PLAYER_ID, result.playerId);
    ss.removeItem(LS_TEAM_ID);
    ss.removeItem(LS_TEAM_NAME);
    localStorage.setItem(LS_PLAYER_NAME, name);

    setIdentity({ roomCode: code, playerId: result.playerId, playerName: name, teamId: null, teamName: null });
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!teamLobby) return;
    setLobbyError(null);
    sessionStartedRef.current = true;

    const ok = await joinTeam(teamLobby.roomCode, teamLobby.playerId, teamLobby.playerName, teamId);
    if (!ok) {
      setLobbyError("Could not join that team (it may be full).");
      return;
    }

    const joinedTeamName = teamLobby.teams[teamId]?.name ?? null;

    ss.setItem(LS_ROOM_CODE, teamLobby.roomCode);
    ss.setItem(LS_PLAYER_ID, teamLobby.playerId);
    ss.setItem(LS_TEAM_ID, teamId);
    if (joinedTeamName) ss.setItem(LS_TEAM_NAME, joinedTeamName);
    localStorage.setItem(LS_PLAYER_NAME, teamLobby.playerName);

    setIdentity({
      roomCode: teamLobby.roomCode,
      playerId: teamLobby.playerId,
      playerName: teamLobby.playerName,
      teamId,
      teamName: joinedTeamName,
    });
    setTeamLobby(null);
  };

  const handleCreateAndJoinTeam = async () => {
    if (!teamLobby) return;
    const tName = newTeamNameInput.trim();
    if (!tName) { setLobbyError("Enter a team name."); return; }
    setLobbyError(null);

    const snapshot = await get(ref(db, `rooms/${teamLobby.roomCode}`));
    if (!snapshot.exists()) { setLobbyError("Room not found."); return; }
    const roomData = snapshot.val();
    const currentTeamOrder: string[] = roomData.teamOrder || [];
    if (currentTeamOrder.length >= 4) { setLobbyError("Maximum 4 teams reached."); return; }

    const newTeamId = await createTeam(teamLobby.roomCode, tName);
    if (!newTeamId) { setLobbyError("Could not create team."); return; }

    await handleJoinTeam(newTeamId);
  };

  const refreshLobby = async () => {
    if (!teamLobby) return;
    const snapshot = await get(ref(db, `rooms/${teamLobby.roomCode}`));
    if (!snapshot.exists()) { setTeamLobby(null); return; }
    const roomData = snapshot.val();
    setTeamLobby((prev) => prev ? {
      ...prev,
      teams: roomData.teams || {},
      teamOrder: roomData.teamOrder || [],
    } : null);
  };

  const handleLeave = async () => {
    if (identity.roomCode && identity.playerId) {
      if (identity.teamId) {
        await leaveTeam(identity.roomCode, identity.playerId, identity.teamId);
      } else {
        await leaveRoom(identity.roomCode, identity.playerId);
      }
    }
    ss.removeItem(LS_ROOM_CODE);
    ss.removeItem(LS_PLAYER_ID);
    ss.removeItem(LS_TEAM_ID);
    ss.removeItem(LS_TEAM_NAME);
    setIdentity({ roomCode: null, playerId: null, playerName: null, teamId: null, teamName: null });
    setCreatedRoomCode(null);
  };

  const handleReset = async () => {
    if (!identity.roomCode) return;
    if (state.isTeamMode) {
      await resetTeamRoom(identity.roomCode);
    } else {
      await resetRoom(identity.roomCode);
    }
  };

  // ── Team lobby panel ─────────────────────────────────────────────────────
  if (teamLobby) {
    return (
      <div className="flex flex-col items-center gap-3 w-[300px]">
        <p className="font-bold text-success">Room: {teamLobby.roomCode}</p>
        <p className="text-sm font-semibold">Choose your team:</p>

        {teamLobby.teamOrder.map((tid) => {
          const team = teamLobby.teams[tid];
          if (!team) return null;
          const memberCount = team.playerIds?.length ?? 0;
          const full = memberCount >= 2;
          return (
            <div key={tid} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
              <span className="text-sm font-semibold">
                {team.name}
                <span className="ml-2 text-xs opacity-50">{memberCount}/2 players</span>
              </span>
              <TextureButton
                variant="primary"
                onClick={() => handleJoinTeam(tid)}
                disabled={full}
              >
                Join
              </TextureButton>
            </div>
          );
        })}

        {teamLobby.teamOrder.length < 4 && (
          <div className="flex w-full flex-col gap-2">
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40"
              placeholder="New team name"
              value={newTeamNameInput}
              onChange={(e) => setNewTeamNameInput(e.target.value)}
            />
            <TextureButton onClick={handleCreateAndJoinTeam}>
              + Create & Join New Team
            </TextureButton>
          </div>
        )}

        {lobbyError && <p className="text-sm text-error">{lobbyError}</p>}

        <div className="flex gap-2">
          <TextureButton onClick={refreshLobby}>Refresh</TextureButton>
          <TextureButton variant="danger" onClick={() => setTeamLobby(null)}>Cancel</TextureButton>
        </div>
      </div>
    );
  }

  // ── In-room view ────────────────────────────────────────────────────────
  if (identity.roomCode) {
    return (
      <div className="flex flex-col items-center gap-2 w-full max-w-xs">
        {/* Team roster */}
        {state.isTeamMode && teamRoster && teamRoster.teamOrder.length > 0 && (
          <div className="w-full flex flex-col gap-1">
            {teamRoster.teamOrder.map((tid, idx) => {
              const team = teamRoster.teams[tid];
              if (!team) return null;
              const members = (team.playerIds || [])
                .map((pid) => teamRoster.players[pid]?.name)
                .filter(Boolean) as string[];
              const isMyTeam = tid === identity.teamId;
              return (
                <div
                  key={tid}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                    isMyTeam ? "bg-white/15 font-semibold" : "bg-white/5 opacity-70"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PLAYER_COLORS[idx + 1] ?? "#888" }}
                  />
                  <span>{team.name}</span>
                  {members.length > 0 && (
                    <span className={`${isMyTeam ? "opacity-70" : "opacity-50"}`}>
                      — {members.join(", ")}
                    </span>
                  )}
                  {members.length === 0 && (
                    <span className="opacity-40 italic">empty</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="font-bold text-success">Room: {identity.roomCode}</p>
        <p className="text-sm opacity-70">
          {state.isTeamMode && identity.teamName
            ? `Playing as ${identity.playerName} · ${identity.teamName}`
            : `Playing as ${identity.playerName}`}
        </p>
        <div className="flex gap-2">
          <TextureButton variant="danger" onClick={handleLeave}>
            Leave Room
          </TextureButton>
          <TextureButton variant="danger" onClick={handleReset}>
            Reset Game
          </TextureButton>
        </div>
      </div>
    );
  }

  // ── Create / Join form ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40"
          placeholder="Your Name"
          value={playerNameInput}
          onChange={(e) => setPlayerNameInput(e.target.value)}
        />
        <TextureButton variant="primary" onClick={handleCreate}>
          Create Room
        </TextureButton>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isTeamModeChecked}
          onChange={(e) => setIsTeamModeChecked(e.target.checked)}
          className="h-4 w-4 accent-fuchsia-500"
        />
        Team Mode
        {isTeamModeChecked && (
          <input
            className="ml-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder-white/40"
            placeholder="Team name"
            value={teamNameInput}
            onChange={(e) => setTeamNameInput(e.target.value)}
          />
        )}
      </label>

      {createdRoomCode && (
        <p className="font-bold text-success">Room Code: {createdRoomCode}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40"
          placeholder="Room Code"
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value)}
        />
        <TextureButton onClick={handleJoin}>Join</TextureButton>
      </div>
    </div>
  );
}
