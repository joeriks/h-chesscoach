import type { Color } from "./Board";

interface EvalBarProps {
  /** White's win probability, 0–100; `null` while there is no evaluation. */
  winWhite: number | null;
  label: string;
  orientation: Color;
}

/** Vertical bar: the white part grows with White's win probability. */
export function EvalBar({ winWhite, label, orientation }: EvalBarProps) {
  const white = winWhite ?? 50;
  const whiteAtBottom = orientation === "white";
  return (
    <div
      className="relative h-full w-8 shrink-0 overflow-hidden rounded bg-neutral-700"
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-valuetext={label}
      data-testid="eval-bar"
    >
      <div
        className={`absolute inset-x-0 bg-neutral-100 transition-[height] duration-300 ${
          whiteAtBottom ? "bottom-0" : "top-0"
        }`}
        style={{ height: `${white}%` }}
      />
      <div
        className={`absolute inset-x-0 text-center text-[10px] font-semibold ${
          white >= 50 === whiteAtBottom ? "bottom-1 text-neutral-800" : "top-1 text-neutral-200"
        }`}
      >
        {label}
      </div>
    </div>
  );
}
