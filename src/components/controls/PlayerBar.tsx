import { useState, useRef, useEffect } from "react";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { PLAYER_COLORS } from "../../lib/constants";

export default function PlayerBar() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const activePlayer = state.players[state.currentPlayerIndex];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startEditing(playerId: number, currentName: string) {
    setEditingId(playerId);
    setEditValue(currentName);
  }

  function commitEdit() {
    if (editingId === null) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      dispatch({ type: "RENAME_PLAYER", playerId: editingId, name: trimmed });
    }
    setEditingId(null);
  }

  return (
    <div className="flex flex-wrap justify-center gap-3 my-2.5">
      {state.players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 text-sm transition-all duration-200 ${
            player.id === activePlayer?.id
              ? "scale-105 outline outline-2 outline-white"
              : ""
          }`}
        >
          <div
            className="h-3.5 w-3.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: PLAYER_COLORS[player.id] }}
          />
          {editingId === player.id ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditingId(null);
              }}
              className="bg-transparent outline-none border-b border-white/50 text-white w-20 text-sm"
              maxLength={16}
            />
          ) : (
            <span
              className="cursor-pointer hover:underline"
              onClick={() => startEditing(player.id, player.name)}
            >
              {player.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
