import { createContext, useContext, useState, type ReactNode } from "react";

interface OnlineIdentity {
  roomCode: string | null;
  playerId: string | null;
  playerName: string | null;
  teamId: string | null;
  teamName: string | null;
}

interface OnlineContextValue {
  identity: OnlineIdentity;
  setIdentity: React.Dispatch<React.SetStateAction<OnlineIdentity>>;
}

const defaultIdentity: OnlineIdentity = {
  roomCode: null,
  playerId: null,
  playerName: null,
  teamId: null,
  teamName: null,
};

const OnlineContext = createContext<OnlineContextValue>({
  identity: defaultIdentity,
  setIdentity: () => {},
});

export function OnlineProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<OnlineIdentity>(defaultIdentity);

  return (
    <OnlineContext.Provider value={{ identity, setIdentity }}>
      {children}
    </OnlineContext.Provider>
  );
}

export function useOnline() {
  return useContext(OnlineContext);
}
