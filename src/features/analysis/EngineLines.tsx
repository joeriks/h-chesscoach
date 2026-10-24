import type { Chess } from "chessops/chess";
import { formatScore, numberedLine, pvToSan } from "../../lib/chess";
import type { AnalysisUpdate } from "../../lib/ipc";

interface EngineLinesProps {
  pos: Chess;
  engineOn: boolean;
  onToggle: () => void;
  engineName: string | null;
  notice: string | null;
  update: AnalysisUpdate | null;
  status: "checkmate" | "stalemate" | null;
  /** Plays the first move of a line on the board (the user exploring, not the engine playing). */
  onPlay: (uci: string) => void;
}

function formatNps(nps: number): string {
  return nps >= 1e6 ? `${(nps / 1e6).toFixed(1)} MN/s` : `${Math.round(nps / 1e3)} kN/s`;
}

export function EngineLines({
  pos,
  engineOn,
  onToggle,
  engineName,
  notice,
  update,
  status,
  onPlay,
}: EngineLinesProps) {
  return (
    <section className="space-y-2" aria-label="Engine">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={engineOn}
          onClick={onToggle}
          title="Engine on/off (Space)"
          className={`relative h-5 w-9 rounded-full transition-colors ${
            engineOn ? "bg-emerald-600" : "bg-neutral-700"
          }`}
        >
          <span
            className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              engineOn ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-sm font-semibold">{engineName ?? "Stockfish"}</span>
        {engineOn && update && update.lines.length > 0 && (
          <span className="ml-auto text-xs text-neutral-400" data-testid="engine-depth">
            depth {update.depth} · {formatNps(update.nps)}
          </span>
        )}
      </div>
      {notice && <p className="text-xs text-amber-400">{notice}</p>}
      {!engineOn ? (
        <p className="text-sm text-neutral-500">Engine off.</p>
      ) : status ? (
        <p className="text-sm text-neutral-300">
          {status === "checkmate" ? "Checkmate." : "Stalemate."}
        </p>
      ) : !update || update.lines.length === 0 ? (
        <p className="text-sm text-neutral-500">Thinking…</p>
      ) : (
        <ol className="space-y-1" data-testid="engine-lines">
          {update.lines.map((line) => (
            <li key={line.multipv} className="flex gap-2 text-sm leading-snug">
              <button
                type="button"
                onClick={() => line.pv[0] && onPlay(line.pv[0])}
                title="Play this move on the board"
                className="w-14 shrink-0 rounded bg-neutral-800 px-1 text-center font-mono text-xs leading-6 hover:bg-neutral-700"
              >
                {formatScore(line.score)}
              </button>
              <span className="min-w-0 truncate text-neutral-300">
                {numberedLine(pos, pvToSan(pos, line.pv))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
