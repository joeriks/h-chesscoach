import { useEffect, useState } from "react";
import { ipc, type AnalysisProgress, type Deviation, type GameDetail } from "../../lib/ipc";
import { requestPuzzles } from "../../lib/navigation";
import { ClockChart } from "./ClockChart";
import { EvalGraph } from "./EvalGraph";
import { keyMoments, moveLabel, trainableTheme } from "./reviewText";
import { puzzleFromFinding } from "./trainFromGame";
import { themeLabel } from "../puzzles/puzzleLogic";

interface ReviewPanelProps {
  game: GameDetail;
  ply: number;
  onGoto: (ply: number) => void;
  progress: AnalysisProgress | null;
  queuedAhead: number;
  onAnalyze: (preset: "quick" | "deep") => void;
  onCancel: () => void;
}

/** Analysis controls, the eval graph, key moments and the clock chart for one game. */
export function ReviewPanel({
  game,
  ply,
  onGoto,
  progress,
  queuedAhead,
  onAnalyze,
  onCancel,
}: ReviewPanelProps) {
  const running = progress?.state === "running" && progress.gameId === game.id;
  const queued = queuedAhead > 0 && !running;
  const analysed = game.analysis !== null;
  const moments = keyMoments(game.findings, 5, ply);
  const sideKnown = game.userColor !== null;

  // Where the game left the chosen repertoire, if it did (Openings v1).
  // Both are kept per game id, so a new game never shows the previous game's line.
  const [loaded, setLoaded] = useState<{ id: number; deviation: Deviation | null } | null>(null);
  const [drillAddedFor, setDrillAddedFor] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => ipc.gameRepertoireDeviation(game.id))
      .then((d) => {
        if (!cancelled) setLoaded({ id: game.id, deviation: d ?? null });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: game.id, deviation: null });
      });
    return () => {
      cancelled = true;
    };
  }, [game.id]);
  const deviation = loaded?.id === game.id ? loaded.deviation : null;
  const drillAdded = drillAddedFor === game.id;
  const setDrillAdded = () => setDrillAddedFor(game.id);

  return (
    <section className="space-y-3" aria-label="Game review">
      {deviation && (
        <p className="text-sm text-neutral-300" data-testid="repertoire-deviation">
          <span className="text-neutral-400">Repertoire:</span> you left {deviation.lineName} on
          move {moveLabel(deviation.ply)} {deviation.playedSan} instead of {deviation.expectedSan}.{" "}
          <button
            type="button"
            onClick={() => onGoto(deviation.ply)}
            className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800"
          >
            Show
          </button>{" "}
          <button
            type="button"
            disabled={drillAdded}
            onClick={() =>
              ipc
                .addOpeningDrill(deviation.lineKey, deviation.ply)
                .then(setDrillAdded)
                .catch(() => {})
            }
            className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-60"
          >
            {drillAdded ? "Drill added" : "Add a drill"}
          </button>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {running ? (
          <>
            <div className="h-2 min-w-32 flex-1 overflow-hidden rounded bg-neutral-800">
              <div
                className="h-full bg-emerald-600 transition-[width]"
                style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }}
              />
            </div>
            <span className="text-neutral-400" data-testid="analysis-progress">
              {progress.done} / {progress.total}
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
            >
              Cancel
            </button>
          </>
        ) : queued ? (
          <span className="text-neutral-400" data-testid="analysis-progress">
            Queued ({queuedAhead} ahead)
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onAnalyze("quick")}
              className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600"
            >
              {analysed ? "Re-analyse (Quick)" : "Quick review"}
            </button>
            <button
              type="button"
              onClick={() => onAnalyze("deep")}
              className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800"
              title="1.5M nodes per move, about a minute"
            >
              Deep
            </button>
            {analysed && game.analysis && (
              <span className="text-xs text-neutral-500" data-testid="analysis-info">
                {game.analysis.preset} · {game.analysis.analyzedAt.slice(0, 16).replace("T", " ")}
              </span>
            )}
          </>
        )}
      </div>
      {progress?.state === "failed" && progress.gameId === game.id && (
        <p className="text-sm text-red-400" role="alert">
          Analysis failed: {progress.error}
        </p>
      )}

      {analysed && (
        <>
          <EvalGraph
            plies={game.plies}
            ply={ply}
            onSelect={onGoto}
            marks={moments.map((m) => m.ply)}
          />
          {!sideKnown && (
            <p className="text-xs text-neutral-500">
              Choose your side in the games list to get key moments for your moves.
            </p>
          )}
          {moments.length > 0 && (
            <div className="space-y-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Key moments
              </h2>
              <ol className="space-y-1.5" aria-label="Key moments">
                {moments.map((f) => {
                  const theme = trainableTheme(f);
                  return (
                    <li key={f.id} className="text-sm">
                      <button
                        type="button"
                        onClick={() => onGoto(f.ply)}
                        className={`text-left hover:text-white ${f.ply === ply ? "text-emerald-300" : "text-neutral-200"}`}
                      >
                        <span className="font-semibold">{moveLabel(f.ply)}</span> {f.summary}
                      </button>
                      {theme && (
                        <button
                          type="button"
                          onClick={() =>
                            requestPuzzles(theme, {
                              ecoFamily: game.eco?.[0] ?? null,
                              first: puzzleFromFinding(game, f),
                            })
                          }
                          className="ml-2 rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800"
                          title={`Puzzles on ${themeLabel(theme)}`}
                        >
                          Train {themeLabel(theme).toLowerCase()}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {sideKnown && moments.length === 0 && (
            <p className="text-sm text-neutral-400">No big slips on your side in this game.</p>
          )}
          <ClockChart plies={game.plies} ply={ply} onSelect={onGoto} />
        </>
      )}
    </section>
  );
}
