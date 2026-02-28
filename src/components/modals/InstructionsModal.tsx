import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameDispatch } from "../../context/GameContext";
import { TextureCard } from "../ui/TextureCard";
import { TextureButton } from "../ui/TextureButton";

type Tab = "gameplay" | "online";

export default function InstructionsModal() {
  const dispatch = useGameDispatch();
  const [activeTab, setActiveTab] = useState<Tab>("gameplay");

  const handleStart = () => {
    dispatch({ type: "DISMISS_WELCOME" });
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
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-[380px] max-w-[95vw]"
        >
          <TextureCard className="flex max-h-[85vh] flex-col overflow-hidden p-0">
            {/* Header */}
            <div className="relative flex flex-col items-center gap-2 px-6 pt-5 pb-3">
              <button
                onClick={handleStart}
                className="absolute top-0 right-0 p-1.5 text-white/50 hover:text-white transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
              <img
                src="/assets/logo.png"
                alt="NotCulture"
                className="h-14 w-auto object-contain"
              />
              <h2 className="text-lg font-bold text-white">Welcome to NotCulture!</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 pb-3">
              <TextureButton
                variant={activeTab === "gameplay" ? "primary" : "default"}
                onClick={() => setActiveTab("gameplay")}
                className="flex-1 text-sm"
              >
                Gameplay
              </TextureButton>
              <TextureButton
                variant={activeTab === "online" ? "primary" : "default"}
                onClick={() => setActiveTab("online")}
                className="flex-1 text-sm"
              >
                Online
              </TextureButton>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              <AnimatePresence mode="wait">
                {activeTab === "gameplay" ? (
                  <motion.div
                    key="gameplay"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <Section title="Objective">
                      <p className="text-sm text-white/80">
                        Be the first player to reach the end of the spiral path to win!
                      </p>
                    </Section>

                    <Section title="Setup">
                      <ul className="space-y-1.5 text-sm text-white/80">
                        <li>Add 2–4 players using the <strong className="text-white">+ Player</strong> and{" "}
                        <strong className="text-white">− Player</strong> buttons.</li>
                        <li><strong className="text-white">Tap a player's name</strong> to rename them.</li>
                        <li><strong className="text-white">Tap the colour dot</strong> next to a name to pick a token colour.</li>
                      </ul>
                    </Section>

                    <Section title="Each Turn">
                      <p className="text-sm text-white/80">
                        Spin the wheel — the result sets your category and difficulty. Answer the trivia question correctly to move forward; wrong and you stay put.
                      </p>
                    </Section>

                    <Section title="Categories">
                      <ul className="space-y-1.5">
                        <CategoryItem color="bg-cat-film" label="Film & TV" />
                        <CategoryItem color="bg-cat-science" label="Science & Tech" />
                        <CategoryItem color="bg-cat-general" label="General Knowledge" />
                        <CategoryItem color="bg-cat-history" label="History & Arts" />
                      </ul>
                    </Section>

                    <Section title="Special Tiles">
                      <ul className="space-y-2">
                        <li className="text-sm text-white/80">
                          <strong className="text-white">Not tile</strong> (positions 5, 15, 25, 35) — Inactive players describe words or phrases; the active player guesses. Score up to 6 points and move that many spaces.
                        </li>
                        <li className="text-sm text-white/80">
                          <strong className="text-white">Culture tile</strong> — A performance challenge: sing, act, or draw. Other players judge the result.
                        </li>
                      </ul>
                    </Section>
                  </motion.div>
                ) : (
                  <motion.div
                    key="online"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <Section title="Creating a Room">
                      <p className="text-sm text-white/80">
                        Click <strong className="text-white">Online Game</strong>, enter your name, then click{" "}
                        <strong className="text-white">Create Room</strong>. Share the 6-character room code with your friends.
                      </p>
                    </Section>

                    <Section title="Joining a Room">
                      <p className="text-sm text-white/80">
                        Click <strong className="text-white">Online Game</strong>, enter your name and the room code, then click <strong className="text-white">Join</strong>.
                      </p>
                    </Section>

                    <Section title="Playing Online">
                      <p className="text-sm text-white/80">
                        The room creator starts the game. Everyone sees the board and questions in real time. Only the active player rolls and answers; all clients see the result simultaneously.
                      </p>
                    </Section>

                    <Section title="Room Expiry">
                      <p className="text-sm text-white/80">
                        Rooms expire automatically after 1 hour.
                      </p>
                    </Section>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 pt-3 pb-5">
              <TextureButton variant="primary" onClick={handleStart} className="w-full">
                Start Playing
              </TextureButton>
            </div>
          </TextureCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold uppercase tracking-wide text-white/70">{title}</p>
      {children}
    </div>
  );
}

function CategoryItem({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`h-3 w-3 flex-shrink-0 rounded-full ${color}`} />
      <span className="text-sm text-white/80">{label}</span>
    </li>
  );
}
