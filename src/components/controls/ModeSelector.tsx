import { useGame, useGameDispatch } from "../../context/GameContext";
import { TextureButton } from "../ui/TextureButton";

export default function ModeSelector() {
  const state = useGame();
  const dispatch = useGameDispatch();

  return (
    <div className="flex gap-2">
      <TextureButton
        variant={state.gameMode === "local" ? "primary" : "default"}
        onClick={() => dispatch({ type: "SET_GAME_MODE", mode: "local" })}
      >
        Local Game
      </TextureButton>
      <TextureButton
        variant={state.gameMode === "online" ? "primary" : "default"}
        onClick={() => dispatch({ type: "SET_GAME_MODE", mode: "online" })}
      >
        Online Game
      </TextureButton>
    </div>
  );
}
