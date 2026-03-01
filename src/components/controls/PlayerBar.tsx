import { useState, useRef, useEffect } from "react";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { PLAYER_COLORS, PLAYER_COLOR_OPTIONS } from "../../lib/constants";

export default function PlayerBar() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const activePlayer = state.players[state.currentPlayerIndex];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [colorPickerId, setColorPickerId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Close colour picker on outside click
  useEffect(() => {
    if (colorPickerId === null) return;
    function handleOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColorPickerId(null);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [colorPickerId]);

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
    <div className="relative z-10 flex flex-wrap justify-center gap-2 my-1.5">
      {state.players.map((player) => (
        <div
          key={player.id}
          className={`relative flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-xs transition-all duration-200 ${
            player.id === activePlayer?.id
              ? "scale-105 outline outline-2 outline-white"
              : ""
          }`}
        >
          {/* Colour dot — click to open picker */}
          <button
            className="h-3 w-3 rounded-full flex-shrink-0 hover:ring-2 hover:ring-white/60 hover:ring-offset-1"
            style={{ backgroundColor: player.color ?? PLAYER_COLORS[player.id] }}
            onClick={(e) => {
              e.stopPropagation();
              setColorPickerId(colorPickerId === player.id ? null : player.id);
            }}
            aria-label="Change colour"
          />

          {/* Colour picker popover */}
          {colorPickerId === player.id && (
            <div
              ref={pickerRef}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 grid gap-1.5 rounded-lg bg-surface p-2 shadow-xl"
              style={{ gridTemplateColumns: "repeat(6, 1.5rem)" }}
            >
              {PLAYER_COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    outline:
                      (player.color ?? PLAYER_COLORS[player.id]) === color
                        ? "2px solid white"
                        : "none",
                    outlineOffset: "2px",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "SET_PLAYER_COLOR", playerId: player.id, color });
                    setColorPickerId(null);
                  }}
                  aria-label={color}
                />
              ))}
            </div>
          )}

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
              className="bg-transparent outline-none border-b border-white/50 text-white w-20 text-xs"
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
