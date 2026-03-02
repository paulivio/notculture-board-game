import { ref, set, get } from "firebase/database";
import { db } from "./config";
import { BOARD_TTL_MS } from "../lib/constants";
import type { CustomBoardConfig, TileType, Category } from "../types/game";

function generateBoardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit 0/O, 1/I for readability
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function saveBoard(
  config: Omit<CustomBoardConfig, "id" | "createdAt">
): Promise<string> {
  let code = generateBoardCode();

  // Retry if code already exists (collision)
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await get(ref(db, `customBoards/${code}`));
    if (!existing.exists()) break;
    code = generateBoardCode();
  }

  const fullConfig: CustomBoardConfig = {
    ...config,
    id: code,
    createdAt: Date.now(),
  };

  await set(ref(db, `customBoards/${code}`), fullConfig);
  return code;
}

export async function loadBoard(code: string): Promise<CustomBoardConfig | null> {
  const boardRef = ref(db, `customBoards/${code}`);
  const snapshot = await get(boardRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.val() as CustomBoardConfig;

  // Check TTL — delete and return null if expired
  if (data.createdAt && Date.now() - data.createdAt > BOARD_TTL_MS) {
    await set(boardRef, null);
    return null;
  }

  // Validate tiles array
  if (!Array.isArray(data.tiles) || data.tiles.length !== data.totalTiles) {
    return null;
  }

  return data;
}

// Helper: build a default tiles array for a given tile count
// All intermediate tiles are "auto" — fall back to cycling category at play-time
export function buildDefaultTiles(totalTiles: number): TileType[] {
  const tiles: TileType[] = Array(totalTiles).fill("auto");
  tiles[0] = "start";
  tiles[totalTiles - 1] = "finish";
  return tiles;
}

// Resolve "auto" tiles to their cycling category value before saving/applying
export function resolveAutoTiles(tiles: TileType[], categories: Category[]): TileType[] {
  return tiles.map((t, i) =>
    t === "auto" ? categories[i % categories.length] : t
  );
}
