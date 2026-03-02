import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame, useGameDispatch } from "../../context/GameContext";
import LocalControls from "../controls/LocalControls";
import OnlineControls from "../controls/OnlineControls";
import SettingsMenu from "../controls/SettingsMenu";
import CategorySelector from "../controls/CategorySelector";
import BoardBuilderPanel from "../builder/BoardBuilderPanel";
import { TextureButton } from "../ui/TextureButton";

type Section = "local" | "online" | "categories" | "board";

export default function BottomPanel() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const gameStarted = state.players.some((p) => p.position > 0);

  const [openSection, setOpenSection] = useState<Section | null>(
    state.gameMode as Section
  );

  // Keep panel in sync when mode changes externally (e.g. Firebase reconnect)
  useEffect(() => {
    setOpenSection(state.gameMode as Section);
  }, [state.gameMode]);

  function handleSectionChange(next: Section | null) {
    if (openSection === "board" && next !== "board") {
      dispatch({ type: "SET_BOARD_PREVIEW_CONFIG", config: null });
    }
    setOpenSection(next);
  }

  function handleModeClick(mode: "local" | "online") {
    if (state.gameMode !== mode) {
      dispatch({ type: "SET_GAME_MODE", mode });
      handleSectionChange(mode);
    } else if (openSection === mode) {
      handleSectionChange(null);
    } else {
      handleSectionChange(mode);
    }
  }

  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      {/* Button row */}
      <div className="flex flex-wrap justify-center gap-2">
        <TextureButton
          size="sm"
          variant={state.gameMode === "local" ? "primary" : "default"}
          onClick={() => handleModeClick("local")}
        >
          Local
        </TextureButton>
        <TextureButton
          size="sm"
          variant={state.gameMode === "online" ? "primary" : "default"}
          onClick={() => handleModeClick("online")}
        >
          Online
        </TextureButton>
        {state.gameMode === "local" && (
          <TextureButton
            size="sm"
            variant={openSection === "categories" ? "primary" : "default"}
            onClick={() =>
              handleSectionChange(openSection === "categories" ? null : "categories")
            }
          >
            Categories
          </TextureButton>
        )}
        <TextureButton
          size="sm"
          variant={state.customBoardConfig !== null ? "primary" : openSection === "board" ? "primary" : "default"}
          onClick={() => handleSectionChange(openSection === "board" ? null : "board")}
        >
          Board
        </TextureButton>
        <SettingsMenu />
      </div>

      {/* Collapsible sections */}
      <AnimatePresence initial={false}>
        {openSection === "local" && state.gameMode === "local" && (
          <motion.div
            key="local"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden w-full flex justify-center"
          >
            <div className="py-1">
              <LocalControls />
            </div>
          </motion.div>
        )}

        {openSection === "online" && state.gameMode === "online" && (
          <motion.div
            key="online"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden w-full flex justify-center"
          >
            <div className="py-1">
              <OnlineControls />
            </div>
          </motion.div>
        )}

        {openSection === "categories" && state.gameMode === "local" && (
          <motion.div
            key="categories"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden w-full flex justify-center"
          >
            <div className="py-1">
              <CategorySelector
                value={state.activeCategories}
                onChange={(cats) =>
                  dispatch({ type: "SET_ACTIVE_CATEGORIES", categories: cats })
                }
                locked={gameStarted}
              />
            </div>
          </motion.div>
        )}

        {openSection === "board" && (
          <motion.div
            key="board"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden w-full flex justify-center"
          >
            <div className="py-1 w-full max-w-lg px-2">
              <BoardBuilderPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
