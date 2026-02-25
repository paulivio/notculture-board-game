# NotCulture Board Game

A multiplayer trivia board game with 412 questions across 4 categories. Play locally with up to 4 players or online via Firebase real-time rooms.

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

### Settings (gear icon)

- **Add / Edit Questions** — add custom questions, browse by category, delete, or export as JSON
- **Toggle Debug Mode** — shows cell numbers, skips dice animation, adds a skip button on questions
- **Restart Game** — resets all players to start

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** — dev server and bundler
- **Tailwind CSS v4** — utility-first styling with custom theme colors
- **Framer Motion** — 3D dice animation, player token springs, modal transitions
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
    dice/                           # DiceRoller (3D cube with Framer Motion)
    modals/                         # QuestionModal, WinModal, QuestionEditor
    controls/                       # ModeSelector, LocalControls, OnlineControls,
                                    #   SettingsMenu, PlayerBar

  data/
    film.json                       # 60 Film & TV questions
    science.json                    # 130 Science & Technology questions
    general.json                    # 60 General Knowledge questions
    history.json                    # 62 History & Arts questions

public/
  assets/dice/                      # Dice face images (dice-1.png to dice-6.png)
  assets/sounds/                    # Audio files (dice, move, correct, wrong)
  assets/logo.png                   # Board center logo
```

## Question Categories

| Category | Color | Questions |
|----------|-------|-----------|
| Film & TV | Purple | 60 |
| Science & Technology | Steel Blue | 130 |
| General Knowledge | Green | 60 |
| History & Arts | Orange | 62 |

Questions have difficulty levels 1-6. The dice roll determines which difficulty you get.

## Board Layout

39 tiles in a spiral path on a 7×7 grid. Categories cycle by position (`pathIndex % 4`). The center of the board shows the game logo. Player tokens animate between cells with spring physics.
