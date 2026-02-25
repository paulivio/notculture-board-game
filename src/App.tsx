import { GameProvider } from "./context/GameContext";
import { GameLogicProvider } from "./context/GameLogicContext";
import GameLayout from "./components/layout/GameLayout";

export default function App() {
  return (
    <GameProvider>
      <GameLogicProvider>
        <GameLayout />
      </GameLogicProvider>
    </GameProvider>
  );
}
