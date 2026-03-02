# NotCulture Board Game

A multiplayer trivia board game with 462 questions across 5 categories. Play locally with up to 4 players or online via Firebase real-time rooms, including online team mode.

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

1. **Roll the dice** — your position on the board determines the question category, the dice value determines difficulty (1-6 stars)
2. **Answer the question** — 4 multiple choice options
3. **Correct?** Move forward by the dice value. **Wrong?** Stay put.
4. **First to FINISH (position 38) wins**

### Game Modes

- **Local** — 1-4 players on the same device, use +/- buttons to add or remove players
- **Online** — Create a room and share the code, or join an existing room. Turns sync across all connected browsers in real-time
- **Online Team Mode** — create a team room, form teams, and compete head-to-head. Each team shares a board position; roles (answerer / describer) rotate between teammates each turn

### Special Tiles

- **Not tiles** (positions 5, 15, 25, 35, 45) — when a player starts their turn on a Not tile, the Not modal opens automatically. Inactive players describe items; the active player guesses. Each correct guess moves the player forward one space (up to 6).
- **Culture tiles** — same describe-and-guess mechanic with a different card set.

### Category Selector

Before a game starts (local) or when creating an online room, choose which 4 of the 5 categories to include. The selector is locked once any player has moved. Online rooms sync the host's chosen categories to all joined players automatically.

### Settings (gear icon)

- **Add / Edit Questions** — add custom questions, browse by category, delete, or export as JSON
- **Toggle Debug Mode** — shows cell numbers, skips dice animation, adds a skip button on questions (password-protected)
- **Sound Settings** — toggle sound effects on/off
- **Restart Game** — resets all players to start

### Feedback

A "Send feedback" link at the bottom of the page opens a modal where players can report bugs or question issues. Submissions are stored in Firebase under `feedback/` and read by the creator.

## Online Rooms

- Rooms expire automatically after **1 hour** — stale rooms are cleaned up on join and in the real-time listener
- A full-screen **welcome/instructions modal** is shown on every page load with Gameplay and Online tabs
- Disconnect and rejoin a room using the same browser — identity is persisted via sessionStorage (per-tab, prevents cross-tab contamination when testing two players on the same device)
- Player name is stored in localStorage for cross-session convenience

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** — dev server and bundler
- **Tailwind CSS v4** — utility-first styling with custom theme colors
- **Framer Motion** — wheel spinner animation, player token springs, modal transitions
- **Firebase Realtime Database** — online multiplayer room sync
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
    hooks.ts                        # useRoom() real-time listener

  components/
    ui/                             # TextureButton, TextureCard
    layout/                         # GameLayout, TopPanel, BottomPanel
    board/                          # Board (7×7 grid), Cell, PlayerToken, BoardCanvas
    dice/                           # WheelSpinner (SVG spin-the-wheel, Framer Motion)
    modals/                         # QuestionModal, WinModal, QuestionEditor, NotModal,
                                    #   CultureModal, InstructionsModal, FeedbackModal
    controls/                       # ModeSelector, LocalControls, OnlineControls,
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
  assets/dice/                      # Dice face images (dice-1.png to dice-6.png)
  assets/sounds/                    # Audio files (dice, move, correct, wrong)
  assets/logo.png                   # Board center logo
```

## Question Categories

| Category | Color | Notes |
|----------|-------|-------|
| Film & TV | Purple | |
| Science & Technology | Steel Blue | |
| General Knowledge | Green | |
| History & Arts | Orange | |
| Sports & Leisure | Red | Optional — choose any 4 of 5 via the category selector |

Questions have difficulty levels 1–6. The dice roll determines which difficulty you get.

## Board Layout

39 tiles in a spiral path on a 7×7 grid. Categories cycle by position (`pathIndex % 4`). The center of the board shows the game logo. Player tokens animate between cells with spring physics.

Special Not/Culture tiles sit at fixed positions (5, 15, 25, 35, 45). Landing on one via a correct answer passes the turn normally; the modal triggers at the **start** of the next turn when the player is already sitting on the tile.
