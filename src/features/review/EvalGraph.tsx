import { useMemo } from "react";
import type { GamePly } from "../../lib/ipc";
import { whiteWinAfter } from "./reviewText";

interface EvalGraphProps {
  plies: GamePly[];
  ply: number;
  onSelect: (ply: number) => void;
  /** Plies to mark (findings). */
  marks?: number[];
}

const W = 320;
const H = 96;

/** White's win probability over the game. Click a point to jump there. */
export function EvalGraph({ plies, ply, onSelect, marks = [] }: EvalGraphProps) {
  const points = useMemo(() => {
    const out: { ply: number; x: number; y: number }[] = [{ ply: 0, x: 0, y: H / 2 }];
    const n = plies.length;
    for (let i = 1; i <= n; i++) {
      const w = whiteWinAfter(plies, i);
      if (w === null) continue;
      out.push({ ply: i, x: (i / n) * W, y: H - (w / 100) * H });
    }
    return out;
  }, [plies]);

  if (points.length < 2) return null;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${points[points.length - 1]!.x.toFixed(1)},${H} L0,${H} Z`;
  const current = points.find((p) => p.ply === ply);
  const n = plies.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-24 w-full rounded bg-neutral-800"
      role="img"
      aria-label="Evaluation graph"
      data-testid="eval-graph"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * W;
        onSelect(Math.max(0, Math.min(n, Math.round((x / W) * n))));
      }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#262626" />
      <path d={area} fill="#e5e5e5" />
      <path d={path} fill="none" stroke="#a3a3a3" strokeWidth={1} />
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#525252" strokeDasharray="2 2" />
      {marks.map((m) => {
        const p = points.find((q) => q.ply === m);
        return p ? <circle key={m} cx={p.x} cy={p.y} r={3} fill="#f87171" /> : null;
      })}
      {current && (
        <line x1={current.x} y1={0} x2={current.x} y2={H} stroke="#34d399" strokeWidth={1.5} />
      )}
    </svg>
  );
}
