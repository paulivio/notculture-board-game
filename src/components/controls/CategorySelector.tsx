import { ALL_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS } from "../../lib/constants";
import type { Category } from "../../types/game";

interface CategorySelectorProps {
  value: Category[];
  onChange: (cats: Category[]) => void;
  locked: boolean;
}

export default function CategorySelector({ value, onChange, locked }: CategorySelectorProps) {
  function toggle(cat: Category) {
    if (locked) return;
    const isActive = value.includes(cat);
    if (isActive) {
      onChange(value.filter((c) => c !== cat));
    } else {
      if (value.length < 4) {
        onChange([...value, cat]);
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const isActive = value.includes(cat);
          const atMax = value.length >= 4;
          const disabled = locked || (!isActive && atMax);
          const color = CATEGORY_COLORS[cat];

          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              disabled={disabled}
              title={!isActive && atMax && !locked ? "Deselect one first" : undefined}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
              style={
                isActive
                  ? { backgroundColor: color, color: "#fff", opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }
                  : { backgroundColor: "transparent", color: "#aaa", border: `1.5px solid ${color}44`, opacity: disabled ? 0.4 : 0.7, cursor: disabled ? "not-allowed" : "pointer" }
              }
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>
      {locked && (
        <p className="text-xs text-gray-500">Categories locked</p>
      )}
      {!locked && value.length !== 4 && (
        <p className="text-xs text-yellow-400">Select exactly 4 categories</p>
      )}
    </div>
  );
}
