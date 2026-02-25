import type { Category } from "../types/game";

export const SPIRAL_PATH = [
  0, 1, 2, 3, 4, 5, 6, 13, 20, 27, 34, 41, 48, 47, 46, 45, 44, 43, 42, 35,
  28, 21, 14, 7, 8, 9, 10, 11, 12, 19, 26, 33, 40, 39, 38, 37, 36, 29, 22,
  15,
];

export const MAX_POSITION = SPIRAL_PATH.length - 1; // 39 → index 38 is FINISH

export const CATEGORIES: Category[] = ["film", "science", "general", "history"];

export const CATEGORY_LABELS: Record<Category, string> = {
  film: "Film & TV",
  science: "Science & Technology",
  general: "General Knowledge",
  history: "History & Arts",
};

export const PLAYER_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#3b82f6",
  3: "#eab308",
  4: "#f715e8",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  film: "#800080",
  science: "#4682b4",
  general: "#008000",
  history: "#ffa500",
};

export const CATEGORY_TEXT_COLORS: Record<Category, string> = {
  film: "text-cat-film",
  science: "text-cat-science",
  general: "text-cat-general",
  history: "text-cat-history",
};

export const CATEGORY_BG_COLORS: Record<Category, string> = {
  film: "bg-cat-film",
  science: "bg-cat-science",
  general: "bg-cat-general",
  history: "bg-cat-history",
};

export const MOVE_DURATION = 500;

export const GRID_SIZE = 7;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
