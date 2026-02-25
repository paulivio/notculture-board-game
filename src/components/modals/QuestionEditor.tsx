import { useState } from "react";
import { motion } from "framer-motion";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { TextureButton } from "../ui/TextureButton";
import { TextureCard } from "../ui/TextureCard";
import { CATEGORIES, CATEGORY_LABELS } from "../../lib/constants";
import type { Category, Question } from "../../types/game";

export default function QuestionEditor() {
  const state = useGame();
  const dispatch = useGameDispatch();

  const [questionText, setQuestionText] = useState("");
  const [category, setCategory] = useState<Category>("film");
  const [difficulty, setDifficulty] = useState(1);
  const [answers, setAnswers] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    film: true,
    science: true,
    general: true,
    history: true,
  });

  function generateQuestionId(cat: Category): string {
    const catQuestions = state.questions.filter((q) => q.category === cat);
    if (catQuestions.length === 0) return `${cat}-001`;
    const numbers = catQuestions.map((q) => {
      const parts = q.id.split("-");
      return parseInt(parts[1], 10);
    });
    const next = Math.max(...numbers) + 1;
    return `${cat}-${String(next).padStart(3, "0")}`;
  }

  function handleAdd() {
    setError("");

    if (!questionText.trim()) {
      setError("Question text must not be empty.");
      return;
    }
    if (answers.some((a) => !a.trim())) {
      setError("All answer fields must be filled.");
      return;
    }
    if (new Set(answers.map((a) => a.trim())).size !== answers.length) {
      setError("All answer fields must be unique.");
      return;
    }

    const newQuestion: Question = {
      id: generateQuestionId(category),
      category,
      difficulty,
      question: questionText.trim(),
      answers: answers.map((a) => a.trim()),
      correctIndex,
    };

    dispatch({
      type: "SET_QUESTIONS",
      questions: [...state.questions, newQuestion],
    });

    setQuestionText("");
    setAnswers(["", "", "", ""]);
    setError("");
  }

  function handleDelete(id: string) {
    dispatch({
      type: "SET_QUESTIONS",
      questions: state.questions.filter((q) => q.id !== id),
    });
  }

  function handleExport() {
    CATEGORIES.forEach((cat) => {
      const catQuestions = state.questions
        .filter((q) => q.category === cat)
        .map(({ category: _c, ...rest }) => rest);

      const blob = new Blob([JSON.stringify(catQuestions, null, 2)], {
        type: "application/json",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${cat}.json`;
      link.click();
    });
  }

  return (
    <motion.div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <TextureCard className="relative max-h-[85vh] w-[90%] max-w-[500px] overflow-y-auto">
        {/* Close */}
        <button
          className="absolute right-3 top-3 border-none bg-transparent text-lg text-white cursor-pointer"
          onClick={() => dispatch({ type: "SHOW_EDITOR", show: false })}
        >
          ✕
        </button>

        <h2 className="mb-4 text-xl font-bold">Add a Question</h2>

        <div className="flex flex-col gap-2">
          <input
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40"
            placeholder="Question text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
          />

          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? "(Easy)" : d === 6 ? "(Hard)" : ""}
              </option>
            ))}
          </select>

          {answers.map((ans, i) => (
            <input
              key={i}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40"
              placeholder={`Answer ${String.fromCharCode(65 + i)}`}
              value={ans}
              onChange={(e) => {
                const copy = [...answers];
                copy[i] = e.target.value;
                setAnswers(copy);
              }}
            />
          ))}

          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            value={correctIndex}
            onChange={(e) => setCorrectIndex(Number(e.target.value))}
          >
            {["A", "B", "C", "D"].map((letter, i) => (
              <option key={i} value={i}>
                Correct: {letter}
              </option>
            ))}
          </select>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-2">
            <TextureButton variant="primary" onClick={handleAdd}>
              Add Question
            </TextureButton>
            <TextureButton onClick={handleExport}>Export JSON</TextureButton>
          </div>
        </div>

        <hr className="my-4 border-white/10" />

        <h3 className="mb-2 text-lg font-bold">Existing Questions</h3>

        <div className="max-h-[300px] overflow-y-auto text-left">
          {CATEGORIES.map((cat) => {
            const filtered = state.questions
              .filter((q) => q.category === cat)
              .sort((a, b) => a.difficulty - b.difficulty);

            return (
              <div
                key={cat}
                className="mb-3 rounded-md border border-white/20"
              >
                <div
                  className="sticky top-0 z-10 cursor-pointer bg-surface-alt px-3 py-2 font-bold uppercase select-none hover:bg-white/10"
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [cat]: !prev[cat],
                    }))
                  }
                >
                  {cat.toUpperCase()} ({filtered.length})
                </div>

                {!collapsed[cat] && (
                  <div className="bg-black p-2">
                    {filtered.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between border-b border-white/5 py-1.5 text-sm last:border-none"
                      >
                        <div className="flex-1 pr-2">
                          <strong>{q.question}</strong>
                          <div className="text-xs opacity-60">
                            Difficulty {q.difficulty}
                          </div>
                        </div>
                        <TextureButton
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(q.id)}
                        >
                          Delete
                        </TextureButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </TextureCard>
    </motion.div>
  );
}
