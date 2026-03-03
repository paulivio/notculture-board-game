import { useState, useEffect } from "react";
import { useGame, useGameDispatch } from "../../context/GameContext";
import { useBuilder } from "../../context/BuilderContext";
import { TextureButton } from "../ui/TextureButton";
import { saveBoard, loadBoard, buildDefaultTiles, resolveAutoTiles } from "../../firebase/boardService";
import { LS_BOARD_CODE, MIN_BOARD_TILES, MAX_BOARD_TILES, CATEGORY_COLORS, CULTURE_POSITIONS, NOT_POSITIONS } from "../../lib/constants";
import type { TileType, CustomBoardConfig } from "../../types/game";
import { cn } from "../../lib/utils";

const PALETTE_TILES: { type: TileType; label: string; color: string }[] = [
  { type: "film",    label: "Film",    color: CATEGORY_COLORS.film },
  { type: "science", label: "Sci",     color: CATEGORY_COLORS.science },
  { type: "general", label: "Gen",     color: CATEGORY_COLORS.general },
  { type: "history", label: "Hist",    color: CATEGORY_COLORS.history },
  { type: "sports",  label: "Sport",   color: CATEGORY_COLORS.sports },
  { type: "not",     label: "NOT",     color: "#d97706" },
  { type: "culture", label: "CULTURE", color: "#c026d3" },
  { type: "auto",    label: "⌫ Blank", color: "#52525b" },
];

interface PaletteChipProps {
  tileType: TileType;
  label: string;
  color: string;
  selected: boolean;
  onSelect: (type: TileType) => void;
}

function PaletteChip({ tileType, label, color, selected, onSelect }: PaletteChipProps) {
  return (
    <button
      onClick={() => onSelect(tileType)}
      style={{ backgroundColor: color }}
      className={cn(
        "flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white select-none transition-all",
        selected ? "ring-2 ring-white ring-offset-1 ring-offset-black scale-105" : "opacity-80 hover:opacity-100"
      )}
    >
      {label}
    </button>
  );
}

