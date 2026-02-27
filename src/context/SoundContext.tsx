import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SoundSettings {
  volume: number;
  muted: boolean;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
}

const SoundContext = createContext<SoundSettings | null>(null);

const STORAGE_KEY = "notculture-sound";

export function SoundProvider({ children }: { children: ReactNode }) {
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).volume ?? 0.8;
    } catch {}
    return 0.8;
  });

  const [muted, setMutedState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).muted ?? false;
    } catch {}
    return false;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume, muted }));
    } catch {}
  }, [volume, muted]);

  const setVolume = (v: number) => setVolumeState(Math.max(0, Math.min(1, v)));
  const setMuted = (m: boolean) => setMutedState(m);

  return (
    <SoundContext.Provider value={{ volume, muted, setVolume, setMuted }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundSettings(): SoundSettings {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSoundSettings must be used within SoundProvider");
  return ctx;
}
