import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import { useOnline } from "../../context/OnlineContext";
import { TextureCard } from "../ui/TextureCard";
import { TextureButton } from "../ui/TextureButton";
import { NOT_TIMER_SECONDS } from "../../lib/constants";
import { startNotTimer, submitNotScore } from "../../firebase/roomService";
import { useSound } from "../../hooks/useSound";

export default function NotModal() {
  const state = useGame();
  const { handleNotScore } = useGameLogicContext();
  const { identity } = useOnline();
  const { playTick } = useSound();

  const [localPhase, setLocalPhase] = useState<"waiting" | "timer">("waiting");
  const [timeLeft, setTimeLeft] = useState(NOT_TIMER_SECONDS);
  const [checked, setChecked] = useState<boolean[]>(new Array(6).fill(false));
  const [localScore, setLocalScore] = useState<number | null>(null);
  const localIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onlineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activePlayer = state.players[state.currentPlayerIndex];
  const card = state.currentNotCard;

  const isOnlineActive =
    state.gameMode === "online" &&
    identity.playerName !== null &&
    activePlayer?.name === identity.playerName;

  const phase =
    state.gameMode === "online"
      ? state.notTimerStartedAt
        ? "timer"
        : "waiting"
      : localPhase;

  const score = checked.filter(Boolean).length;
  const timerDone = phase === "timer" && timeLeft === 0;

  const scoreResult = state.gameMode === "online" ? state.notScore : localScore;
  const showResult = scoreResult !== null;

  const toggleAnswer = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  // Local-mode countdown
  useEffect(() => {
    if (state.gameMode === "online" || localPhase !== "timer") return;

    localIntervalRef.current = setInterval(() => {
      playTick();
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(localIntervalRef.current!);
          localIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(localIntervalRef.current!);
      localIntervalRef.current = null;
    };
  }, [localPhase, state.gameMode, playTick]);

  // Online-mode countdown — derived from shared Firebase timestamp
  useEffect(() => {
    if (state.gameMode !== "online" || !state.notTimerStartedAt) return;

    const update = () => {
      const elapsed = Math.floor((Date.now() - state.notTimerStartedAt!) / 1000);
      const tl = Math.max(0, NOT_TIMER_SECONDS - elapsed);
      if (tl > 0) playTick();
      setTimeLeft(tl);
    };

    update();
    onlineIntervalRef.current = setInterval(update, 1000);
    return () => {
      clearInterval(onlineIntervalRef.current!);
      onlineIntervalRef.current = null;
    };
  }, [state.notTimerStartedAt, state.gameMode, playTick]);

  // Reset checkboxes when a fresh timer starts (online)
  useEffect(() => {
    if (state.gameMode === "online" && state.notTimerStartedAt) {
      setChecked(new Array(6).fill(false));
    }
  }, [state.notTimerStartedAt, state.gameMode]);

  const handleStartTimer = () => {
    if (state.gameMode === "online" && identity.roomCode) {
      startNotTimer(identity.roomCode);
    } else {
      setTimeLeft(NOT_TIMER_SECONDS);
      setChecked(new Array(6).fill(false));
      setLocalPhase("timer");
    }
  };

  const handleSubmit = () => {
    if (state.gameMode === "online" && identity.roomCode) {
      submitNotScore(identity.roomCode, score);
    } else {
      setLocalScore(score);
    }
  };

  const handleContinue = () => {
    handleNotScore(scoreResult!);
  };

  const handleFinish = () => {
    clearInterval(localIntervalRef.current!);
    localIntervalRef.current = null;
    clearInterval(onlineIntervalRef.current!);
    onlineIntervalRef.current = null;
    setTimeLeft(0);
  };

  if (!activePlayer || !card) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-[340px] max-w-[95vw]"
        >
          <TextureCard className="max-h-[85vh] overflow-y-auto">
            <h2 className="mb-4 text-center text-xl font-bold text-amber-400">
              ✦ Not Tile!
            </h2>

            {/* ── Result screen ── */}
            {showResult ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-4xl font-bold text-amber-400">
                  {scoreResult} / 6
                </p>
                <p className="text-center text-base font-semibold">
                  {activePlayer.name} guessed{" "}
                  <span className="text-amber-400">{scoreResult}</span>!
                </p>
                <p className="text-center text-sm opacity-60">
                  {scoreResult! > 0
                    ? `Moving forward ${scoreResult} space${scoreResult === 1 ? "" : "s"}…`
                    : "No spaces gained."}
                </p>
                {(isOnlineActive || state.gameMode === "local") && (
                  <TextureButton variant="primary" onClick={handleContinue}>
                    Continue
                  </TextureButton>
                )}
              </div>
            ) : isOnlineActive ? (
              /* ── Active player (online): guess view ── */
              <div className="flex flex-col items-center gap-4">
                {phase === "waiting" ? (
                  <>
                    <p className="text-center text-sm opacity-80">
                      Your teammates are about to describe 6 things — get ready to guess!
                    </p>
                    <p className="text-center text-xs opacity-60">
                      Waiting for the timer to start…
                    </p>
                  </>
                ) : null}
                {phase === "timer" && (
                  <>
                    {timeLeft > 0 ? (
                      <>
                        <p className="text-5xl font-bold text-amber-400">
                          Guess!
                        </p>
                        <div className="text-6xl font-bold text-white">
                          {timeLeft}
                        </div>
                        <p className="text-center text-xs opacity-60">
                          seconds remaining
                        </p>
                      </>
                    ) : (
                      <p className="text-center text-lg font-bold text-amber-400">
                        Time's up!
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : phase === "waiting" ? (
              /* ── Inactive players / local — waiting phase ── */
              <div className="flex flex-col items-center gap-4">
                <p className="text-center text-sm opacity-80">
                  Describe these 6 things to{" "}
                  <strong>{activePlayer.name}</strong> — without saying the word!
                  <br />
                  Start the timer when ready.
                </p>
                <ol className="w-full flex flex-col gap-1">
                  {card.answers.map((answer, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                    >
                      <span className="w-5 shrink-0 text-center font-bold text-amber-400">
                        {i + 1}
                      </span>
                      <span>{answer}</span>
                    </li>
                  ))}
                </ol>
                <TextureButton onClick={handleStartTimer}>
                  Start Timer
                </TextureButton>
              </div>
            ) : (
              /* ── Inactive players / local — timer phase ── */
              <div className="flex flex-col gap-3">
                <p className="text-center text-xs opacity-60">
                  Tick answers as{" "}
                  <strong className="opacity-100">{activePlayer.name}</strong>{" "}
                  guesses them
                </p>

                {/* Countdown */}
                <div className="flex items-center justify-center gap-2">
                  {timeLeft > 0 ? (
                    <>
                      <span className="text-4xl font-bold text-amber-400">
                        {timeLeft}
                      </span>
                      <span className="text-xs opacity-60">sec</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-amber-400">
                      Time's up!
                    </span>
                  )}
                </div>

                {timeLeft > 0 && (
                  <TextureButton className="w-full" onClick={handleFinish}>
                    Finish Early
                  </TextureButton>
                )}

                {/* Answer list */}
                <ol className="flex flex-col gap-1">
                  {card.answers.map((answer, i) => (
                    <li key={i}>
                      <button
                        onClick={() => toggleAnswer(i)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          checked[i]
                            ? "bg-amber-500 text-white"
                            : "bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <span className="w-5 shrink-0 text-center font-bold">
                          {checked[i] ? "✓" : String(i + 1)}
                        </span>
                        <span>{answer}</span>
                      </button>
                    </li>
                  ))}
                </ol>

                {/* Submit — only once timer has ended */}
                {timerDone && (
                  <TextureButton variant="primary" onClick={handleSubmit}>
                    Submit Score: {score} / 6
                  </TextureButton>
                )}
              </div>
            )}
          </TextureCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
