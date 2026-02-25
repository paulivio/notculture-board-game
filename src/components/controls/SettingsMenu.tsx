import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { useOnline } from "../../context/OnlineContext";
import { resetRoom } from "../../firebase/roomService";
import { TextureButton } from "../ui/TextureButton";

export default function SettingsMenu() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { identity } = useOnline();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleRestart = () => {
    dispatch({ type: "SHOW_SETTINGS", show: false });
    if (state.gameMode === "online" && identity.roomCode) {
      resetRoom(identity.roomCode);
    } else {
      dispatch({ type: "RESET_GAME" });
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
            className="absolute right-0 top-full mt-1 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-surface p-2.5 z-20 min-w-[180px]"
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
            <TextureButton
              className="w-full justify-start"
              onClick={() => dispatch({ type: "TOGGLE_DEBUG" })}
            >
              Toggle Debug Mode
            </TextureButton>
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
