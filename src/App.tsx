import { GameProvider } from "./context/GameContext";
import { OnlineProvider } from "./context/OnlineContext";
import { GameLogicProvider } from "./context/GameLogicContext";
import GameLayout from "./components/layout/GameLayout";

export default function App() {
  return (
    <GameProvider>
      <OnlineProvider>
        <GameLogicProvider>
          <GameLayout />
        </GameLogicProvider>
      </OnlineProvider>
    </GameProvider>
  );
}
