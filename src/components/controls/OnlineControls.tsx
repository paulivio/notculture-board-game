import { useState, useEffect } from "react";
import { TextureButton } from "../ui/TextureButton";
import { createRoom, joinRoom, leaveRoom } from "../../firebase/roomService";

interface OnlineIdentityState {
  roomCode: string | null;
  playerId: string | null;
  playerName: string | null;
}

export default function OnlineControls() {
  const [identity, setIdentity] = useState<OnlineIdentityState>({
    roomCode: null,
    playerId: null,
    playerName: null,
  });
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);

  // Reconnect from localStorage
  useEffect(() => {
    const savedRoom = localStorage.getItem("notculture_roomCode");
    const savedId = localStorage.getItem("notculture_playerId");
    const savedName = localStorage.getItem("notculture_playerName");

    if (savedRoom && savedId && savedName) {
      joinRoom(savedRoom, savedName, savedId).then((result) => {
        if (result) {
          setIdentity({
            roomCode: savedRoom,
            playerId: result.playerId,
            playerName: savedName,
          });
        }
      });
    }
  }, []);

  const handleCreate = async () => {
    const name = playerNameInput.trim();
    if (!name) {
      alert("Enter your name first.");
      return;
    }

    const { roomCode, playerId } = await createRoom(name);

    localStorage.setItem("notculture_roomCode", roomCode);
    localStorage.setItem("notculture_playerId", playerId);
    localStorage.setItem("notculture_playerName", name);

    setIdentity({ roomCode, playerId, playerName: name });
    setCreatedRoomCode(roomCode);
  };

  const handleJoin = async () => {
    const code = roomCodeInput.trim().toUpperCase();
    const name = playerNameInput.trim();

    if (!code || !name) {
      alert("Enter room code and name.");
      return;
    }

    const result = await joinRoom(code, name);
    if (!result) {
      alert("Room does not exist.");
      return;
    }

    localStorage.setItem("notculture_roomCode", code);
    localStorage.setItem("notculture_playerId", result.playerId);
    localStorage.setItem("notculture_playerName", name);

    setIdentity({ roomCode: code, playerId: result.playerId, playerName: name });
  };

  const handleLeave = async () => {
    if (identity.roomCode && identity.playerId) {
      await leaveRoom(identity.roomCode, identity.playerId);
    }
    localStorage.removeItem("notculture_roomCode");
    localStorage.removeItem("notculture_playerId");
    localStorage.removeItem("notculture_playerName");
    setIdentity({ roomCode: null, playerId: null, playerName: null });
    setCreatedRoomCode(null);
  };

  if (identity.roomCode) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="font-bold text-success">
          Room: {identity.roomCode}
        </p>
        <p className="text-sm opacity-70">Playing as {identity.playerName}</p>
        <TextureButton variant="danger" onClick={handleLeave}>
          Leave Room
        </TextureButton>
      </div>
    );
  }

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
