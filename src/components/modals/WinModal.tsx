import { motion, AnimatePresence } from "framer-motion";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { useOnline } from "../../context/OnlineContext";
import { resetRoom } from "../../firebase/roomService";
import { TextureCard } from "../ui/TextureCard";
import { TextureButton } from "../ui/TextureButton";

export default function WinModal() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { identity } = useOnline();

  const handleRestart = () => {
    if (state.gameMode === "online" && identity.roomCode) {
      // Close modal immediately for this client; Firebase reset triggers
      // RESET_GAME on all clients via useRoom's resetId detection
      dispatch({ type: "SHOW_WIN_MODAL", show: false });
      resetRoom(identity.roomCode);
    } else {
      dispatch({ type: "RESET_GAME" });
    }
  };

  const winner = state.players.find(
    (p) => p.position >= 38
  );

  return (
    <AnimatePresence>
      {state.showWinModal && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <TextureCard className="text-center">
              <h2 className="mb-4 text-2xl font-bold">
                {winner ? `${winner.name} Wins!` : "You Win!"} 🎉
              </h2>
              <TextureButton
                variant="primary"
                onClick={handleRestart}
              >
                Restart Game
              </TextureButton>
            </TextureCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
