import { useMemo } from "react";
import type { GamePly } from "../../lib/ipc";

interface ClockChartProps {
  plies: GamePly[];
  ply: number;
  onSelect: (ply: number) => void;
}

const W = 320;
const H = 48;

/** Time spent per move: White's bars up from the middle, Black's down. */
export function ClockChart({ plies, ply, onSelect }: ClockChartProps) {
  const bars = useMemo(() => {
    const spent = plies.map((p) => p.timeSpentMs ?? 0);
    const max = Math.max(1, ...spent);
    const n = plies.length;
    const bw = Math.max(1, W / n - 0.5);
    return plies.map((p, i) => {
      const h = ((p.timeSpentMs ?? 0) / max) * (H / 2 - 2);
      const white = i % 2 === 0;
      return {
        ply: p.ply,
        x: (i / n) * W,
        y: white ? H / 2 - h : H / 2,
        h,
        w: bw,
        fill: white ? "#e5e5e5" : "#737373",
      };
    });
  }, [plies]);

  if (!plies.some((p) => p.timeSpentMs !== null)) return null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-12 w-full rounded bg-neutral-800"
      role="img"
      aria-label="Time spent per move"
      data-testid="clock-chart"
    >
      {bars.map((b) => (
        <rect
          key={b.ply}
          x={b.x}
          y={b.y}
          width={b.w}
          height={Math.max(b.h, 0.5)}
          fill={b.ply === ply ? "#34d399" : b.fill}
          onClick={() => onSelect(b.ply)}
          className="cursor-pointer"
        />
      ))}
    </svg>
  );
}
