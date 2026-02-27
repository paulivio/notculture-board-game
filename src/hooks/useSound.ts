import { useRef, useCallback, useEffect } from "react";
import { useSoundSettings } from "../context/SoundContext";

type SoundName = "dice" | "move" | "correct" | "wrong";

type AudioContextClass = typeof AudioContext;

const base = import.meta.env.BASE_URL;
const SOUND_PATHS: Record<SoundName, string> = {
  dice: `${base}assets/sounds/dice.mp3`,
  move: `${base}assets/sounds/move.mp3`,
  correct: `${base}assets/sounds/correct.mp3`,
  wrong: `${base}assets/sounds/wrong.mp3`,
};

const SOUND_GAIN: Record<SoundName, number> = {
  dice: 1,
  move: 1,
  correct: 1,
  wrong: 0.6,
};

function createAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.load();
  return audio;
}

export function useSound() {
  const { volume, muted } = useSoundSettings();
  const soundsRef = useRef<Record<SoundName, HTMLAudioElement> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);

  useEffect(() => {
    volumeRef.current = volume;
    mutedRef.current = muted;
  }, [volume, muted]);

  if (!soundsRef.current) {
    soundsRef.current = {
      dice: createAudio(SOUND_PATHS.dice),
      move: createAudio(SOUND_PATHS.move),
      correct: createAudio(SOUND_PATHS.correct),
      wrong: createAudio(SOUND_PATHS.wrong),
    };
  }

  const playSound = useCallback((name: SoundName) => {
    if (mutedRef.current) return;
    const sound = soundsRef.current?.[name];
    if (!sound) return;
    sound.currentTime = 0;
    sound.volume = volumeRef.current * SOUND_GAIN[name];
    sound.play().catch(() => {});
  }, []);

  const playTick = useCallback(() => {
    if (mutedRef.current) return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextClass }).webkitAudioContext);
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const vol = volumeRef.current;

      // Descending-pitch oscillator — the "thud" body of the peg strike
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(550, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
      oscGain.gain.setValueAtTime(0.45 * vol, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);

      // Short noise burst — the sharp "snap" of contact
      const bufSize = Math.ceil(ctx.sampleRate * 0.018);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.frequency.value = 1800;
      bpf.Q.value = 2;
      const noiseGain = ctx.createGain();
      noise.connect(bpf);
      bpf.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseGain.gain.setValueAtTime(0.18 * vol, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
      noise.start(now);
      noise.stop(now + 0.018);
    } catch {}
  }, []);

  return { playSound, playTick };
}
