import { GameProvider } from "./context/GameContext";
import { OnlineProvider } from "./context/OnlineContext";
import { GameLogicProvider } from "./context/GameLogicContext";
import { SoundProvider } from "./context/SoundContext";
import { BuilderProvider } from "./context/BuilderContext";
import GameLayout from "./components/layout/GameLayout";

export default function App() {
  return (
    <SoundProvider>
      <GameProvider>
        <OnlineProvider>
          <GameLogicProvider>
            <BuilderProvider>
              <GameLayout />
            </BuilderProvider>
          </GameLogicProvider>
        </OnlineProvider>
      </GameProvider>
    </SoundProvider>
  );
}
