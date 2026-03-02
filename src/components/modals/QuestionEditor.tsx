import { useState } from "react";
import { motion } from "framer-motion";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { TextureButton } from "../ui/TextureButton";
import { TextureCard } from "../ui/TextureCard";
import { ALL_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS } from "../../lib/constants";
import type { Category, Question } from "../../types/game";

type Tab = "editor" | "instructions";

export default function QuestionEditor() {
  const state = useGame();
  const dispatch = useGameDispatch();

  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [questionText, setQuestionText] = useState("");
  const [category, setCategory] = useState<Category>("film");
  const [difficulty, setDifficulty] = useState(1);
  const [answers, setAnswers] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_CATEGORIES.map((c) => [c, true]))
  );

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
    ALL_CATEGORIES.forEach((cat) => {
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

        <h2 className="mb-3 text-xl font-bold">Question Editor</h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <TextureButton
            variant={activeTab === "editor" ? "primary" : "default"}
            onClick={() => setActiveTab("editor")}
            className="flex-1 text-sm"
          >
            Add Question
          </TextureButton>
          <TextureButton
            variant={activeTab === "instructions" ? "primary" : "default"}
            onClick={() => setActiveTab("instructions")}
            className="flex-1 text-sm"
          >
            Instructions
          </TextureButton>
        </div>

        {activeTab === "editor" ? (
          <>
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
                {ALL_CATEGORIES.map((cat) => (
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
              {ALL_CATEGORIES.map((cat) => {
                const filtered = state.questions
                  .filter((q) => q.category === cat)
                  .sort((a, b) => a.difficulty - b.difficulty);

                return (
                  <div key={cat} className="mb-3 rounded-md border border-white/20">
                    <div
                      className="sticky top-0 z-10 cursor-pointer bg-surface-alt px-3 py-2 font-bold uppercase select-none hover:bg-white/10"
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))
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
          </>
        ) : (
          /* Instructions tab */
          <div className="space-y-5 text-sm">
            <EditorSection title="Categories">
              <p className="mb-2 text-white/70">Each question belongs to one of 5 categories. Choose any 4 to play with.</p>
              <ul className="space-y-1.5">
                {ALL_CATEGORIES.map((cat) => (
                  <li key={cat} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    <span className="text-white/80">{CATEGORY_LABELS[cat]}</span>
                  </li>
                ))}
              </ul>
            </EditorSection>

            <EditorSection title="Difficulty">
              <ul className="space-y-1 text-white/70">
                <li><strong className="text-white">1–2</strong> — Easy. Pub quiz level, widely known facts.</li>
                <li><strong className="text-white">3–4</strong> — Medium. Requires some knowledge of the topic.</li>
                <li><strong className="text-white">5–6</strong> — Hard. Specialist or expert-level questions.</li>
              </ul>
              <p className="mt-1.5 text-white/50 text-xs">The wheel value (1–6) directly selects the difficulty, so aim for a good spread across all levels.</p>
            </EditorSection>

            <EditorSection title="Question Format">
              <ul className="space-y-1 text-white/70">
                <li>Write a clear question with exactly <strong className="text-white">4 answers</strong>.</li>
                <li>All answers must be <strong className="text-white">unique</strong>.</li>
                <li>Select which answer (A–D) is correct before adding.</li>
              </ul>
            </EditorSection>

            <EditorSection title="Special Tiles">
              <ul className="space-y-2 text-white/70">
                <li>
                  <strong className="text-white">Not tile</strong> — Inactive players describe 6 words or phrases; the active player guesses. One space per correct guess, up to 6.
                </li>
                <li>
                  <strong className="text-white">Culture tile</strong> — The active player guesses 1–10 answers for a trivia question. One space forward per correct answer.
                </li>
              </ul>
            </EditorSection>

            <EditorSection title="Exporting">
              <p className="text-white/70">
                <strong className="text-white">Export JSON</strong> downloads one <code className="rounded bg-white/10 px-1">.json</code> file per category containing all current questions — ready to drop back into <code className="rounded bg-white/10 px-1">src/data/</code>.
              </p>
            </EditorSection>
          </div>
        )}
      </TextureCard>
    </motion.div>
  );
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-white/50">{title}</p>
      {children}
    </div>
  );
}
