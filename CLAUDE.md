# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

React + Vite + TypeScript application with Tailwind CSS v4 and Framer Motion.

```bash
npm install    # install dependencies
npm run dev    # start dev server (default port 5173)
npm run build  # production build to dist/
```

Debug mode can be toggled via the settings menu (gear icon) — it shows cell numbers on the board, skips dice animations, and shows a "Skip" button in the question modal.

## Architecture

**Stack:** React 19, Vite 7, TypeScript, Tailwind CSS v4 (with `@tailwindcss/vite`), Framer Motion, Firebase Realtime DB (npm package), Cult UI components (TextureButton, TextureCard).

**State management:** `useReducer` in `GameContext` — all game state flows through typed `GameAction` dispatches. A separate `GameLogicContext` wraps `useGameLogic` hook to share dice/answer orchestration across components.

**Key files:**
```
src/
  context/GameContext.tsx        # useReducer state + provider
  context/GameLogicContext.tsx   # shared game logic (dice, answers, movement)
  hooks/useGameLogic.ts          # roll → question → answer → move → turn
  hooks/useQuestions.ts           # question pool selection with used-tracking
  hooks/useSound.ts               # audio playback wrapper
  lib/constants.ts                # SPIRAL_PATH, CATEGORIES, PLAYER_COLORS
  types/game.ts                   # Player, Question, GameState, RoomData, etc.
  firebase/config.ts              # Firebase init
  firebase/roomService.ts         # room CRUD (create/join/leave/roll/answer)
  firebase/hooks.ts               # useRoom() real-time listener
  components/board/Board.tsx      # 7×7 grid with Cell, BoardCanvas, PlayerToken
  components/dice/DiceRoller.tsx  # declarative 3D cube with Framer Motion
  components/modals/              # QuestionModal, WinModal, QuestionEditor
  components/controls/            # ModeSelector, LocalControls, OnlineControls, SettingsMenu, PlayerBar
  data/*.json                     # question data (imported directly)
```

**Game flow:** Roll dice → category from `pathIndex % 4` → difficulty = dice value (1–6) → fetch unused question → answer → correct moves player forward with spring animation, incorrect stays → next turn.

**Board:** 39-tile spiral path in `SPIRAL_PATH` array (grid indices). Player tokens use Framer Motion spring animation. Canvas overlay draws the path line. Win at position 38 (FINISH).

**Multiplayer:** Firebase rooms at `rooms/{roomCode}`. Active player rolls/answers; all clients sync via `onValue()`. `lastProcessedRollId` ref prevents duplicate processing. localStorage persists identity for reconnection.

**Question data:** Four JSON files in `src/data/` (film, science, general, history). IDs follow `category-###` format. Used questions tracked in `usedQuestionIds` Set in reducer; pool auto-resets per category/difficulty when exhausted.

## Key patterns

- All state flows through `GameContext` reducer — no mutable shared state.
- `GameLogicContext` provides `handleDiceRoll`, `handleAnswer`, `afterAnswer`, `handleSkip` to any component.
- Tailwind v4 custom theme colors defined in `src/index.css` via `@theme` (category colors, player colors, surface, success/error).
- Framer Motion used for: dice 3D cube animation, player token spring movement, modal enter/exit, settings dropdown.
- Firebase config is in `src/firebase/config.ts` (public API key, intended for client-side use).
