import { useRef, useCallback } from "react";

type SoundName = "dice" | "move" | "correct" | "wrong";

const base = import.meta.env.BASE_URL;
const SOUND_PATHS: Record<SoundName, string> = {
  dice: `${base}assets/sounds/dice.mp3`,
  move: `${base}assets/sounds/move.mp3`,
  correct: `${base}assets/sounds/correct.mp3`,
  wrong: `${base}assets/sounds/wrong.mp3`,
};

function createAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.load();
  return audio;
}

export function useSound() {
  const soundsRef = useRef<Record<SoundName, HTMLAudioElement> | null>(null);

  if (!soundsRef.current) {
    soundsRef.current = {
      dice: createAudio(SOUND_PATHS.dice),
      move: createAudio(SOUND_PATHS.move),
      correct: createAudio(SOUND_PATHS.correct),
      wrong: createAudio(SOUND_PATHS.wrong),
    };
  }

  const playSound = useCallback((name: SoundName) => {
    const sound = soundsRef.current?.[name];
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }, []);

  return { playSound };
}
