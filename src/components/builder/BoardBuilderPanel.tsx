import { useState, useEffect, useRef } from "react";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { TextureButton } from "../ui/TextureButton";
import { saveBoard, loadBoard, buildDefaultTiles } from "../../firebase/boardService";
import { LS_BOARD_CODE, MIN_BOARD_TILES, MAX_BOARD_TILES, CATEGORY_COLORS } from "../../lib/constants";
import type { TileType, CustomBoardConfig } from "../../types/game";

// Cycle order for clicking through tile types
const CYCLE_ORDER: TileType[] = ["film", "science", "general", "history", "sports", "not", "culture"];

const TILE_LABELS: Record<TileType, string> = {
  film: "Film",
  science: "Sci",
  general: "Gen",
  history: "Hist",
  sports: "Sport",
  not: "NOT",
  culture: "CULTURE",
  start: "START",
  finish: "FINISH",
};

const TILE_COLORS: Record<TileType, string> = {
  film: CATEGORY_COLORS.film,
  science: CATEGORY_COLORS.science,
  general: CATEGORY_COLORS.general,
  history: CATEGORY_COLORS.history,
  sports: CATEGORY_COLORS.sports,
  not: "#d97706",   // amber
  culture: "#0d9488", // teal
  start: "#6b7280",  // grey
  finish: "#6b7280", // grey
};

