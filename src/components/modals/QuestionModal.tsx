import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../context/GameContext";
import { useGameLogicContext } from "../../context/GameLogicContext";
import { TextureCard } from "../ui/TextureCard";
import { TextureButton } from "../ui/TextureButton";
import {
  CATEGORY_LABELS,
  CATEGORY_TEXT_COLORS,
} from "../../lib/constants";

export default function QuestionModal() {
  const state = useGame();
  const { handleAnswer, afterAnswer, handleSkip } = useGameLogicContext();
  const question = state.activeQuestion;

  const [answered, setAnswered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [correctIdx, setCorrectIdx] = useState(0);

  if (!question) return null;

  const difficultyStars =
    "\u2605".repeat(question.difficulty) +
    "\u2606".repeat(6 - question.difficulty);

  const onAnswer = (index: number) => {
    if (answered) return;

    const result = handleAnswer(index);
    if (!result) return;

    setAnswered(true);
    setSelectedIndex(index);
    setWasCorrect(result.correct);
    setCorrectIdx(result.correctIndex);

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
                  disabled={answered}
                >
                  {answer}
                </TextureButton>
              ))}
            </div>

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
