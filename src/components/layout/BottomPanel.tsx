import { useGame, useGameDispatch } from "../../context/GameContext";
import ModeSelector from "../controls/ModeSelector";
import LocalControls from "../controls/LocalControls";
import OnlineControls from "../controls/OnlineControls";
import SettingsMenu from "../controls/SettingsMenu";
import CategorySelector from "../controls/CategorySelector";

export default function BottomPanel() {
  const state = useGame();
  const dispatch = useGameDispatch();

  const gameStarted = state.players.some((p) => p.position > 0);

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <ModeSelector />
      {state.gameMode === "local" ? <LocalControls /> : <OnlineControls />}
      {state.gameMode === "local" && (
        <CategorySelector
          value={state.activeCategories}
          onChange={(cats) => dispatch({ type: "SET_ACTIVE_CATEGORIES", categories: cats })}
          locked={gameStarted}
        />
      )}
      <SettingsMenu />
    </div>
  );
}
