import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import { useOnline } from "../../context/OnlineContext";
import { useSoundSettings } from "../../context/SoundContext";
import { resetRoom } from "../../firebase/roomService";
import { TextureButton } from "../ui/TextureButton";
import { MAX_POSITION } from "../../lib/constants";

export default function SettingsMenu() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { triggerTileAt } = useGameLogicContext();
  const { identity } = useOnline();
  const { volume, muted, setVolume, setMuted } = useSoundSettings();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [teleportPlayerId, setTeleportPlayerId] = useState(1);
  const [teleportPos, setTeleportPos] = useState(10);

  const [showDebugPrompt, setShowDebugPrompt] = useState(false);
  const [debugPassword, setDebugPassword] = useState("");
  const [debugPasswordError, setDebugPasswordError] = useState(false);

  const handleRestart = () => {
    dispatch({ type: "SHOW_SETTINGS", show: false });
    if (state.gameMode === "online" && identity.roomCode) {
      resetRoom(identity.roomCode);
    } else {
      dispatch({ type: "RESET_GAME" });
    }
  };

  const handleDebugToggle = () => {
    if (state.debugMode) {
      // Disable without password
      dispatch({ type: "TOGGLE_DEBUG" });
    } else {
      // Enable requires password
      setShowDebugPrompt(true);
      setDebugPassword("");
      setDebugPasswordError(false);
    }
  };

  const handleDebugConfirm = () => {
    if (debugPassword === "paulive") {
      dispatch({ type: "TOGGLE_DEBUG" });
      setShowDebugPrompt(false);
      setDebugPassword("");
      setDebugPasswordError(false);
    } else {
      setDebugPasswordError(true);
    }
  };

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        dispatch({ type: "SHOW_SETTINGS", show: false });
      }
    }
    if (state.showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [state.showSettings, dispatch]);

  // Reset debug prompt when settings closes
  useEffect(() => {
    if (!state.showSettings) {
      setShowDebugPrompt(false);
      setDebugPassword("");
      setDebugPasswordError(false);
    }
  }, [state.showSettings]);

  return (
    <div ref={wrapperRef} className="relative z-10">
      <TextureButton
        onClick={() =>
          dispatch({ type: "SHOW_SETTINGS", show: !state.showSettings })
        }
      >
        ⚙ Settings
      </TextureButton>

      <AnimatePresence>
        {state.showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-surface p-2.5 z-20 min-w-[260px]"
          >
            <TextureButton
              className="w-full justify-start"
              onClick={() => {
                dispatch({ type: "SHOW_EDITOR", show: true });
                dispatch({ type: "SHOW_SETTINGS", show: false });
              }}
            >
              Add / Edit Questions
            </TextureButton>

            {/* Debug toggle with password protection */}
            <TextureButton
              className="w-full justify-start"
              onClick={handleDebugToggle}
            >
              Toggle Debug Mode
            </TextureButton>

            {showDebugPrompt && (
              <div className="flex flex-col gap-1.5">
                <input
                  type="password"
                  placeholder="Enter password"
                  value={debugPassword}
                  onChange={(e) => {
                    setDebugPassword(e.target.value);
                    setDebugPasswordError(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleDebugConfirm()}
                  className="w-full rounded-lg border border-white/10 bg-surface px-2 py-1 text-sm text-white placeholder-white/30"
                  autoFocus
                />
                {debugPasswordError && (
                  <p className="px-1 text-xs text-red-400">Incorrect password</p>
                )}
                <TextureButton className="w-full" onClick={handleDebugConfirm}>
                  Confirm
                </TextureButton>
              </div>
            )}

            {state.debugMode && (
              <>
                <hr className="border-white/10" />
                <p className="px-1 text-xs font-bold text-fuchsia-400">
                  Debug: Teleport
                </p>
                {state.players.length > 1 && (
                  <select
                    className="w-full rounded-lg border border-white/10 bg-surface px-2 py-1 text-sm text-white"
                    value={teleportPlayerId}
                    onChange={(e) => setTeleportPlayerId(Number(e.target.value))}
                  >
                    {state.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-1">
                  <input
                    type="number"
                    min={0}
                    max={MAX_POSITION}
                    className="w-full rounded-lg border border-white/10 bg-surface px-2 py-1 text-sm text-white"
                    value={teleportPos}
                    onChange={(e) =>
                      setTeleportPos(
                        Math.max(0, Math.min(MAX_POSITION, Number(e.target.value)))
                      )
                    }
                  />
                  <TextureButton
                    onClick={() => {
                      const playerId =
                        state.players.length === 1
                          ? state.players[0].id
                          : teleportPlayerId;
                      const playerIndex = state.players.findIndex(
                        (p) => p.id === playerId
                      );
                      dispatch({
                        type: "SET_PLAYER_POSITION",
                        playerId,
                        position: teleportPos,
                      });
                      if (playerIndex !== -1) {
                        dispatch({
                          type: "SYNC_ONLINE_STATE",
                          players: state.players.map((p) =>
                            p.id === playerId ? { ...p, position: teleportPos } : p
                          ),
                          currentPlayerIndex: playerIndex,
                        });
                      }
                      dispatch({ type: "SHOW_SETTINGS", show: false });
                      triggerTileAt(teleportPos);
                    }}
                  >
                    Go
                  </TextureButton>
                </div>
              </>
            )}

            {/* Sound section */}
            <hr className="border-white/10" />
            <p className="px-1 text-xs font-bold text-fuchsia-400">Sound</p>
            <div className="flex items-center gap-2 px-1">
              <span className="text-base">🔊</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="flex-1 accent-fuchsia-400"
              />
              <TextureButton onClick={() => setMuted(!muted)}>
                {muted ? "Unmute" : "Mute"}
              </TextureButton>
            </div>

            <hr className="border-white/10" />
            <TextureButton
              className="w-full justify-start"
              variant="danger"
              onClick={handleRestart}
            >
              Restart Game
            </TextureButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