export default function BoardBuilderPanel() {
  const state = useGame();
  const dispatch = useGameDispatch();

  const config = state.customBoardConfig;

  // Local editing state
  const [boardName, setBoardName] = useState(config?.name ?? "My Board");
  const [totalTiles, setTotalTiles] = useState(config?.totalTiles ?? 20);
  const [tiles, setTiles] = useState<TileType[]>(
    config?.tiles ?? buildDefaultTiles(20)
  );

  // Load/save UI state
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [loadCodeInput, setLoadCodeInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "notfound" | "expired" | "ok">("idle");
  const [copied, setCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync local state from global config when it changes externally (e.g. loaded board)
  useEffect(() => {
    if (config) {
      setBoardName(config.name);
      setTotalTiles(config.totalTiles);
      setTiles([...config.tiles]);
      setSavedCode(config.id);
    }
  }, [config]);

  // On mount, pre-fill the load input with the last saved code as a convenience
  // (the user must explicitly click Load to apply it — no auto-restore)
  useEffect(() => {
    const lastCode = localStorage.getItem(LS_BOARD_CODE);
    if (lastCode && !config) {
      setLoadCodeInput(lastCode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTotalTilesChange(n: number) {
    const clamped = Math.max(MIN_BOARD_TILES, Math.min(MAX_BOARD_TILES, n));
    setTotalTiles(clamped);

    // Pad or trim tiles
    if (clamped > tiles.length) {
      // Rebuild for the new length, preserving user's existing assignments
      const newTiles = buildDefaultTiles(clamped);
      for (let i = 1; i < tiles.length - 1 && i < clamped - 1; i++) {
        newTiles[i] = tiles[i];
      }
      setTiles(newTiles);
    } else if (clamped < tiles.length) {
      const newTiles = tiles.slice(0, clamped);
      newTiles[clamped - 1] = "finish";
      setTiles(newTiles);
    }
  }

  function cycleTile(index: number) {
    // start and finish can't be changed
    if (index === 0 || index === totalTiles - 1) return;
    const current = tiles[index];
    const idx = CYCLE_ORDER.indexOf(current as TileType);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
    const newTiles = [...tiles];
    newTiles[index] = next;
    setTiles(newTiles);
    dispatch({ type: "SET_TILE_TYPE", index, tileType: next });
  }

  async function handleSave() {
    setSaveStatus("saving");
    try {
      const code = await saveBoard({ name: boardName, totalTiles, tiles });
      setSavedCode(code);
      localStorage.setItem(LS_BOARD_CODE, code);

      const fullConfig: CustomBoardConfig = {
        id: code,
        createdAt: Date.now(),
        name: boardName,
        totalTiles,
        tiles,
      };
      dispatch({ type: "SET_CUSTOM_BOARD_CONFIG", config: fullConfig });
      // After dispatching, re-apply local tile state (dispatch resets positions only, not config)
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  async function handleLoad() {
    const code = loadCodeInput.trim().toUpperCase();
    if (!code) return;
    setLoadStatus("loading");
    try {
      const loaded = await loadBoard(code);
      if (!loaded) {
        setLoadStatus("notfound");
        setTimeout(() => setLoadStatus("idle"), 3000);
        return;
      }
      dispatch({ type: "SET_CUSTOM_BOARD_CONFIG", config: loaded });
      localStorage.setItem(LS_BOARD_CODE, code);
      setSavedCode(code);
      setLoadCodeInput("");
      setLoadStatus("ok");
      setTimeout(() => setLoadStatus("idle"), 2000);
    } catch {
      setLoadStatus("notfound");
      setTimeout(() => setLoadStatus("idle"), 3000);
    }
  }

  function handleClear() {
    dispatch({ type: "SET_CUSTOM_BOARD_CONFIG", config: null });
    localStorage.removeItem(LS_BOARD_CODE);
    setSavedCode(null);
    setBoardName("My Board");
    const defaultCount = 20;
    setTotalTiles(defaultCount);
    setTiles(buildDefaultTiles(defaultCount));
    setSaveStatus("idle");
  }

  function handleCopyCode() {
    if (!savedCode) return;
    navigator.clipboard.writeText(savedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isApplied = !!state.customBoardConfig;

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold opacity-60 uppercase tracking-widest">Board Builder</span>
        {isApplied && (
          <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs text-success font-semibold">Active</span>
        )}
      </div>

      {/* Name + tile count */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/40 flex-1 min-w-0"
          placeholder="Board name"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs opacity-60">Tiles:</label>
          <input
            type="number"
            min={MIN_BOARD_TILES}
            max={MAX_BOARD_TILES}
            value={totalTiles}
            onChange={(e) => handleTotalTilesChange(Number(e.target.value))}
            className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white text-center"
          />
          <input
            type="range"
            min={MIN_BOARD_TILES}
            max={MAX_BOARD_TILES}
            value={totalTiles}
            onChange={(e) => handleTotalTilesChange(Number(e.target.value))}
            className="w-24 accent-fuchsia-500"
          />
        </div>
      </div>

      {/* Tile editor — horizontal scroll */}
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto pb-2 pt-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {tiles.map((tileType, i) => {
          const isEdge = i === 0 || i === totalTiles - 1;
          return (
            <button
              key={i}
              onClick={() => cycleTile(i)}
              title={isEdge ? undefined : "Click to cycle tile type"}
              disabled={isEdge}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-white transition-opacity"
              style={{
                backgroundColor: TILE_COLORS[tileType],
                opacity: isEdge ? 0.6 : 1,
                cursor: isEdge ? "default" : "pointer",
                minWidth: "42px",
              }}
            >
              <span className="text-[10px] opacity-60">{i}</span>
              <span>{TILE_LABELS[tileType]}</span>
            </button>
          );
        })}
      </div>

      {/* Save / Load / Clear row */}
      <div className="flex flex-wrap gap-2 items-center">
        <TextureButton
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Error" : "Save Board"}
        </TextureButton>

        {savedCode && (
          <button
            onClick={handleCopyCode}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-mono font-semibold text-white hover:bg-white/20 transition-colors"
          >
            {copied ? "Copied!" : `Code: ${savedCode}`}
          </button>
        )}

        <TextureButton size="sm" variant="danger" onClick={handleClear} disabled={!isApplied && !savedCode}>
          Clear
        </TextureButton>
      </div>

      {/* Load a code */}
      <div className="flex gap-2 items-center">
        <input
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/40 w-28 font-mono uppercase"
          placeholder="Board code"
          value={loadCodeInput}
          onChange={(e) => setLoadCodeInput(e.target.value.toUpperCase())}
          maxLength={4}
        />
        <TextureButton size="sm" onClick={handleLoad} disabled={loadStatus === "loading" || !loadCodeInput.trim()}>
          {loadStatus === "loading" ? "Loading…" : loadStatus === "ok" ? "Loaded!" : loadStatus === "notfound" ? "Not found" : "Load"}
        </TextureButton>
      </div>
    </div>
  );
}
