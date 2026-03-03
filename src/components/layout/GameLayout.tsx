import { useEffect, useState } from "react";
import { useGame, useGameDispatch } from "../../context/GameContext";
import TopPanel from "./TopPanel";
import BottomPanel from "./BottomPanel";
import Board3D from "../board3d/Board3D";
import QuestionModal from "../modals/QuestionModal";
import WinModal from "../modals/WinModal";
import QuestionEditor from "../modals/QuestionEditor";
import CultureModal from "../modals/CultureModal";
import NotModal from "../modals/NotModal";
import InstructionsModal from "../modals/InstructionsModal";
import FeedbackModal from "../modals/FeedbackModal";
import type { Question } from "../../types/game";

import filmData from "../../data/film.json";
import scienceData from "../../data/science.json";
import generalData from "../../data/general.json";
import historyData from "../../data/history.json";
import sportsData from "../../data/sports.json";

export default function GameLayout() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Load questions on mount
  useEffect(() => {
    const allQuestions: Question[] = [
      ...(filmData as Question[]).map((q) => ({ ...q, category: "film" as const })),
      ...(scienceData as Question[]).map((q) => ({ ...q, category: "science" as const })),
      ...(generalData as Question[]).map((q) => ({ ...q, category: "general" as const })),
      ...(historyData as Question[]).map((q) => ({ ...q, category: "history" as const })),
      ...(sportsData as Question[]).map((q) => ({ ...q, category: "sports" as const })),
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
    <div className="relative w-screen h-screen overflow-hidden">

      {/* Full-screen 3D board */}
      <div className="absolute inset-0">
        <Board3D />
      </div>

      {/* Top-left HUD: player bar + wheel spinner */}
      <div className="absolute top-0 left-0 z-10 p-3">
        <TopPanel />
      </div>

      {/* Bottom-center HUD: mode controls */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 pb-3">
        <BottomPanel />
      </div>

      {/* Feedback link — bottom-right */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="absolute bottom-2 right-3 z-10 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        Send feedback
      </button>

      {state.showQuestionModal && state.activeQuestion && <QuestionModal />}
      {state.showWinModal && <WinModal />}
      {state.showEditor && <QuestionEditor />}
      {state.showCultureModal && <CultureModal />}
      {state.showNotModal && <NotModal />}
      {state.showWelcome && <InstructionsModal />}
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