export default function BoardBuilderPanel() {
  const state = useGame();
  const dispatch = useGameDispatch();
  const { selectedTileType, setSelectedTileType } = useBuilder();

  const previewConfig = state.boardPreviewConfig;
  const appliedConfig = state.customBoardConfig;

  // Local UI state
  const [boardName, setBoardName] = useState(appliedConfig?.name ?? "My Board");
  const [totalTiles, setTotalTiles] = useState(appliedConfig?.totalTiles ?? 20);
  // Separate display value for the number input so the user can type freely;
  // the actual clamped value is applied on blur or Enter.
  const [tileInputValue, setTileInputValue] = useState(String(appliedConfig?.totalTiles ?? 20));

  // Load/save UI state
  const [savedCode, setSavedCode] = useState<string | null>(appliedConfig?.id ?? null);
  const [loadCodeInput, setLoadCodeInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "notfound" | "expired" | "ok">("idle");
  const [copied, setCopied] = useState(false);

  // On mount: initialise preview from applied config or fresh defaults
  useEffect(() => {
    const source = appliedConfig;
    const initTiles = source ? [...source.tiles] : buildDefaultTiles(totalTiles);
    const initCount = source?.totalTiles ?? totalTiles;
    const initName  = source?.name ?? boardName;

    setBoardName(initName);
    setTotalTiles(initCount);
    setTileInputValue(String(initCount));
    setSavedCode(source?.id ?? null);

    dispatch({
      type: "SET_BOARD_PREVIEW_CONFIG",
      config: {
        id: source?.id ?? "",
        createdAt: source?.createdAt ?? Date.now(),
        name: initName,
        totalTiles: initCount,
        tiles: initTiles,
      },
    });

    // Pre-fill load input with last saved code as a convenience
    const lastCode = localStorage.getItem(LS_BOARD_CODE);
    if (lastCode && !source) {
      setLoadCodeInput(lastCode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync name into preview whenever boardName changes
  useEffect(() => {
    if (!previewConfig) return;
    dispatch({
      type: "SET_BOARD_PREVIEW_CONFIG",
      config: { ...previewConfig, name: boardName },
    });
  }, [boardName]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTotalTilesChange(n: number) {
    const clamped = Math.max(MIN_BOARD_TILES, Math.min(MAX_BOARD_TILES, n));
    setTotalTiles(clamped);
    // Note: callers that need to sync tileInputValue do so explicitly

    if (!previewConfig) return;
    const current = previewConfig.tiles;

    let newTiles: TileType[];
    if (clamped > current.length) {
      // Extend: add "auto" tiles, preserve existing assignments
      newTiles = [...current, ...Array(clamped - current.length).fill("auto" as TileType)];
      // The old FINISH tile is now a middle tile — reset it to "auto"
      newTiles[current.length - 1] = "auto";
    } else {
      newTiles = current.slice(0, clamped);
    }
    // Always clamp START/FINISH
    newTiles[0] = "start";
    newTiles[clamped - 1] = "finish";

    dispatch({
      type: "SET_BOARD_PREVIEW_CONFIG",
      config: { ...previewConfig, totalTiles: clamped, tiles: newTiles, name: boardName },
    });
  }

  async function handleSave() {
    if (!previewConfig) return;
    setSaveStatus("saving");
    try {
      // Resolve "auto" tiles before saving — stored boards never contain "auto"
      const resolvedTiles = resolveAutoTiles(previewConfig.tiles, state.activeCategories);
      const code = await saveBoard({ name: boardName, totalTiles: previewConfig.totalTiles, tiles: resolvedTiles });
      setSavedCode(code);
      localStorage.setItem(LS_BOARD_CODE, code);

      const fullConfig: CustomBoardConfig = {
        id: code,
        createdAt: Date.now(),
        name: boardName,
        totalTiles: previewConfig.totalTiles,
        tiles: resolvedTiles,
      };
      dispatch({ type: "SET_CUSTOM_BOARD_CONFIG", config: fullConfig });
      // Keep preview in sync with the resolved config
      dispatch({ type: "SET_BOARD_PREVIEW_CONFIG", config: fullConfig });
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
      dispatch({ type: "SET_BOARD_PREVIEW_CONFIG", config: loaded });
      localStorage.setItem(LS_BOARD_CODE, code);
      setBoardName(loaded.name);
      setTotalTiles(loaded.totalTiles);
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
    dispatch({ type: "SET_BOARD_PREVIEW_CONFIG", config: null });
    localStorage.removeItem(LS_BOARD_CODE);
    setSavedCode(null);
    setBoardName("My Board");
    const defaultCount = 20;
    setTotalTiles(defaultCount);
    // Re-initialise preview with fresh defaults
    dispatch({
      type: "SET_BOARD_PREVIEW_CONFIG",
      config: {
        id: "",
        createdAt: Date.now(),
        name: "My Board",
        totalTiles: defaultCount,
        tiles: buildDefaultTiles(defaultCount),
      },
    });
    setSaveStatus("idle");
  }

  function handleAutoFill() {
    if (!previewConfig) return;
    const newTiles: TileType[] = previewConfig.tiles.map((_, i) => {
      if (i === 0) return "start";
      if (i === previewConfig.totalTiles - 1) return "finish";
      if (CULTURE_POSITIONS.has(i)) return "culture";
      if (NOT_POSITIONS.has(i)) return "not";
      return state.activeCategories[i % state.activeCategories.length];
    });
    dispatch({ type: "SET_BOARD_PREVIEW_CONFIG", config: { ...previewConfig, tiles: newTiles } });
  }

  function handleCopyCode() {
    if (!savedCode) return;
    navigator.clipboard.writeText(savedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isApplied = !!appliedConfig;

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
            value={tileInputValue}
            onChange={(e) => {
              const raw = e.target.value;
              setTileInputValue(raw);
              // Arrow buttons always produce a valid in-range integer → live update
              const n = parseInt(raw, 10);
              if (!isNaN(n) && n >= MIN_BOARD_TILES && n <= MAX_BOARD_TILES) {
                handleTotalTilesChange(n);
              }
            }}
            onBlur={() => {
              const clamped = Math.max(MIN_BOARD_TILES, Math.min(MAX_BOARD_TILES, parseInt(tileInputValue, 10) || MIN_BOARD_TILES));
              handleTotalTilesChange(clamped);
              setTileInputValue(String(clamped));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const clamped = Math.max(MIN_BOARD_TILES, Math.min(MAX_BOARD_TILES, parseInt(tileInputValue, 10) || MIN_BOARD_TILES));
                handleTotalTilesChange(clamped);
                setTileInputValue(String(clamped));
              }
            }}
            className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white text-center"
          />
          <input
            type="range"
            min={MIN_BOARD_TILES}
            max={MAX_BOARD_TILES}
            value={totalTiles}
            onChange={(e) => {
              const n = Number(e.target.value);
              handleTotalTilesChange(n);
              setTileInputValue(String(Math.max(MIN_BOARD_TILES, Math.min(MAX_BOARD_TILES, n))));
            }}
            className="w-24 accent-fuchsia-500"
          />
        </div>
      </div>

      {/* Tile palette — click chip to select, then click a board tile to apply */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs opacity-50">
            {selectedTileType
              ? `Painting: click a board tile to apply`
              : "Select a tile type, then click a board tile:"}
          </p>
          <TextureButton size="sm" onClick={handleAutoFill} disabled={!previewConfig}>
            Auto Fill
          </TextureButton>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE_TILES.map((chip) => (
            <PaletteChip
              key={chip.type}
              tileType={chip.type}
              label={chip.label}
              color={chip.color}
              selected={selectedTileType === chip.type}
              onSelect={(type) => setSelectedTileType(selectedTileType === type ? null : type)}
            />
          ))}
        </div>
      </div>

      {/* Save / Load / Clear row */}
      <div className="flex flex-wrap gap-2 items-center">
        <TextureButton
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={saveStatus === "saving" || !previewConfig}
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
