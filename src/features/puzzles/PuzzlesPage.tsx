import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ipc,
  type Attempt,
  type AttemptResult,
  type Puzzle,
  type PuzzleFilter,
  type PuzzleImportState,
  type PuzzleImportStatus,
  type ThemeCount,
  type ThemeRating,
} from "../../lib/ipc";
import { navigate, takePuzzleRequest, type PuzzleRequest } from "../../lib/navigation";
import { ImportPanel } from "./ImportPanel";
import { themeLabel } from "./puzzleLogic";
import { BOARD_SIZE, PuzzleSolver } from "./PuzzleSolver";
import { dueLocalRetries } from "./localAttempts";

const FAMILIES: [string, string][] = [
  ["A", "A · Flank openings"],
  ["B", "B · Semi-open games"],
  ["C", "C · Open games, French"],
  ["D", "D · Closed, semi-closed"],
  ["E", "E · Indian defences"],
];
const RATING_WINDOW = 150;
const SET_SIZE = 10;
const AUTO_NEXT_SETTING = "puzzles.autoNext";

export function PuzzlesPage() {
  const [status, setStatus] = useState<PuzzleImportStatus | null>(null);
  const [job, setJob] = useState<PuzzleImportState>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(() => {
    ipc
      .puzzleImportStatus()
      .then((s) => {
        setStatus(s);
        setJob(s.job);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    refreshStatus();
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    ipc
      .onPuzzleProgress((state) => {
        setJob(state);
        if (state.state === "done" || state.state === "failed") refreshStatus();
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refreshStatus]);

  const start = (folder: string | null) => {
    setError(null);
    ipc
      .startPuzzleImport(folder)
      .then(refreshStatus)
      .catch((e: unknown) => setError(String(e)));
  };

  if (!status) return <p className="text-sm text-neutral-400">{error ?? "Loading…"}</p>;

  const hasPuzzles = status.puzzlesInDb > 0;
  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <ImportPanel
        status={status}
        job={job}
        onStart={start}
        onCancel={() => ipc.cancelPuzzleImport().catch(() => {})}
        compact={hasPuzzles}
      />
      <Trainer importing={job.state === "running"} hasDatabasePuzzles={hasPuzzles} />
      {!hasPuzzles && (
        <p className="text-sm text-neutral-400">
          Import the puzzle database for new puzzles. Your own-game retries remain available here.
        </p>
      )}
    </div>
  );
}

interface TrainerProps {
  /** Puzzles keep working during an import; the theme list just grows. */
  importing: boolean;
  hasDatabasePuzzles: boolean;
}

/** What the current run of puzzles is for, shown above the board. */
type Mode =
  | { kind: "free" }
  | { kind: "training"; theme: string; fromGame: boolean; taskId?: number }
  | { kind: "retry"; taskId?: number };

function Trainer({ importing, hasDatabasePuzzles }: TrainerProps) {
  const [themes, setThemes] = useState<ThemeCount[]>([]);
  const [ratings, setRatings] = useState<ThemeRating[]>([]);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [request] = useState<PuzzleRequest | null>(() => takePuzzleRequest());
  // "Train this" on a game finding opens Puzzles with that theme already chosen.
  const [theme, setTheme] = useState(() => request?.theme ?? "");
  const [family, setFamily] = useState(() => request?.ecoFamily ?? "");
  const [center, setCenter] = useState<number | null>(null);
  const [queue, setQueue] = useState<Puzzle[]>([]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "free" });
  const [matching, setMatching] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [localDue, setLocalDue] = useState<Puzzle[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoNext, setAutoNext] = useState(false);

  useEffect(() => {
    ipc
      .getSetting(AUTO_NEXT_SETTING)
      .then((v) => setAutoNext(v === "1"))
      .catch(() => {});
  }, []);
  const toggleAutoNext = (on: boolean) => {
    setAutoNext(on);
    ipc.setSetting(AUTO_NEXT_SETTING, on ? "1" : "0").catch(() => {});
  };

  // A plan task ends with its set: mark it done and go back to Today.
  const finishPlanTask = useCallback((taskId: number | undefined) => {
    if (taskId === undefined) return;
    ipc
      .finishTask(taskId)
      .then(() => navigate("today"))
      .catch((e: unknown) =>
        setNotice(`Could not complete this plan task: ${String(e)}. Try again.`),
      );
  }, []);

  const overall = ratings.find((r) => r.theme === "overall");
  const themeRating = theme ? ratings.find((r) => r.theme === theme) : undefined;
  // The rating window follows the user's rating in the chosen theme, unless they set one.
  const ratingCenter = center ?? Math.round(themeRating?.rating ?? overall?.rating ?? 1500);

  const filterKey = `${theme}|${family}|${ratingCenter}`;
  const filter = useMemo<PuzzleFilter>(() => {
    const [t, f, c] = filterKey.split("|") as [string, string, string];
    return {
      theme: t || null,
      minRating: Number(c) - RATING_WINDOW,
      maxRating: Number(c) + RATING_WINDOW,
      ecoFamily: f || null,
      excludeSolved: true,
    };
  }, [filterKey]);

  const loadDue = useCallback(() => {
    let local: Puzzle[] = [];
    try {
      local = dueLocalRetries().map((item) => item.puzzle);
    } catch (e) {
      Promise.resolve().then(() => setNotice(`Could not read local retries: ${String(e)}`));
    }
    Promise.resolve().then(() => setLocalDue(local));
    ipc
      .srsDue()
      .then((d) => setDueCount(d.count + local.length))
      .catch(() => setDueCount(local.length));
  }, []);

  useEffect(() => {
    ipc
      .puzzleThemes()
      .then(setThemes)
      .catch(() => {});
    ipc
      .themeRatings()
      .then(setRatings)
      .catch(() => {});
    ipc
      .recentPuzzleAttempts(12)
      .then(setHistory)
      .catch(() => {});
    loadDue();
  }, [importing, loadDue]);

  useEffect(() => {
    ipc
      .countPuzzles(filter)
      .then(setMatching)
      .catch(() => setMatching(null));
  }, [filter]);

  // A training request starts a set at once: the missed position first, then puzzles on
  // the motif, preferring the game's opening family.
  const requestHandled = useRef(false);
  useEffect(() => {
    if (!request || requestHandled.current) return;
    if (!request.theme && !request.retry && request.taskId === undefined) return;
    requestHandled.current = true;
    const taskId = request.taskId;
    if (request.retry) {
      try {
        const local = dueLocalRetries().map((item) => item.puzzle);
        if (local.length > 0) {
          setLocalDue(local);
          setMode({ kind: "retry", taskId });
          setPuzzle(local[0]!);
          setQueue(local.slice(1));
          return;
        }
      } catch (e) {
        setNotice(String(e));
        return;
      }
      ipc
        .srsDue()
        .then((d) => {
          const local = dueLocalRetries().map((item) => item.puzzle);
          setLocalDue(local);
          setDueCount(d.count + local.length);
          if (local.length > 0) {
            setMode({ kind: "retry", taskId });
            setPuzzle(local[0]!);
            return;
          }
          if (!d.next) {
            setNotice("Nothing is due for a retry right now.");
            finishPlanTask(taskId);
            return;
          }
          setMode({ kind: "retry", taskId });
          setPuzzle(d.next);
        })
        .catch((e: unknown) => setNotice(String(e)));
      return;
    }
    const requested = request.theme ?? "";
    const set = requested
      ? ipc.trainingSet(requested, request.ecoFamily ?? null, SET_SIZE)
      : ipc.pickPuzzles(filter, SET_SIZE);
    set
      .then((set) => {
        const list = request.first ? [request.first, ...set] : set;
        if (list.length === 0) {
          setNotice("No puzzles found for that theme yet.");
          return;
        }
        setMode({ kind: "training", theme: requested, fromGame: !!request.first, taskId });
        setPuzzle(list[0]!);
        setQueue(list.slice(1));
      })
      .catch((e: unknown) => {
        if (request.first) {
          setMode({ kind: "training", theme: requested, fromGame: true, taskId });
          setPuzzle(request.first);
          setQueue([]);
          setNotice(
            "Using the position from your game; imported puzzle suggestions are unavailable.",
          );
          return;
        }
        setNotice(String(e));
      });
  }, [request, filter, finishPlanTask]);

  // A changed filter drops the queued puzzles so the next one comes from the new filter.
  const queueFilter = useRef(filter);

  const next = useCallback(() => {
    setNotice(null);
    if (queue.length > 0 && (queueFilter.current === filter || mode.kind !== "free")) {
      setPuzzle(queue[0]!);
      setQueue(queue.slice(1));
      return;
    }
    if (mode.kind === "training" && mode.taskId !== undefined) {
      finishPlanTask(mode.taskId);
      return;
    }
    setMode({ kind: "free" });
    queueFilter.current = filter;
    ipc
      .pickPuzzles(filter, 10)
      .then((list) => {
        if (list.length === 0) {
          setNotice(
            "No unsolved puzzles match these filters. Widen the rating range or pick another theme.",
          );
          return;
        }
        setPuzzle(list[0]!);
        setQueue(list.slice(1));
      })
      .catch((e: unknown) => setNotice(String(e)));
  }, [filter, queue, mode, finishPlanTask]);

  const retryDue = useCallback(() => {
    setNotice(null);
    const taskId = mode.kind === "retry" ? mode.taskId : undefined;
    let local: Puzzle[];
    try {
      local = dueLocalRetries().map((item) => item.puzzle);
    } catch (e) {
      setNotice(String(e));
      return;
    }
    setLocalDue(local);
    if (local.length > 0) {
      setMode({ kind: "retry", taskId });
      setQueue(local.slice(1));
      setPuzzle(local[0]!);
      return;
    }
    ipc
      .srsDue()
      .then((d) => {
        setDueCount(d.count);
        if (!d.next) {
          setNotice("Nothing is due for a retry right now.");
          finishPlanTask(taskId);
          setMode({ kind: "free" });
          return;
        }
        setMode({ kind: "retry", taskId });
        setQueue([]);
        setPuzzle(d.next);
      })
      .catch((e: unknown) => setNotice(String(e)));
  }, [mode, finishPlanTask]);

  const onRecorded = useCallback(
    (r: AttemptResult) => {
      setRatings((prev) => {
        const map = new Map(prev.map((t) => [t.theme, t]));
        map.set(r.overall.theme, r.overall);
        for (const t of r.themes) map.set(t.theme, t);
        return [...map.values()];
      });
      ipc
        .recentPuzzleAttempts(12)
        .then(setHistory)
        .catch(() => {});
      loadDue();
    },
    [loadDue],
  );

  const onNext = (outcome: "solved" | "failed" | "skipped" | "compared") => {
    if (outcome === "skipped" && mode.kind !== "free" && mode.taskId !== undefined) {
      setNotice("Skipped and saved for later. This plan task remains open.");
      setPuzzle(null);
      setQueue([]);
      setMode({ kind: "free" });
      return;
    }
    if (mode.kind === "retry") {
      if (queue.length > 0) {
        setPuzzle(queue[0]!);
        setQueue(queue.slice(1));
        return;
      }
      retryDue();
      return;
    }
    next();
  };

  const banner =
    mode.kind === "training"
      ? mode.fromGame && puzzle?.id.startsWith("game:")
        ? `Training ${themeLabel(mode.theme).toLowerCase()}: this is the one you missed. Find it now.`
        : mode.theme
          ? `Training ${themeLabel(mode.theme).toLowerCase()} (${queue.length} more in this set).`
          : `Mixed puzzles at your level (${queue.length} more in this set).`
      : mode.kind === "retry"
        ? `Retrying a puzzle you failed before (${dueCount} due).`
        : null;

  return (
    <div className="flex flex-wrap gap-6">
      <div className="flex flex-col gap-3">
        {banner && (
          <p className="text-sm text-emerald-300" data-testid="training-banner">
            {banner}
          </p>
        )}
        {puzzle ? (
          <PuzzleSolver
            key={puzzle.id}
            puzzle={puzzle}
            onRecorded={onRecorded}
            onNext={onNext}
            autoNext={autoNext}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div
              className="flex items-center justify-center rounded border border-dashed border-neutral-700 text-sm text-neutral-500"
              style={{ width: BOARD_SIZE, height: BOARD_SIZE }}
            >
              Press Next puzzle to begin.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={next}
                className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
              >
                Next puzzle
              </button>
              {dueCount > 0 && (
                <button
                  type="button"
                  onClick={retryDue}
                  className="rounded border border-amber-600 px-3 py-1 text-sm text-amber-300 hover:bg-neutral-800"
                  data-testid="retry-due"
                >
                  Retry due puzzles ({dueCount})
                </button>
              )}
            </div>
          </div>
        )}
        {!puzzle && !hasDatabasePuzzles && localDue.length === 0 && (
          <p className="text-xs text-neutral-500">
            No imported puzzles yet. Complete or skip an own-game prompt to build local retries.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input
            type="checkbox"
            checked={autoNext}
            onChange={(e) => toggleAutoNext(e.target.checked)}
            aria-label="Auto-next after a clean solve"
          />
          Next puzzle automatically after a clean solve
        </label>
        {puzzle && dueCount > 0 && mode.kind !== "retry" && (
          <button
            type="button"
            onClick={retryDue}
            className="self-start rounded border border-amber-600 px-2.5 py-1 text-xs text-amber-300 hover:bg-neutral-800"
            data-testid="retry-due"
          >
            Retry due puzzles ({dueCount})
          </button>
        )}
      </div>
      {notice && (
        <p className="w-full text-sm text-amber-400" role="alert">
          {notice}
        </p>
      )}

      <aside className="flex w-80 min-w-0 flex-col gap-5">
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Filters
          </h2>
          <label className="block text-sm">
            <span className="text-neutral-400">Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            >
              <option value="">Any theme</option>
              {themes.map((t) => (
                <option key={t.theme} value={t.theme}>
                  {themeLabel(t.theme)} ({t.count.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">Opening family</span>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            >
              <option value="">Any opening</option>
              {FAMILIES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">
              Rating around {ratingCenter} ({filter.minRating}–{filter.maxRating})
            </span>
            <input
              type="range"
              min={600}
              max={2800}
              step={50}
              value={ratingCenter}
              onChange={(e) => setCenter(Number(e.target.value))}
              aria-label="Rating"
              className="mt-1 w-full"
            />
          </label>
          <p className="text-xs text-neutral-500" data-testid="matching-count">
            {matching === null ? "" : `${matching.toLocaleString()} puzzles match`}
          </p>
        </section>

        <section className="space-y-1 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Your ratings
          </h2>
          <p data-testid="overall-rating">
            Overall:{" "}
            {overall
              ? `${Math.round(overall.rating)} ± ${Math.round(overall.rd)} (${overall.attempts} puzzles)`
              : "no attempts yet"}
          </p>
          <ul className="space-y-0.5 text-neutral-300">
            {ratings
              .filter((r) => r.theme !== "overall")
              .slice(0, 8)
              .map((r) => (
                <li key={r.theme} className="flex justify-between">
                  <span>{themeLabel(r.theme)}</span>
                  <span className="text-neutral-400">
                    {Math.round(r.rating)} · {r.attempts}
                  </span>
                </li>
              ))}
          </ul>
        </section>

        {history.length > 0 && (
          <section className="space-y-1 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Recent
            </h2>
            <ul className="space-y-0.5" aria-label="Recent attempts">
              {history.map((a) => (
                <li key={a.id} className="flex gap-2 text-neutral-300">
                  <span className={a.success ? "text-emerald-400" : "text-red-400"}>
                    {a.success ? "✓" : "✗"}
                  </span>
                  <span>{a.rating}</span>
                  <span className="truncate text-neutral-500">
                    {a.themes.map(themeLabel).join(", ")}
                  </span>
                  <span className="ml-auto whitespace-nowrap text-neutral-500">
                    {Math.round(a.timeMs / 1000)} s
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
