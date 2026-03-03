import { useEffect, useState } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { CATEGORY_COLORS } from "../../lib/constants";
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
import type { Question, TileType } from "../../types/game";

import filmData from "../../data/film.json";
import scienceData from "../../data/science.json";
import generalData from "../../data/general.json";
import historyData from "../../data/history.json";
import sportsData from "../../data/sports.json";

// Colours/labels for the drag overlay preview chip
const DRAG_TILE_INFO: Record<string, { label: string; color: string }> = {
  film:    { label: "Film",    color: CATEGORY_COLORS.film },
  science: { label: "Sci",     color: CATEGORY_COLORS.science },
  general: { label: "Gen",     color: CATEGORY_COLORS.general },
  history: { label: "Hist",    color: CATEGORY_COLORS.history },
  sports:  { label: "Sport",   color: CATEGORY_COLORS.sports },
  not:     { label: "NOT",     color: "#d97706" },
  culture: { label: "CULTURE", color: "#0d9488" },
  auto:    { label: "⌫ Blank", color: "#3f3f46" },
};

export default function GameLayout() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [activeDragTile, setActiveDragTile] = useState<TileType | null>(null);

  // Require 8px movement before a drag activates — lets clicks pass through to onClick handlers
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current as { tileType?: TileType } | undefined;
    if (data?.tileType) setActiveDragTile(data.tileType);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragTile(null);

    if (!state.boardPreviewConfig) return;

    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;

    const destIndex = overId?.startsWith("cell-")
      ? parseInt(overId.replace("cell-", ""), 10)
      : null;

    // Palette drag: "palette-{type}"
    if (activeId.startsWith("palette-")) {
      if (destIndex === null) return;
      const tileType = (active.data.current as { tileType: TileType }).tileType;
      dispatch({ type: "SET_BOARD_PREVIEW_TILE_TYPE", index: destIndex, tileType });
      return;
    }

    // Board-cell drag: "board-{pathIndex}"
    if (activeId.startsWith("board-")) {
      const sourceIndex = (active.data.current as { sourcePathIndex: number }).sourcePathIndex;
      const sourceTileType = (active.data.current as { tileType: TileType }).tileType;

      if (destIndex === null) {
        // Dropped off-board → blank the source
        dispatch({ type: "SET_BOARD_PREVIEW_TILE_TYPE", index: sourceIndex, tileType: "auto" });
      } else if (destIndex !== sourceIndex) {
        // Move type to destination, blank source
        dispatch({ type: "SET_BOARD_PREVIEW_TILE_TYPE", index: destIndex, tileType: sourceTileType });
        dispatch({ type: "SET_BOARD_PREVIEW_TILE_TYPE", index: sourceIndex, tileType: "auto" });
      }
    }
  }

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

  const dragInfo = activeDragTile ? DRAG_TILE_INFO[activeDragTile] : null;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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

      {/* Drag overlay — portal above all content; dropAnimation=null prevents fly-back */}
      <DragOverlay dropAnimation={null}>
        {dragInfo ? (
          <div
            style={{ backgroundColor: dragInfo.color }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-xl cursor-grabbing select-none"
          >
            {dragInfo.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
