import { useGame, useGameDispatch } from "../../context/GameContext";
import { TextureButton } from "../ui/TextureButton";
import CategorySelector from "./CategorySelector";

export default function LocalControls() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const gameStarted = state.players.some((p) => p.position > 0);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <TextureButton
          size="sm"
          onClick={() => dispatch({ type: "REMOVE_PLAYER" })}
          disabled={state.players.length <= state.minPlayers}
        >
          − Player
        </TextureButton>
        <span className="text-sm font-bold">
          {state.players.length} Player{state.players.length > 1 ? "s" : ""}
        </span>
        <TextureButton
          size="sm"
          onClick={() => dispatch({ type: "ADD_PLAYER" })}
          disabled={state.players.length >= state.maxPlayers}
        >
          + Player
        </TextureButton>
      </div>
      <CategorySelector
        value={state.activeCategories}
        onChange={(cats) =>
          dispatch({ type: "SET_ACTIVE_CATEGORIES", categories: cats })
        }
        locked={gameStarted}
      />
    </div>
  );
}
