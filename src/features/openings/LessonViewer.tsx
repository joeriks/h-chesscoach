import { useMemo, useState } from "react";
import { Board } from "../../components/board/Board";
import type { Repertoire, RepertoireLine, TrendWarning } from "../../lib/ipc";
import { BOARD_SIZE } from "../puzzles/PuzzleSolver";
import { squaresOf } from "./useDrillBoard";
import { INITIAL_FEN, replay } from "../../lib/chess";
import { makeFen } from "chessops/fen";
import { ModelGames } from "./ModelGames";

/** A line played out on the board with the coach's note for each key position. */
export function LessonViewer({
  repertoires,
  initialLineKey,
  trends = [],
  withModelGames = false,
}: {
  repertoires: Repertoire[];
  initialLineKey: string | null;
  /** Moves elite players have largely abandoned (needs the Elite Database). */
  trends?: TrendWarning[];
  withModelGames?: boolean;
}) {
  const lines = useMemo(() => repertoires.flatMap((r) => r.lines), [repertoires]);
  const [lineKey, setLineKey] = useState<string | null>(initialLineKey ?? lines[0]?.key ?? null);
  const line: RepertoireLine | undefined = lines.find((l) => l.key === lineKey) ?? lines[0];
  // The step is kept per line, so switching lines starts from the initial position.
  const [step, setStep] = useState<{ key: string; ply: number }>({ key: "", ply: 0 });
  const ply = line && step.key === line.key ? step.ply : 0;
  const setPly = (next: number | ((p: number) => number)) =>
    setStep({ key: line?.key ?? "", ply: typeof next === "function" ? next(ply) : next });

  if (!line) return <p className="text-sm text-neutral-400">No repertoire lines to show.</p>;
  const fen = ply === 0 ? INITIAL_FEN : (line.moves[ply]?.fenBefore ?? lastFen(line));
  const current = ply > 0 ? line.moves[ply - 1] : undefined;
  const lastMove = current ? squaresOf(current.fenBefore, current.uci) : undefined;
  const note = current?.note ?? null;
  const repertoire = repertoires.find((r) => r.key === line.repertoire);
  const lineTrends = trends.filter((t) => t.lineKey === line.key);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-3">
          <div style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
            <Board fen={fen} orientation={line.color} lastMove={lastMove} />
          </div>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setPly(0)}
              className="rounded border border-neutral-700 px-2 py-1"
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => setPly((p) => Math.max(0, p - 1))}
              className="rounded border border-neutral-700 px-2 py-1"
              aria-label="Previous move"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => setPly((p) => Math.min(line.moves.length, p + 1))}
              className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600"
              aria-label="Next move"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={() => setPly(line.moves.length)}
              className="rounded border border-neutral-700 px-2 py-1"
            >
              End
            </button>
          </div>
          <p className="min-h-12 max-w-xl text-sm text-emerald-200" data-testid="lesson-note">
            {note ?? (ply === 0 ? repertoire?.summary : "")}
          </p>
        </div>
        <aside className="flex w-80 min-w-0 flex-col gap-4">
          <label className="block text-sm">
            <span className="text-neutral-400">Line</span>
            <select
              value={line.key}
              onChange={(e) => setLineKey(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              aria-label="Line"
            >
              {repertoires.map((r) => (
                <optgroup key={r.key} label={r.name}>
                  {r.lines.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <ol className="flex flex-wrap gap-x-1 gap-y-0.5 text-sm" aria-label="Line moves">
            {line.moves.map((m) => (
              <li key={m.ply}>
                {m.ply % 2 === 1 && (
                  <span className="text-neutral-500">{Math.ceil(m.ply / 2)}. </span>
                )}
                <button
                  type="button"
                  onClick={() => setPly(m.ply)}
                  aria-current={ply === m.ply ? "step" : undefined}
                  className={`rounded px-1 ${ply === m.ply ? "bg-neutral-800 text-white" : m.note ? "text-emerald-300" : "text-neutral-200"} hover:bg-neutral-800`}
                >
                  {m.san}
                </button>
              </li>
            ))}
          </ol>
          <p className="text-xs text-neutral-500">Moves in green carry a note.</p>
          {lineTrends.length > 0 && (
            <ul className="space-y-1 text-xs text-amber-300" aria-label="Trend warnings">
              {lineTrends.map((t) => (
                <li key={t.ply}>
                  ⚠ {Math.ceil(t.ply / 2)}
                  {t.ply % 2 === 1 ? "." : "…"} {t.san}: elite players have moved away from this
                  (from {Math.round(t.olderShare)}% to {Math.round(t.recentShare)}% of{" "}
                  {t.games.toLocaleString()} games in the last two years).
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      {withModelGames && <ModelGames lineKey={line.key} userColor={line.color} />}
    </div>
  );
}

/** The position after the last move of a line (only positions before moves are stored). */
function lastFen(line: RepertoireLine): string {
  const last = line.moves[line.moves.length - 1];
  if (!last) return INITIAL_FEN;
  try {
    return makeFen(replay(last.fenBefore, [last.uci]).pos.toSetup());
  } catch {
    return last.fenBefore;
  }
}
