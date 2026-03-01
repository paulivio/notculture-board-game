import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import { useOnline } from "../../context/OnlineContext";
import { TextureCard } from "../ui/TextureCard";
import { TextureButton } from "../ui/TextureButton";
import { CULTURE_TIMER_SECONDS } from "../../lib/constants";
import { startCultureTimer, submitCultureScore, finishCultureTimerEarly } from "../../firebase/roomService";
import { useSound } from "../../hooks/useSound";
import cultureData from "../../data/culture.json";

interface CultureQuestion {
  id: string;
  question: string;
  answers: string[];
}

export default function CultureModal() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { handleCultureScore } = useGameLogicContext();
  const { identity } = useOnline();
  const { playTick, playSound } = useSound();

  // Local-mode phase tracking (online derives phase from state.cultureTimerStartedAt)
  const [localPhase, setLocalPhase] = useState<"waiting" | "timer">("waiting");
  const [timeLeft, setTimeLeft] = useState(CULTURE_TIMER_SECONDS);
  const [checked, setChecked] = useState<boolean[]>(new Array(10).fill(false));
  // Local-mode score result (online uses state.cultureScore)
  const [localScore, setLocalScore] = useState<number | null>(null);
  const localIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onlineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activePlayer = state.players[state.currentPlayerIndex];

  const isOnlineActive =
    state.gameMode === "online" &&
    identity.playerName !== null &&
    activePlayer?.name === identity.playerName;

  // Team mode role derivation.
  // For Culture tiles: BOTH active team members perform together; opposing teams judge.
  const isAnswerer =
    state.isTeamMode && state.gameMode === "online"
      ? state.currentAnswererId === identity.playerId
      : false;

  // isOnActiveTeam: player belongs to the currently active team.
  // Using teamId comparison is more robust than matching currentDescriberId (which can be null).
  const isOnActiveTeam =
    state.isTeamMode &&
    state.gameMode === "online" &&
    identity.teamId !== null &&
    identity.teamId === state.activeTeamId;

  // Performer view: active team members in team mode; active player otherwise
  const isPerformer =
    state.isTeamMode && state.gameMode === "online" ? isOnActiveTeam : isOnlineActive;

  // Who can submit score: opposing teams in team mode; non-active player (judge) otherwise or local
  const canSubmitScore =
    state.isTeamMode && state.gameMode === "online"
      ? !isOnActiveTeam
      : !isOnlineActive || state.gameMode === "local";

  // Who can start the timer: opposing teams in team mode; non-active player (judge) otherwise
  const canStartTimer =
    state.isTeamMode && state.gameMode === "online"
      ? !isOnActiveTeam
      : !isOnlineActive || state.gameMode === "local";

  // Who can click Continue on result screen: answerer only (triggers movement); active player/local otherwise
  const canContinue =
    state.isTeamMode && state.gameMode === "online"
      ? isAnswerer
      : isOnlineActive || state.gameMode === "local";

  const questions = cultureData as CultureQuestion[];
  const localSeed =
    state.currentPlayerIndex +
    (state.players[state.currentPlayerIndex]?.position ?? 0);
  const questionIndex =
    state.gameMode === "online" && state.cultureQuestionIndex !== null
      ? state.cultureQuestionIndex
      : localSeed % questions.length;
  const question = questions[questionIndex];

  // Derive phase: online clients use the Firebase-synced timestamp; local uses local state
  const phase =
    state.gameMode === "online"
      ? state.cultureTimerStartedAt
        ? "timer"
        : "waiting"
      : localPhase;

  const score = checked.filter(Boolean).length;
  const timerDone = phase === "timer" && timeLeft === 0;

  // Score result: online reads from game state (set for all clients by hooks.ts), local from local state
  const scoreResult =
    state.gameMode === "online" ? state.cultureScore : localScore;
  const showResult = scoreResult !== null;

  const toggleAnswer = (i: number) => {
    if (!canSubmitScore) return;
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

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

  // Online-mode countdown — derived from the shared Firebase timestamp so all clients stay in sync
  useEffect(() => {
    if (state.gameMode !== "online" || !state.cultureTimerStartedAt) return;

    const update = () => {
      const elapsed = Math.floor((Date.now() - state.cultureTimerStartedAt!) / 1000);
      const tl = Math.max(0, CULTURE_TIMER_SECONDS - elapsed);
      if (tl > 0) playTick();
      setTimeLeft(tl);
    };

    update();
    onlineIntervalRef.current = setInterval(update, 1000);
    return () => {
      clearInterval(onlineIntervalRef.current!);
      onlineIntervalRef.current = null;
    };
  }, [state.cultureTimerStartedAt, state.gameMode, playTick]);

  // Reset checkboxes when a genuinely fresh timer starts (online).
  // A backdated finish-early signal has elapsed >> CULTURE_TIMER_SECONDS so we skip it.
  useEffect(() => {
    if (state.gameMode === "online" && state.cultureTimerStartedAt) {
      const elapsed = Date.now() - state.cultureTimerStartedAt;
      if (elapsed < 5000) {
        setChecked(new Array(10).fill(false));
      }
    }
  }, [state.cultureTimerStartedAt, state.gameMode]);

  // Play result sound when score is revealed
  useEffect(() => {
    if (scoreResult === null) return;
    playSound(scoreResult > 0 ? "correct" : "wrong");
  }, [scoreResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartTimer = () => {
    if (!canStartTimer) return;
    if (state.gameMode === "online" && identity.roomCode) {
      startCultureTimer(identity.roomCode);
    } else {
      setTimeLeft(CULTURE_TIMER_SECONDS);
      setChecked(new Array(10).fill(false));
      setLocalPhase("timer");
    }
  };

  const handleSubmit = () => {
    if (!canSubmitScore) return;
    if (state.gameMode === "online" && identity.roomCode) {
      submitCultureScore(identity.roomCode, score);
    } else {
      setLocalScore(score);
    }
  };

  const handleContinue = () => {
    handleCultureScore(scoreResult!);
  };

  const handleFinish = () => {
    if (!canStartTimer) return;
    clearInterval(localIntervalRef.current!);
    localIntervalRef.current = null;
    clearInterval(onlineIntervalRef.current!);
    onlineIntervalRef.current = null;
    setTimeLeft(0);
    if (state.gameMode === "online" && identity.roomCode) {
      finishCultureTimerEarly(identity.roomCode);
    }
  };

  if (!activePlayer || !question) return null;

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
            <h2 className="mb-4 text-center text-xl font-bold text-fuchsia-400">
              ★ Culture Tile!
            </h2>

            {/* ── Result screen — shown to all clients once score is known ── */}
            {showResult ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-4xl font-bold text-fuchsia-400">
                  {scoreResult} / 10
                </p>
                <p className="text-center text-base font-semibold">
                  {activePlayer.name} scored{" "}
                  <span className="text-fuchsia-400">{scoreResult}</span>!
                </p>
                <p className="text-center text-sm opacity-60">
                  {scoreResult! > 0
                    ? `Moving forward ${scoreResult} space${scoreResult === 1 ? "" : "s"}…`
                    : "No spaces gained."}
                </p>
                {/* Only the performer (online) or the local player can trigger movement */}
                {canContinue && (
                  <TextureButton variant="primary" onClick={handleContinue}>
                    Continue
                  </TextureButton>
                )}
              </div>
            ) : isPerformer ? (
              /* ── Performer view: active team members (both) see the task; opposing teams judge ── */
              <div className="flex flex-col items-center gap-4">
                <p className="text-center text-sm opacity-80">
                  {state.isTeamMode
                    ? "Your team has landed on a Culture tile — start reciting!"
                    : "You've landed on a Culture tile — start reciting!"}
                </p>
                <p className="text-center text-sm font-semibold">
                  {question.question}
                </p>
                {phase === "waiting" && (
                  <p className="text-center text-xs opacity-60">
                    Waiting for the judge to start the timer…
                  </p>
                )}
                {phase === "timer" && (
                  <>
                    {timeLeft > 0 ? (
                      <>
                        <div className="text-6xl font-bold text-fuchsia-400">
                          {timeLeft}
                        </div>
                        <p className="text-center text-xs opacity-60">
                          seconds remaining
                        </p>
                      </>
                    ) : (
                      <p className="text-center text-lg font-bold text-fuchsia-400">
                        Time's up!
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : phase === "waiting" ? (
              /* ── Judge / opposing teams — waiting phase ── */
              <div className="flex flex-col items-center gap-4">
                <p className="text-center text-sm opacity-80">
                  <strong>{activePlayer.name}</strong> is performing.
                  <br />
                  {canStartTimer
                    ? "Start the timer when they're ready."
                    : "Waiting for a judge to start the timer…"}
                </p>
                <p className="w-full rounded-lg bg-fuchsia-950/50 p-3 text-center text-sm font-semibold text-fuchsia-200">
                  {question.question}
                </p>
                {canStartTimer && (
                  <TextureButton onClick={handleStartTimer}>
                    Start Timer
                  </TextureButton>
                )}
              </div>
            ) : (
              /* ── Judge (opposing teams / local) — timer phase: answers + countdown + submit ── */
              <div className="flex flex-col gap-3">
                <p className="text-center text-xs opacity-60">
                  {canSubmitScore
                    ? `Tick answers as ${activePlayer.name} names them`
                    : `${activePlayer.name} is performing`}
                </p>

                <p className="rounded-lg bg-fuchsia-950/50 p-2 text-center text-xs font-semibold text-fuchsia-200">
                  {question.question}
                </p>

                {/* Countdown */}
                <div className="flex items-center justify-center gap-2">
                  {timeLeft > 0 ? (
                    <>
                      <span className="text-4xl font-bold text-fuchsia-400">
                        {timeLeft}
                      </span>
                      <span className="text-xs opacity-60">sec</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-fuchsia-400">
                      Time's up!
                    </span>
                  )}
                </div>

                {timeLeft > 0 && canStartTimer && (
                  <TextureButton className="w-full" onClick={handleFinish}>
                    Finish Early
                  </TextureButton>
                )}

                {/* Answer list */}
                <ol className="flex flex-col gap-1">
                  {question.answers.map((answer, i) => (
                    <li key={i}>
                      <button
                        onClick={() => toggleAnswer(i)}
                        disabled={!canSubmitScore}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          checked[i]
                            ? "bg-fuchsia-600 text-white"
                            : "bg-white/5 text-white/80 hover:bg-white/10"
                        } ${!canSubmitScore ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <span className="w-5 shrink-0 text-center font-bold">
                          {checked[i] ? "✓" : String(i + 1)}
                        </span>
                        <span>{answer}</span>
                      </button>
                    </li>
                  ))}
                </ol>

                {/* Submit — only once timer has ended; gated by role */}
                {timerDone && canSubmitScore && (
                  <TextureButton variant="primary" onClick={handleSubmit}>
                    Submit Score: {score} / 10
                  </TextureButton>
                )}
                {timerDone && !canSubmitScore && (
                  <p className="text-center text-xs opacity-50">Waiting for score to be submitted…</p>
                )}
              </div>
            )}
          </TextureCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
