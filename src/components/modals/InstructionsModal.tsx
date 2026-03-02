import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameDispatch } from "../../context/GameContext";
import { TextureCard } from "../ui/TextureCard";
import { TextureButton } from "../ui/TextureButton";

type Tab = "gameplay" | "online" | "board";

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
                src="/assets/logo.svg"
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
              <TextureButton
                variant={activeTab === "board" ? "primary" : "default"}
                onClick={() => setActiveTab("board")}
                className="flex-1 text-sm"
              >
                Board
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
                        <li>Open the <strong className="text-white">Local</strong> panel and select exactly 4 categories before anyone moves.</li>
                      </ul>
                    </Section>

                    <Section title="Each Turn">
                      <ul className="space-y-1.5 text-sm text-white/80">
                        <li>Spin the wheel to get a number 1–6.</li>
                        <li>The <strong className="text-white">tile colour</strong> you're on sets the category; the <strong className="text-white">number sets the difficulty</strong>.</li>
                        <li>Answer correctly → move forward that many spaces. Wrong → stay put.</li>
                        <li>First to reach the final tile wins!</li>
                      </ul>
                    </Section>

                    <Section title="Difficulty">
                      <ul className="space-y-1 text-sm text-white/80">
                        <li><strong className="text-white">1–2</strong> — Easy</li>
                        <li><strong className="text-white">3–4</strong> — Medium</li>
                        <li><strong className="text-white">5–6</strong> — Hard</li>
                      </ul>
                      <p className="mt-1.5 text-xs text-white/50">Higher rolls move you further but ask harder questions.</p>
                    </Section>

                    <Section title="Categories">
                      <ul className="space-y-1.5">
                        <CategoryItem color="bg-cat-film" label="Film & TV" />
                        <CategoryItem color="bg-cat-science" label="Science & Tech" />
                        <CategoryItem color="bg-cat-general" label="General Knowledge" />
                        <CategoryItem color="bg-cat-history" label="History & Arts" />
                        <CategoryItem color="bg-cat-sports" label="Sports & Leisure" />
                      </ul>
                      <p className="mt-1.5 text-xs text-white/50">Choose any 4 active categories before starting. In online games the host's choice applies to all players.</p>
                    </Section>

                    <Section title="Special Tiles">
                      <ul className="space-y-2">
                        <li className="text-sm text-white/80">
                          <strong className="text-white">Not tile</strong> — Inactive players describe 6 words or phrases (no saying the word!); the active player guesses. Move forward one space per correct guess, up to 6.
                        </li>
                        <li className="text-sm text-white/80">
                          <strong className="text-white">Culture tile</strong> — The active player names as many answers as possible to a trivia prompt (e.g. "Name 10 Bond films"). Move forward one space per correct answer, up to 10.
                        </li>
                      </ul>
                    </Section>

                    <Section title="Custom Questions">
                      <p className="text-sm text-white/80">
                        Open <strong className="text-white">Settings → Add / Edit Questions</strong> to add your own questions or delete existing ones. Changes apply for the current session only.
                      </p>
                    </Section>
                  </motion.div>
                ) : activeTab === "online" ? (
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
                        Switch to <strong className="text-white">Online Game</strong>, enter your name, choose your 4 categories, then click{" "}
                        <strong className="text-white">Create Room</strong>. Share the 6-character room code with your friends. Enable{" "}
                        <strong className="text-white">Team Mode</strong> before creating if you want team play.
                      </p>
                    </Section>

                    <Section title="Joining a Room">
                      <p className="text-sm text-white/80">
                        Enter your name and the room code, then click <strong className="text-white">Join</strong>. In Team Mode you'll see a lobby — join an existing team or create a new one.
                      </p>
                    </Section>

                    <Section title="Standard Multiplayer">
                      <p className="text-sm text-white/80">
                        Up to 4 players, one token each. Everyone sees the board and questions in real time. Only the active player rolls and answers; all players see the result simultaneously.
                      </p>
                    </Section>

                    <Section title="Team Mode">
                      <ul className="space-y-1.5 text-sm text-white/80">
                        <li>Up to <strong className="text-white">4 teams of 2 players</strong> — each team shares a single board token.</li>
                        <li>Either teammate can roll the wheel on your team's turn.</li>
                        <li>Answering responsibility <strong className="text-white">alternates</strong> between teammates each turn.</li>
                        <li><strong className="text-white">Not tile:</strong> one teammate describes, the other guesses.</li>
                        <li><strong className="text-white">Culture tile:</strong> one teammate performs, the other judges and submits the score.</li>
                      </ul>
                    </Section>

                    <Section title="Custom Board (Online)">
                      <p className="text-sm text-white/80">
                        Build a custom board in the <strong className="text-white">Board</strong> section, save it to get a 4-character board code, then share the code so everyone can load the same board before starting.
                      </p>
                    </Section>

                    <Section title="Room Expiry">
                      <p className="text-sm text-white/80">
                        Rooms expire automatically after 1 hour. Board codes expire after 24 hours.
                      </p>
                    </Section>
                  </motion.div>
                ) : (
                  <motion.div
                    key="board"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <Section title="Custom Board Builder">
                      <p className="text-sm text-white/80">
                        Open the <strong className="text-white">Board</strong> section (bottom panel) to design your own board with 10–48 tiles.
                      </p>
                    </Section>

                    <Section title="Placing Tiles">
                      <ul className="space-y-1.5 text-sm text-white/80">
                        <li>Drag a tile type from the palette onto any board cell to assign it.</li>
                        <li>The <strong className="text-white">Start</strong> and <strong className="text-white">Finish</strong> tiles are fixed at the ends and can't be changed.</li>
                        <li>Unassigned (grey) tiles are automatically filled with categories when you save.</li>
                      </ul>
                    </Section>

                    <Section title="Tile Types">
                      <ul className="space-y-1.5 text-sm text-white/80">
                        <li><strong className="text-white">Category tiles</strong> — Film, Science, General, History, Sports</li>
                        <li><strong className="text-white">Not tile</strong> — Triggers the describe-and-guess round</li>
                        <li><strong className="text-white">Culture tile</strong> — Triggers the trivia-listing round</li>
                        <li><strong className="text-white">Blank</strong> — Auto-filled with a category on save</li>
                      </ul>
                    </Section>

                    <Section title="Auto Fill">
                      <p className="text-sm text-white/80">
                        Click <strong className="text-white">Auto Fill</strong> to instantly populate the board with a balanced spread of categories, Not tiles, and Culture tiles based on the current board size.
                      </p>
                    </Section>

                    <Section title="Saving & Sharing">
                      <ul className="space-y-1.5 text-sm text-white/80">
                        <li>Click <strong className="text-white">Save Board</strong> to generate a 4-character code (valid for 24 hours).</li>
                        <li>Copy and share the code so other players can load the same board.</li>
                        <li>Paste a code and click <strong className="text-white">Load</strong> to restore a saved board.</li>
                        <li>Saving a board immediately resets player positions.</li>
                      </ul>
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
