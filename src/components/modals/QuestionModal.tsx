import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import { useOnline } from "../../context/OnlineContext";
import { TextureCard } from "../ui/TextureCard";
import { TextureButton } from "../ui/TextureButton";
import {
  CATEGORY_LABELS,
  CATEGORY_TEXT_COLORS,
} from "../../lib/constants";

export default function QuestionModal() {
  const state = useGame();
  const { handleAnswer, afterAnswer, handleSkip } = useGameLogicContext();
  const { identity } = useOnline();
  const question = state.activeQuestion;

  // In team mode online, only the designated answerer can submit
  const isAnswerer =
    state.isTeamMode && state.gameMode === "online"
      ? state.currentAnswererId === identity.playerId
      : true;
  const canSubmit = isAnswerer;

  const [localAnswered, setLocalAnswered] = useState(false);
  const [localSelectedIndex, setLocalSelectedIndex] = useState<number | null>(null);
  const [localWasCorrect, setLocalWasCorrect] = useState(false);
  const [localCorrectIdx, setLocalCorrectIdx] = useState(0);

  // In online mode, drive feedback from synced Firebase state
  const onlineResult = state.gameMode === "online" ? state.answerResult : null;
  const answered = onlineResult ? true : localAnswered;
  const selectedIndex = onlineResult ? onlineResult.selectedIndex : localSelectedIndex;
  const wasCorrect = onlineResult ? onlineResult.wasCorrect : localWasCorrect;
  const correctIdx = onlineResult ? onlineResult.correctIndex : localCorrectIdx;

  if (!question) return null;

  const difficultyStars =
    "\u2605".repeat(question.difficulty) +
    "\u2606".repeat(6 - question.difficulty);

  const onAnswer = (index: number) => {
    if (answered || !canSubmit) return;

    const result = handleAnswer(index);
    if (!result) return;

    setLocalAnswered(true);
    setLocalSelectedIndex(index);
    setLocalWasCorrect(result.correct);
    setLocalCorrectIdx(result.correctIndex);

    setTimeout(() => {
      afterAnswer(result.correct);
    }, 2000);
  };

  const getButtonClass = (index: number) => {
    if (!answered) return "";
    if (index === selectedIndex && wasCorrect)
      return "!bg-success !text-white !border-success";
    if (index === selectedIndex && !wasCorrect)
      return "!bg-error !text-white !border-error";
    if (index === correctIdx && !wasCorrect)
      return "!bg-success !text-white !border-success";
    return "opacity-50";
  };

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
        >
          <TextureCard className="w-[320px]">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide">
              <span className={CATEGORY_TEXT_COLORS[question.category]}>
                {CATEGORY_LABELS[question.category]}
              </span>
              <span className="text-base tracking-wider">
                {difficultyStars}
              </span>
            </div>

            <h2 className="mb-4 text-lg font-bold">{question.question}</h2>

            <div className="flex flex-col gap-2">
              {question.answers.map((answer, index) => (
                <TextureButton
                  key={index}
                  className={getButtonClass(index)}
                  onClick={() => onAnswer(index)}
                  disabled={answered || !canSubmit}
                >
                  {answer}
                </TextureButton>
              ))}
            </div>

            {!canSubmit && !answered && (
              <p className="mt-2 text-center text-xs opacity-50">
                {state.isTeamMode ? "Waiting for your teammate to answer…" : ""}
              </p>
            )}

            {answered && (
              <p
                className={`mt-3 text-center text-lg font-bold ${
                  wasCorrect ? "text-success" : "text-error"
                }`}
              >
                {wasCorrect ? "Correct!" : "Incorrect"}
              </p>
            )}

            {state.debugMode && !answered && (
              <TextureButton
                variant="danger"
                className="mt-3 w-full"
                onClick={handleSkip}
              >
                Skip (Debug)
              </TextureButton>
            )}
          </TextureCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
