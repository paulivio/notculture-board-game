import { useRef, useEffect, useCallback, type RefObject } from "react";
import { SPIRAL_PATH } from "../../lib/constants";

interface BoardCanvasProps {
  boardRef: RefObject<HTMLDivElement | null>;
  cellRefs: RefObject<Map<number, HTMLDivElement>>;
}

export default function BoardCanvas({ boardRef, cellRefs }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    const rect = board.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    let started = false;

    SPIRAL_PATH.forEach((gridIndex) => {
      const cell = cellRefs.current.get(gridIndex);
      if (!cell) return;

      const cellRect = cell.getBoundingClientRect();
      const x = cellRect.left - rect.left + cellRect.width / 2;
      const y = cellRect.top - rect.top + cellRect.height / 2;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }, [boardRef, cellRefs]);

  useEffect(() => {
    // Draw after mount with increasing delays to ensure cells are laid out
    const t1 = setTimeout(draw, 100);
    const t2 = setTimeout(draw, 300);

    const board = boardRef.current;
    if (board) {
      const observer = new ResizeObserver(draw);
      observer.observe(board);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        observer.disconnect();
      };
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [draw, boardRef]);

  // Also redraw on window resize
  useEffect(() => {
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
