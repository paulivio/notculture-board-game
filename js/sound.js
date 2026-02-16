const sounds = {
  dice: createSound("assets/sounds/dice.mp3"),
  move: createSound("assets/sounds/move.mp3")
};

function createSound(src) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.load();
  return audio;
}

export function playSound(name) {
  const sound = sounds[name];
  if (!sound) return;

  sound.currentTime = 0;   // rewind instantly
  sound.play().catch(() => {});
}