# NotCulture Board Game

A multiplayer trivia board game with 462 questions across 5 categories. Play locally with up to 4 players or online via Firebase real-time rooms, including online team mode and a custom board builder.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Other Commands

```bash
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
```

## How to Play

1. **Spin the wheel** — your position on the board determines the question category; the wheel value (1–6) sets the difficulty
2. **Answer the question** — 4 multiple choice options
3. **Correct?** Move forward by the wheel value. **Wrong?** Stay put.
4. **First to reach FINISH wins**

### Game Modes

- **Local** — 1–4 players on the same device; use +/− buttons to add or remove players. Category selection sits inside the Local panel.
- **Online** — Create a room and share the 6-character code, or join an existing room. Turns sync across all connected browsers in real-time.
- **Online Team Mode** — Form teams of 2 and compete head-to-head. Each team shares a board token; answerer and describer roles rotate between teammates each turn.

### Special Tiles

- **Not tiles** — When a player starts their turn on a Not tile, inactive players describe words or phrases (without saying the word); the active player guesses. Each correct guess moves them forward one space, up to 6.
- **Culture tiles** — The active player names as many answers as possible to a trivia prompt (e.g. "Name 10 Bond films"). One space forward per correct answer, up to 10.

The modal triggers at the **start** of a turn when the player is already sitting on the tile, not on landing.

### Category Selector

Choose exactly 4 of the 5 categories to play with. In **local mode** the selector is inside the Local panel and locks once any player has moved. In **online mode** the host picks categories when creating the room; all joined players receive the host's selection automatically.

### Custom Board Builder

Open the **Board** panel to design a board with 10–48 tiles using drag-and-drop:

- Drag category, Not, Culture, or Blank tiles from the palette onto any cell
- **Auto Fill** populates the board with a balanced spread instantly
- **Save Board** generates a 4-character shareable code (valid 24 hours)
- Load a code to restore any saved board; saving resets all player positions

### Settings (gear icon)

- **Instructions** — reopens the welcome/instructions modal at any time
- **Add / Edit Questions** — add custom questions, browse by category, delete, or export as JSON
- **Toggle Debug Mode** — shows cell numbers, skips dice animation, adds a Skip button on questions (password-protected)
- **Sound Settings** — volume slider and mute toggle
- **Restart Game** — resets all players to start

## Online Rooms

- Rooms expire automatically after **1 hour**; board codes expire after **24 hours**
- A welcome/instructions modal is shown on first load with **Gameplay**, **Online**, and **Board** tabs; reopen it any time via **Settings → Instructions**
- Disconnect and rejoin a room using the same browser — identity is persisted via sessionStorage (per-tab, prevents cross-tab contamination when testing two players on the same device)
- Player name is stored in localStorage for cross-session convenience

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** — dev server and bundler
- **Tailwind CSS v4** — utility-first styling with custom theme colors
- **Framer Motion** — wheel spinner animation, player token springs, modal transitions
- **Firebase Realtime Database** — online multiplayer room sync and board code storage
- **dnd-kit** — drag-and-drop for the custom board builder
- **Cult UI** — TextureButton and TextureCard components (via class-variance-authority + Radix)

## Project Structure

```
src/
  main.tsx                          # Entry point
  App.tsx                           # Providers (GameContext + GameLogicContext)
  index.css                         # Tailwind directives + @theme colors

  types/game.ts                     # Player, Question, GameState, RoomData, etc.
  lib/utils.ts                      # cn() (clsx + tailwind-merge)
  lib/constants.ts                  # SPIRAL_PATH, CATEGORIES, PLAYER_COLORS

  context/
    GameContext.tsx                  # useReducer state management
    GameLogicContext.tsx             # Shared game logic (dice, answers, movement)

  hooks/
    useGameLogic.ts                 # Roll → question → answer → move → turn
    useQuestions.ts                  # Question pool selection with used-tracking
    useSound.ts                     # Audio playback (dice, move, correct, wrong)

  firebase/
    config.ts                       # Firebase init
    roomService.ts                  # Room CRUD (create/join/leave/roll/answer)
    boardService.ts                 # Board code save/load (24 h TTL)
    hooks.ts                        # useRoom() real-time listener

  components/
    ui/                             # TextureButton, TextureCard
    layout/                         # GameLayout, TopPanel, BottomPanel
    board/                          # Board (7×7 grid), Cell, PlayerToken, BoardCanvas
    builder/                        # BoardBuilderPanel, BuilderCell, PaletteChip
    dice/                           # WheelSpinner (SVG spin-the-wheel, Framer Motion)
    modals/                         # QuestionModal, WinModal, QuestionEditor, NotModal,
                                    #   CultureModal, InstructionsModal, FeedbackModal
    controls/                       # LocalControls, OnlineControls, CategorySelector,
                                    #   SettingsMenu, PlayerBar

  data/
    film.json                       # Film & TV questions
    science.json                    # Science & Technology questions
    general.json                    # General Knowledge questions
    history.json                    # History & Arts questions
    sports.json                     # Sports & Leisure questions
    not.json                        # 30 Not tile cards (6 answers each)
    culture.json                    # Culture tile cards

public/
  assets/sounds/                    # Audio files (dice, move, correct, wrong)
  assets/logo.svg                   # Game logo
```

## Question Categories

| Category | Color | Notes |
|----------|-------|-------|
| Film & TV | Purple | |
| Science & Technology | Steel Blue | |
| General Knowledge | Green | |
| History & Arts | Orange | |
| Sports & Leisure | Red | Optional — choose any 4 of 5 |

Questions have difficulty levels 1–6. The wheel value determines which difficulty you get.

## Board Layout

The **default board** is 39 tiles in a spiral path on a 7×7 grid. The **custom board builder** supports 10–48 tiles with fully configurable tile types. Player tokens animate between cells with spring physics.

Special Not and Culture tiles are at fixed positions on the default board (5, 15, 25, 35, 45 for Not; 10, 20, 30, 40 for Culture) and can be placed anywhere on a custom board.
