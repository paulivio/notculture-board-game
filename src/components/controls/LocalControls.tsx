import { useGame, useGameDispatch } from "../../context/GameContext";
import { TextureButton } from "../ui/TextureButton";

export default function LocalControls() {
  const state = useGame();
  const dispatch = useGameDispatch();

  return (
    <div className="flex items-center gap-4">
      <TextureButton
        onClick={() => dispatch({ type: "REMOVE_PLAYER" })}
        disabled={state.players.length <= state.minPlayers}
      >
        − Player
      </TextureButton>
      <span className="font-bold">
        {state.players.length} Player{state.players.length > 1 ? "s" : ""}
      </span>
      <TextureButton
        onClick={() => dispatch({ type: "ADD_PLAYER" })}
        disabled={state.players.length >= state.maxPlayers}
      >
        + Player
      </TextureButton>
    </div>
  );
}
