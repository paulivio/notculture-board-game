import type { Category } from "../types/game";

export const PLATFORMING_TEST_MODE = true;   // flip to false for production

export const SPIRAL_PATH = [
  // Outer ring (28 tiles)
  0, 1, 2, 3, 4, 5, 6, 7,           // top row →
  15, 23, 31, 39, 47, 55, 63,        // right col ↓
  62, 61, 60, 59, 58, 57, 56,        // bottom row ←
  48, 40, 32, 24, 16, 8,             // left col ↑
  // Second ring (20 tiles) — last tile is FINISH at path index 47
  9, 10, 11, 12, 13, 14,             // top row →
  22, 30, 38, 46, 54,                // right col ↓
  53, 52, 51, 50, 49,                // bottom row ←
  41, 33, 25, 17,                    // left col ↑ → FINISH
];

export const MAX_POSITION = SPIRAL_PATH.length - 1; // 48 tiles → index 47 is FINISH

export const CATEGORIES: Category[] = ["film", "science", "general", "history"];
export const ALL_CATEGORIES: Category[] = ["film", "science", "general", "history", "sports"];

export const CATEGORY_LABELS: Record<Category, string> = {
  film: "Film & TV",
  science: "Science & Technology",
  general: "General Knowledge",
  history: "History & Arts",
  sports: "Sports & Leisure",
};

export const PLAYER_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#3b82f6",
  3: "#eab308",
  4: "#f715e8",
};

export const PLAYER_COLOR_OPTIONS: string[] = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#14b8a6", // teal
  "#a855f7", // purple
  "#84cc16", // lime
];

export const CATEGORY_COLORS: Record<Category, string> = {
  film: "#800080",
  science: "#4682b4",
  general: "#008000",
  history: "#ffa500",
  sports: "#ef4444",
};

export const CATEGORY_TEXT_COLORS: Record<Category, string> = {
  film: "text-cat-film",
  science: "text-cat-science",
  general: "text-cat-general",
  history: "text-cat-history",
  sports: "text-cat-sports",
};

export const CATEGORY_BG_COLORS: Record<Category, string> = {
  film: "bg-cat-film",
  science: "bg-cat-science",
  general: "bg-cat-general",
  history: "bg-cat-history",
  sports: "bg-cat-sports",
};

export const CULTURE_POSITIONS = new Set([10, 20, 30, 40]);
export const CULTURE_TIMER_SECONDS = 30;

export const NOT_POSITIONS = new Set([5, 15, 25, 35, 45]);
export const NOT_TIMER_SECONDS = 30;

export const MOVE_DURATION = 1167;

export const LS_ROOM_CODE = "notculture_roomCode";
export const LS_PLAYER_ID = "notculture_playerId";
export const LS_PLAYER_NAME = "notculture_playerName";
export const LS_TEAM_ID = "notculture_teamId";
export const LS_TEAM_NAME = "notculture_teamName";
export const LS_BOARD_CODE = "notculture_boardCode";

export const BOARD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MIN_BOARD_TILES = 10;
export const MAX_BOARD_TILES = 48; // === MAX_POSITION + 1

export const GRID_SIZE = 8;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
