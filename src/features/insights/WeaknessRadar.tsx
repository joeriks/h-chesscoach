import type { ThemeWeakness } from "../../lib/ipc";
import { themeLabel } from "../puzzles/puzzleLogic";

interface WeaknessRadarProps {
  themes: ThemeWeakness[];
}

const SIZE = 280;
const R = 100;
const CX = SIZE / 2;
const CY = SIZE / 2;

/** Miss rate per theme on a radar; a bigger shape means more missed tactics. */
export function WeaknessRadar({ themes }: WeaknessRadarProps) {
  const axes = themes.slice(0, 8);
  if (axes.length < 3) return null;
  const angle = (i: number) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const point = (i: number, r: number) =>
    [CX + r * Math.cos(angle(i)), CY + r * Math.sin(angle(i))] as const;
  const shape = axes
    .map((t, i) => point(i, R * Math.max(0.05, t.missRate)))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-72 w-72"
      role="img"
      aria-label="Weakness radar"
      data-testid="weakness-radar"
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={axes.map((_, i) => point(i, R * f).join(",")).join(" ")}
          fill="none"
          stroke="#404040"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#404040" strokeWidth={1} />;
      })}
      <polygon points={shape} fill="rgba(248,113,113,0.35)" stroke="#f87171" strokeWidth={1.5} />
      {axes.map((t, i) => {
        const [x, y] = point(i, R + 22);
        return (
          <text
            key={t.theme}
            x={x}
            y={y}
            fontSize={10}
            fill="#d4d4d4"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {themeLabel(t.theme)}
          </text>
        );
      })}
    </svg>
  );
}
