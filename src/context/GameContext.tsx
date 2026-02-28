import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { GameState, GameAction } from "../types/game";
import { MAX_POSITION, PLAYER_COLORS } from "../lib/constants";

const initialState: GameState = {
  questionsLoaded: false,
  questions: [],
  players: [
    { id: 1, name: "Player 1", position: 0, color: PLAYER_COLORS[1] },
    { id: 2, name: "Player 2", position: 0, color: PLAYER_COLORS[2] },
  ],
  localPlayers: [],
  maxPlayers: 4,
  minPlayers: 1,
  currentPlayerIndex: 0,
  activeQuestion: null,
  pendingMove: 0,
  pendingCategory: null,
  isTurnLocked: false,
  usedQuestionIds: new Set(),
  debugMode: false,
  gameMode: "local",
  showWinModal: false,
  showQuestionModal: false,
  showCultureModal: false,
  showNotModal: false,
  showEditor: false,
  showSettings: false,
  showWelcome: true,
  answerResult: null,
  cultureTimerStartedAt: null,
  cultureScore: null,
  notTimerStartedAt: null,
  notScore: null,
  currentNotCard: null,
};

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ADD_PLAYER": {
      if (state.players.length >= state.maxPlayers) return state;
      const newId = state.players.length + 1;
      return {
        ...state,
        players: [
          ...state.players,
          { id: newId, name: `Player ${newId}`, position: 0, color: PLAYER_COLORS[newId] },
        ],
      };
    }

    case "REMOVE_PLAYER": {
      if (state.players.length <= state.minPlayers) return state;
      const newPlayers = state.players.slice(0, -1);
      return {
        ...state,
        players: newPlayers,
        currentPlayerIndex:
          state.currentPlayerIndex >= newPlayers.length
            ? 0
            : state.currentPlayerIndex,
      };
    }

    case "RENAME_PLAYER":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, name: action.name } : p
        ),
      };

    case "ADVANCE_TURN":
      return {
        ...state,
        currentPlayerIndex:
          (state.currentPlayerIndex + 1) % state.players.length,
      };

    case "LOCK_TURN":
      return { ...state, isTurnLocked: true };

    case "UNLOCK_TURN":
      return {
        ...state,
        isTurnLocked: false,
        activeQuestion: null,
        pendingMove: 0,
        pendingCategory: null,
      };

    case "SET_ACTIVE_QUESTION":
      return {
        ...state,
        activeQuestion: action.question,
        pendingMove: action.roll,
        showQuestionModal: true,
      };

    case "CLEAR_QUESTION":
      return {
        ...state,
        activeQuestion: null,
        pendingMove: 0,
        showQuestionModal: false,
        answerResult: null,
      };

    case "SET_ANSWER_RESULT":
      return { ...state, answerResult: action.result };

    case "MOVE_PLAYER": {
      return {
        ...state,
        players: state.players.map((p) => {
          if (p.id !== action.playerId) return p;
          const newPos = Math.min(p.position + action.steps, MAX_POSITION);
          return { ...p, position: newPos };
        }),
      };
    }

    case "SET_PLAYER_POSITION":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, position: action.position } : p
        ),
      };

    case "MARK_QUESTION_USED": {
      const newUsed = new Set(state.usedQuestionIds);
      newUsed.add(action.questionId);
      return { ...state, usedQuestionIds: newUsed };
    }

    case "CLEAR_USED_QUESTIONS": {
      const cleared = new Set(state.usedQuestionIds);
      action.questionIds.forEach((id) => cleared.delete(id));
      return { ...state, usedQuestionIds: cleared };
    }

    case "SET_PLAYER_COLOR":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, color: action.color } : p
        ),
      };

    case "TOGGLE_DEBUG":
      return { ...state, debugMode: !state.debugMode };

    case "SET_GAME_MODE": {
      // Only clear mid-turn/modal state — never reset board positions or question progress.
      // Local game is preserved across mode switches; reset comes from the manual reset button only.
      const modeSwitchClear = {
        activeQuestion: null,
        pendingMove: 0,
        pendingCategory: null,
        isTurnLocked: false,
        answerResult: null,
        showWinModal: false,
        showQuestionModal: false,
        showCultureModal: false,
        showNotModal: false,
        cultureTimerStartedAt: null as null,
        cultureScore: null as null,
        notTimerStartedAt: null as null,
        notScore: null as null,
        currentNotCard: null,
      };
      if (action.mode === "online") {
        // Save local players so they can be restored when switching back
        return {
          ...state,
          ...modeSwitchClear,
          gameMode: "online",
          localPlayers: state.players,
          players: [],
        };
      }
      // Switching to local: restore saved players, or fall back to current/defaults
      const defaultPlayers = [
        { id: 1, name: "Player 1", position: 0, color: PLAYER_COLORS[1] },
        { id: 2, name: "Player 2", position: 0, color: PLAYER_COLORS[2] },
      ];
      const restoredPlayers =
        state.localPlayers.length > 0
          ? state.localPlayers
          : state.players.length > 0
            ? state.players
            : defaultPlayers;
      return {
        ...state,
        ...modeSwitchClear,
        gameMode: "local",
        players: restoredPlayers,
        localPlayers: [],
        currentPlayerIndex: Math.min(state.currentPlayerIndex, restoredPlayers.length - 1),
      };
    }

    case "RESET_GAME":
      return {
        ...state,
        questions: shuffleArray([...state.questions]),
        players: state.players.map((p) => ({ ...p, position: 0 })),
        localPlayers: [],
        currentPlayerIndex: 0,
        activeQuestion: null,
        pendingMove: 0,
        pendingCategory: null,
        isTurnLocked: false,
        usedQuestionIds: new Set(),
        showWinModal: false,
        showQuestionModal: false,
        showCultureModal: false,
        showNotModal: false,
        cultureTimerStartedAt: null,
        cultureScore: null,
        notTimerStartedAt: null,
        notScore: null,
        currentNotCard: null,
      };

    case "SET_QUESTIONS":
      return {
        ...state,
        questions: shuffleArray(action.questions),
        questionsLoaded: true,
      };

    case "SHOW_WIN_MODAL":
      return { ...state, showWinModal: action.show };

    case "SHOW_QUESTION_MODAL":
      return { ...state, showQuestionModal: action.show };

    case "SHOW_CULTURE_MODAL":
      if (!action.show) {
        return {
          ...state,
          showCultureModal: false,
          cultureTimerStartedAt: null,
          cultureScore: null,
        };
      }
      return { ...state, showCultureModal: true };

    case "SET_CULTURE_TIMER_START":
      return { ...state, cultureTimerStartedAt: action.startedAt };

    case "SET_CULTURE_SCORE":
      return { ...state, cultureScore: action.score };

    case "SHOW_NOT_MODAL":
      if (!action.show) {
        return {
          ...state,
          showNotModal: false,
          notTimerStartedAt: null,
          notScore: null,
          currentNotCard: null,
        };
      }
      return { ...state, showNotModal: true };

    case "SET_NOT_TIMER_START":
      return { ...state, notTimerStartedAt: action.startedAt };

    case "SET_NOT_SCORE":
      return { ...state, notScore: action.score };

    case "SET_NOT_CARD":
      return { ...state, currentNotCard: action.card };

    case "SHOW_EDITOR":
      return { ...state, showEditor: action.show };

    case "SHOW_SETTINGS":
      return { ...state, showSettings: action.show };

    case "DISMISS_WELCOME":
      return { ...state, showWelcome: false };

    case "SET_PENDING_CATEGORY":
      return { ...state, pendingCategory: action.category };

    case "SYNC_ONLINE_STATE": {
      const playerIndexChanged = action.currentPlayerIndex !== state.currentPlayerIndex;
      return {
        ...state,
        // Never let a sync move a player backwards — this protects mid-animation steps
        // from being overwritten by stale Firebase values
        players: action.players.map((incoming) => {
          const local = state.players.find((p) => p.id === incoming.id);
          if (local && incoming.position < local.position) {
            return { ...incoming, position: local.position };
          }
          return incoming;
        }),
        currentPlayerIndex: action.currentPlayerIndex,
        // Safety net: if Firebase says it's a new player's turn, always clear the lock.
        // Guards against any code path that fails to dispatch UNLOCK_TURN.
        isTurnLocked: playerIndexChanged ? false : state.isTurnLocked,
      };
    }

    default:
      return state;
  }
}

const GameContext = createContext<GameState>(initialState);
const GameDispatchContext = createContext<Dispatch<GameAction>>(() => {});

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>
        {children}
      </GameDispatchContext.Provider>
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}

export function useGameDispatch() {
  return useContext(GameDispatchContext);
}
