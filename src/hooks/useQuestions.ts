import { useCallback } from "react";
import { useGame, useGameDispatch } from "../context/GameContext";
import type { Category, Question } from "../types/game";

export function useQuestions() {
  const state = useGame();
  const dispatch = useGameDispatch();

  const getQuestion = useCallback(
    (category: Category, difficulty: number): Question | null => {
      const matching = state.questions.filter(
        (q) => q.category === category && q.difficulty === difficulty
      );

      if (matching.length === 0) return null;

      const unused = matching.filter(
        (q) => !state.usedQuestionIds.has(q.id)
      );

      let pool = unused;

      // If all used, reset only this subset
      if (unused.length === 0) {
        dispatch({
          type: "CLEAR_USED_QUESTIONS",
          questionIds: matching.map((q) => q.id),
        });
        pool = matching;
      }

      const selected = pool[0];
      dispatch({ type: "MARK_QUESTION_USED", questionId: selected.id });
      return selected;
    },
    [state.questions, state.usedQuestionIds, dispatch]
  );

  return { getQuestion };
}
