import { useEffect } from "react";
import { useGame, useGameDispatch } from "../../context/GameContext";
import TopPanel from "./TopPanel";
import BottomPanel from "./BottomPanel";
import Board from "../board/Board";
import QuestionModal from "../modals/QuestionModal";
import WinModal from "../modals/WinModal";
import QuestionEditor from "../modals/QuestionEditor";
import CultureModal from "../modals/CultureModal";
import NotModal from "../modals/NotModal";
import InstructionsModal from "../modals/InstructionsModal";
import type { Question } from "../../types/game";

import filmData from "../../data/film.json";
import scienceData from "../../data/science.json";
import generalData from "../../data/general.json";
import historyData from "../../data/history.json";

export default function GameLayout() {
  const state = useGame();
  const dispatch = useGameDispatch();

  // Load questions on mount
  useEffect(() => {
    const allQuestions: Question[] = [
      ...(filmData as Question[]).map((q) => ({ ...q, category: "film" as const })),
      ...(scienceData as Question[]).map((q) => ({ ...q, category: "science" as const })),
      ...(generalData as Question[]).map((q) => ({ ...q, category: "general" as const })),
      ...(historyData as Question[]).map((q) => ({ ...q, category: "history" as const })),
    ];
    dispatch({ type: "SET_QUESTIONS", questions: allQuestions });
  }, [dispatch]);

  // Body scroll lock when modals open
  useEffect(() => {
    if (state.showQuestionModal || state.showEditor || state.showWinModal || state.showCultureModal || state.showNotModal || state.showWelcome) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [state.showQuestionModal, state.showEditor, state.showWinModal, state.showCultureModal, state.showNotModal, state.showWelcome]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-start gap-1 p-2.5 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
      <TopPanel />
      <Board />
      <BottomPanel />

      {state.showQuestionModal && state.activeQuestion && <QuestionModal />}
      {state.showWinModal && <WinModal />}
      {state.showEditor && <QuestionEditor />}
      {state.showCultureModal && <CultureModal />}
      {state.showNotModal && <NotModal />}
      {state.showWelcome && <InstructionsModal />}
    </div>
  );
}
