export interface Player {
  id: number;
  name: string;
  position: number;
}

export interface Question {
  id: string;
  category: Category;
  difficulty: number;
  question: string;
  answers: string[];
  correctIndex: number;
}

export interface NotQuestion {
  id: string;
  answers: string[];
}

export type Category = "film" | "science" | "general" | "history";

export type GameMode = "local" | "online";

export interface AnswerResult {
  selectedIndex: number;
  correctIndex: number;
  wasCorrect: boolean;
}

export interface GameState {
  questionsLoaded: boolean;
  questions: Question[];
  players: Player[];
  maxPlayers: number;
  minPlayers: number;
  currentPlayerIndex: number;
  activeQuestion: Question | null;
  pendingMove: number;
  pendingCategory: Category | null;
  isTurnLocked: boolean;
  usedQuestionIds: Set<string>;
  debugMode: boolean;
  gameMode: GameMode;
  showWinModal: boolean;
  showQuestionModal: boolean;
  showCultureModal: boolean;
  showNotModal: boolean;
  showEditor: boolean;
  showSettings: boolean;
  showWelcome: boolean;
  answerResult: AnswerResult | null;
  cultureTimerStartedAt: number | null;
  cultureScore: number | null;
  notTimerStartedAt: number | null;
  notScore: number | null;
  currentNotCard: NotQuestion | null;
}

export interface OnlineIdentity {
  roomCode: string;
  playerId: string;
  playerName: string;
}

export interface RoomData {
  createdAt?: number;
  players: Record<string, { id: string; name: string; position: number }>;
  playerOrder: string[];
  currentPlayerIndex: number;
  currentRoll: { value: number; id: number } | null;
  currentQuestion: string | null;
  answerResult: {
    selectedIndex: number;
    correctIndex: number;
    wasCorrect: boolean;
  } | null;
  gameState: "waiting" | "playing";
  resetId?: number;
  cultureEvent: { active: boolean; timerStartedAt?: number; score?: number } | null;
  notEvent: { active: boolean; timerStartedAt?: number; score?: number; question?: { id: string; answers: string[] } } | null;
}

export type GameAction =
  | { type: "ADD_PLAYER" }
  | { type: "REMOVE_PLAYER" }
  | { type: "RENAME_PLAYER"; playerId: number; name: string }
  | { type: "ADVANCE_TURN" }
  | { type: "LOCK_TURN" }
  | { type: "UNLOCK_TURN" }
  | { type: "SET_ACTIVE_QUESTION"; question: Question; roll: number }
  | { type: "CLEAR_QUESTION" }
  | { type: "MOVE_PLAYER"; playerId: number; steps: number }
  | { type: "SET_PLAYER_POSITION"; playerId: number; position: number }
  | { type: "MARK_QUESTION_USED"; questionId: string }
  | { type: "CLEAR_USED_QUESTIONS"; questionIds: string[] }
  | { type: "TOGGLE_DEBUG" }
  | { type: "SET_GAME_MODE"; mode: GameMode }
  | { type: "RESET_GAME" }
  | { type: "SET_QUESTIONS"; questions: Question[] }
  | { type: "SHOW_WIN_MODAL"; show: boolean }
  | { type: "SHOW_QUESTION_MODAL"; show: boolean }
  | { type: "SHOW_EDITOR"; show: boolean }
  | { type: "SHOW_SETTINGS"; show: boolean }
  | { type: "SET_PENDING_CATEGORY"; category: Category }
  | {
      type: "SYNC_ONLINE_STATE";
      players: Player[];
      currentPlayerIndex: number;
    }
  | { type: "SET_ANSWER_RESULT"; result: AnswerResult | null }
  | { type: "SHOW_CULTURE_MODAL"; show: boolean }
  | { type: "SET_CULTURE_TIMER_START"; startedAt: number | null }
  | { type: "SET_CULTURE_SCORE"; score: number | null }
  | { type: "SHOW_NOT_MODAL"; show: boolean }
  | { type: "SET_NOT_TIMER_START"; startedAt: number | null }
  | { type: "SET_NOT_SCORE"; score: number | null }
  | { type: "SET_NOT_CARD"; card: NotQuestion | null }
  | { type: "DISMISS_WELCOME" };
