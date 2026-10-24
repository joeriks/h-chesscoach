import { useState } from "react";

export interface Series {
  key: string;
  label: string;
  color: string;
  /** One value per x label; null where there is no data. */
  values: (number | null)[];
}

interface LineChartProps {
  labels: string[];
  series: Series[];
  min: number;
  max: number;
  /** Horizontal guide, e.g. the "as expected" line. */
  guide?: { value: number; label: string };
  format?: (v: number) => string;
  title: string;
}

const W = 640;
const H = 220;
const PAD = { l: 36, r: 64, t: 12, b: 24 };

/** A small line chart: fixed series colours, legend and end labels, hover tooltip. */
export function LineChart({
  labels,
  series,
  min,
  max,
  guide,
  format = (v) => `${Math.round(v)}`,
  title,
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const path = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const hasData = series.some((s) => s.values.some((v) => v !== null));
  if (!hasData) {
    return <p className="text-sm text-neutral-500">{title}: no data in the last 12 months yet.</p>;
  }
  return (
    <figure className="space-y-1" data-testid={`chart-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <figcaption className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
        <span className="font-semibold uppercase tracking-wide">{title}</span>
        {series.length > 1 &&
          series.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-3xl rounded bg-neutral-900"
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const v = min + t * (max - min);
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#262626" />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#737373">
                {format(v)}
              </text>
            </g>
          );
        })}
        {guide && (
          <g>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(guide.value)}
              y2={y(guide.value)}
              stroke="#525252"
              strokeDasharray="3 3"
            />
            <text x={W - PAD.r + 4} y={y(guide.value) + 3} fontSize={9} fill="#737373">
              {guide.label}
            </text>
          </g>
        )}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="#737373">
            {l.slice(5)}
          </text>
        ))}
        {series.map((s) => {
          const lastIdx = s.values
            .map((v, i) => (v === null ? -1 : i))
            .filter((i) => i >= 0)
            .pop();
          return (
            <g key={s.key}>
              <path
                d={path(s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(v)}
                    r={hover === i ? 4 : 2.5}
                    fill={s.color}
                    stroke="#171717"
                    strokeWidth={1}
                  />
                ),
              )}
              {lastIdx !== undefined && s.values[lastIdx] !== null && (
                <text x={x(lastIdx) + 6} y={y(s.values[lastIdx]!) + 3} fontSize={10} fill="#d4d4d4">
                  {format(s.values[lastIdx]!)}
                </text>
              )}
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#525252" />
            <rect
              x={Math.min(x(hover) + 8, W - 150)}
              y={PAD.t}
              width={142}
              height={14 + 12 * series.length}
              rx={3}
              fill="#262626"
            />
            <text x={Math.min(x(hover) + 14, W - 144)} y={PAD.t + 11} fontSize={9} fill="#e5e5e5">
              {labels[hover]}
            </text>
            {series.map((s, k) => (
              <text
                key={s.key}
                x={Math.min(x(hover) + 14, W - 144)}
                y={PAD.t + 23 + 12 * k}
                fontSize={9}
                fill="#d4d4d4"
              >
                {s.label}: {s.values[hover] === null ? "–" : format(s.values[hover]!)}
              </text>
            ))}
          </g>
        )}
      </svg>
    </figure>
  );
}
