import { useState, useLayoutEffect, type RefObject } from "react";
import { motion } from "framer-motion";
import { SPIRAL_PATH } from "../../lib/constants";
import type { Player } from "../../types/game";

interface PlayerTokenProps {
  player: Player;
  boardRef: RefObject<HTMLDivElement | null>;
  cellRefs: RefObject<Map<number, HTMLDivElement>>;
  allPlayers: Player[];
}

export default function PlayerToken({
  player,
  boardRef,
  cellRefs,
  allPlayers,
}: PlayerTokenProps) {
  const [pos, setPos] = useState({ x: 0, y: 0, size: 0 });

  // Compute stable scalars outside the effect. allPlayers is always a new array
  // reference after every Firebase SYNC_ONLINE_STATE dispatch, so putting it in
  // useLayoutEffect deps causes the effect to re-run on every sync → setPos →
  // re-render → infinite loop. Using primitive numbers breaks that cycle.
  const playersAtPos = allPlayers.filter((p) => p.position === player.position);
  const myIndex = playersAtPos.findIndex((p) => p.id === player.id);
  const totalAtPos = playersAtPos.length;

  useLayoutEffect(() => {
    function calculate() {
      const board = boardRef.current;
      if (!board) return;

      const gridIndex = SPIRAL_PATH[player.position];
      if (gridIndex === undefined) return;

      const cell = cellRefs.current.get(gridIndex);
      if (!cell) return;

      const boardRect = board.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      const tokenSize = cellRect.width * 0.4;
      const centerX = cellRect.left - boardRect.left + cellRect.width / 2;
      const centerY = cellRect.top - boardRect.top + cellRect.height / 2;

      let offsetX = 0;
      let offsetY = 0;

      if (totalAtPos > 1) {
        const radius = tokenSize * 0.6;
        const angle = (2 * Math.PI * myIndex) / totalAtPos;
        offsetX = Math.cos(angle) * radius;
        offsetY = Math.sin(angle) * radius;
      }

      // Functional update: only create new state when values actually changed.
      setPos((prev) => {
        const newX = centerX + offsetX;
        const newY = centerY + offsetY;
        if (prev.x === newX && prev.y === newY && prev.size === tokenSize) {
          return prev; // No change — skip the re-render
        }
        return { x: newX, y: newY, size: tokenSize };
      });
    }

    calculate();

    const board = boardRef.current;
    if (!board) return;

    const observer = new ResizeObserver(calculate);
    observer.observe(board);

    return () => observer.disconnect();
  }, [player.position, player.id, myIndex, totalAtPos, boardRef, cellRefs]);

  if (pos.size === 0) return null;

  return (
    <motion.div
      className="absolute rounded-full z-[5]"
      style={{
        width: pos.size,
        height: pos.size,
        backgroundColor: player.color ?? "#888",
      }}
      animate={{
        left: pos.x - pos.size / 2,
        top: pos.y - pos.size / 2,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
    />
  );
}
