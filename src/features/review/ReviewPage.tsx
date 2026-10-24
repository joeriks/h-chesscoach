import { useCallback, useEffect, useMemo, useState } from "react";
import { AnalysisPage } from "../analysis/AnalysisPage";
import type { MoveMark } from "../analysis/MoveList";
import { GamesLibrary } from "../library/GamesLibrary";
import { describeGame } from "../library/gamesText";
import {
  ipc,
  type AnalysisProgress,
  type GameDetail,
  type GameSummary,
  type QueueStatus,
} from "../../lib/ipc";
import { takeGameRequest } from "../../lib/navigation";
import { gameRootFen } from "../../lib/gamePosition";
import { ReviewPanel } from "./ReviewPanel";
import { classificationMark } from "./reviewText";

type View = { kind: "library" } | { kind: "board"; game: GameDetail | null; ply?: number };

/** Review: the games library, and the analysis board for a chosen game or free exploration. */
export function ReviewPage() {
  const [view, setView] = useState<View>({ kind: "library" });

  // Another screen may have asked for a specific game (e.g. evidence on Insights).
  useEffect(() => {
    const request = takeGameRequest();
    if (!request) return;
    ipc
      .getGame(request.gameId)
      .then((game) => {
        if (game) setView({ kind: "board", game, ply: request.ply });
      })
      .catch(() => {});
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [queue, setQueue] = useState<QueueStatus>({ current: null, queued: [] });

  const reloadGame = useCallback((id: number) => {
    ipc
      .getGame(id)
      .then((game) => {
        if (game)
          setView((v) => (v.kind === "board" && v.game?.id === id ? { kind: "board", game } : v));
      })
      .catch(() => {});
  }, []);

  // Games arriving from a sync show up in the list; a finished analysis refreshes the game.
  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    let cancelled = false;
    const keep = (p: Promise<() => void>) =>
      p.then((fn) => (cancelled ? fn() : unlisteners.push(fn))).catch(() => {});
    keep(
      ipc.onSyncEvent((s) => {
        if (s.state === "done" && s.inserted > 0) setRefreshKey((k) => k + 1);
      }),
    );
    keep(
      ipc.onAnalysisEvent((p) => {
        setProgress(p);
        ipc
          .analysisStatus()
          .then(setQueue)
          .catch(() => {});
        if (p.state === "done") reloadGame(p.gameId);
      }),
    );
    ipc
      .analysisStatus()
      .then(setQueue)
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [reloadGame]);

  const open = (summary: GameSummary) => {
    setError(null);
    ipc
      .getGame(summary.id)
      .then((game) => {
        if (!game) setError("That game is no longer in the library.");
        else setView({ kind: "board", game });
      })
      .catch((e: unknown) => setError(String(e)));
  };

  const game = view.kind === "board" ? view.game : null;
  let rootFen: string | undefined;
  let positionError: string | null = null;
  try {
    if (game) rootFen = gameRootFen(game.pgn);
  } catch (e) {
    positionError = String(e);
  }

  const marks = useMemo(() => {
    const map = new Map<number, MoveMark>();
    for (const p of game?.plies ?? []) {
      const m = classificationMark(p.classification);
      if (m) map.set(p.ply, m);
    }
    return map;
  }, [game]);

  if (view.kind === "library") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Games</h1>
          <button
            type="button"
            onClick={() => setView({ kind: "board", game: null })}
            className="rounded border border-neutral-700 px-2.5 py-1 text-sm hover:bg-neutral-800"
          >
            Free board
          </button>
          {progress?.state === "running" && (
            <span className="text-xs text-neutral-500">
              Analysing a game: {progress.done} / {progress.total}
            </span>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <GamesLibrary onOpen={open} refreshKey={refreshKey} />
      </div>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        onClick={() => setView({ kind: "library" })}
        className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800"
      >
        ← Games
      </button>
      {game ? (
        <span data-testid="game-header">
          {describeGame(game)} · {game.result}
          {game.openingName && <span className="text-neutral-500"> · {game.openingName}</span>}
        </span>
      ) : (
        <span className="text-neutral-400">Free board</span>
      )}
      {game?.findings.slice(0, 5).map((finding) => (
        <button
          key={finding.id}
          type="button"
          onClick={() => setView({ kind: "board", game, ply: Math.max(0, finding.ply - 1) })}
          className="rounded border border-neutral-700 px-2 py-1 text-xs"
        >
          Think at move {Math.ceil(finding.ply / 2)}
          {finding.ply % 2 === 0 ? "…" : "."}
        </button>
      ))}
    </div>
  );

  const analyze = (preset: "quick" | "deep") => {
    if (!game) return;
    setError(null);
    ipc
      .analyzeGame(game.id, preset)
      .then(() => ipc.analysisStatus().then(setQueue))
      .catch((e: unknown) => setError(String(e)));
  };

  const queuedAhead = game ? queue.queued.indexOf(game.id) : -1;

  if (positionError)
    return (
      <div>
        {header}
        <p role="alert">Cannot replay this game's starting position: {positionError}</p>
      </div>
    );

  return (
    <AnalysisPage
      key={game ? `game-${game.id}-${game.analysis?.analyzedAt ?? "raw"}-${view.ply ?? 0}` : "free"}
      initialMoves={game ? game.plies.map((p) => p.uci) : []}
      initialFen={rootFen}
      coachGameId={game?.id}
      initialOrientation={game?.userColor === "b" ? "black" : "white"}
      initialPly={view.kind === "board" ? (view.ply ?? 0) : 0}
      header={header}
      marks={marks}
      renderSide={
        game
          ? ({ ply, goto }) => (
              <>
                {error && (
                  <p className="text-sm text-red-400" role="alert">
                    {error}
                  </p>
                )}
                <ReviewPanel
                  game={game}
                  ply={ply}
                  onGoto={goto}
                  progress={progress}
                  queuedAhead={queuedAhead < 0 ? 0 : queuedAhead + 1}
                  onAnalyze={analyze}
                  onCancel={() => ipc.cancelAnalysis().catch(() => {})}
                />
              </>
            )
          : undefined
      }
    />
  );
}
