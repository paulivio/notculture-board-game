import { useGame } from "../../context/GameContext";
import ModeSelector from "../controls/ModeSelector";
import LocalControls from "../controls/LocalControls";
import OnlineControls from "../controls/OnlineControls";
import SettingsMenu from "../controls/SettingsMenu";

export default function BottomPanel() {
  const state = useGame();

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <ModeSelector />
      {state.gameMode === "local" ? <LocalControls /> : <OnlineControls />}
      <SettingsMenu />
    </div>
  );
}
