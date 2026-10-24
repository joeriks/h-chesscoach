import { useMemo } from "react";
import { numberMoves, parseFenSafe } from "../../lib/chess";

export interface MoveMark {
  /** Shown after the move, e.g. "??". */
  text: string;
  /** Tailwind text colour class for the mark and the move. */
  tone: string;
}

interface MoveListProps {
  rootFen: string;
  sans: string[];
  ply: number;
  onSelect: (ply: number) => void;
  /** Optional annotations by ply (1-based), from the game analysis. */
  marks?: Map<number, MoveMark>;
}

export function MoveList({ rootFen, sans, ply, onSelect, marks }: MoveListProps) {
  const items = useMemo(() => {
    const parsed = parseFenSafe(rootFen);
    return parsed.ok
      ? numberMoves(sans, parsed.pos.fullmoves, parsed.pos.turn === "white")
      : numberMoves(sans, 1, true);
  }, [rootFen, sans]);

  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">Make a move on the board.</p>;
  }

  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-0.5 text-sm" aria-label="Moves">
      {items.map((item, i) => {
        const mark = marks?.get(i + 1);
        return (
          <li key={i} className="flex">
            {item.number && <span className="mr-0.5 text-neutral-500">{item.number}</span>}
            <button
              type="button"
              onClick={() => onSelect(i + 1)}
              aria-current={i + 1 === ply ? "step" : undefined}
              className={`rounded px-1 ${
                i + 1 === ply
                  ? "bg-emerald-700 text-white"
                  : `hover:bg-neutral-800 ${mark?.tone ?? ""}`
              }`}
            >
              {item.san}
              {mark && <span className="ml-0.5 font-semibold">{mark.text}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
