import { createContext, useContext, useState } from "react";
import type { TileType } from "../types/game";

interface BuilderContextValue {
  selectedTileType: TileType | null;
  setSelectedTileType: (type: TileType | null) => void;
}

const BuilderContext = createContext<BuilderContextValue>({
  selectedTileType: null,
  setSelectedTileType: () => {},
});

export function BuilderProvider({ children }: { children: React.ReactNode }) {
  const [selectedTileType, setSelectedTileType] = useState<TileType | null>(null);
  return (
    <BuilderContext.Provider value={{ selectedTileType, setSelectedTileType }}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder() {
  return useContext(BuilderContext);
}
