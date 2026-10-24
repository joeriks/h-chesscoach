import { useEffect, useState } from "react";
import { ipc, type ThemeWeakness } from "../../lib/ipc";
import { requestGame, requestPuzzles, requestStrategy } from "../../lib/navigation";
import { dueLocalRetries } from "../puzzles/localAttempts";
import { readStrategyHistory } from "../strategy/progress";
import { trainingPriorities, type PriorityItem } from "./priorities";
export function PriorityCoach() {
  const [budget, setBudget] = useState(15);
  const [weaknesses, setWeaknesses] = useState<ThemeWeakness[]>([]);
  const [gameState, setGameState] = useState(
    "Game evidence unavailable; recommendations use local practice only.",
  );
  const [local] = useState(() => {
    try {
      return { history: readStrategyHistory(), retries: dueLocalRetries(), error: "" };
    } catch {
      return {
        history: [],
        retries: [],
        error:
          "Local history could not be read. It has been preserved; the recommendation is a fresh diagnostic.",
      };
    }
  });
  useEffect(() => {
    let cancelled = false;
    if (!("__TAURI_INTERNALS__" in window)) return;
    ipc
      .weaknessProfile()
      .then((p) => {
        if (cancelled) return;
        setWeaknesses(p.themes);
        setGameState(
          `Game evidence: ${p.analysedGames} analysed games in the last ${p.windowDays} days.`,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const recommendations = trainingPriorities(local.history, local.retries, weaknesses, budget);
  const start = (item: PriorityItem) => {
    const t = item.target;
    if (t.kind === "strategy") requestStrategy(t.id);
    else if (t.kind === "puzzle") requestPuzzles(t.theme, { retry: t.retry });
    else requestGame(t.gameId, t.ply);
  };
  return (
    <section
      className="mb-6 max-w-3xl space-y-3 rounded border border-neutral-700 p-4"
      aria-label="Personal training priorities"
    >
      <h1 className="text-lg font-semibold">Your next training priorities</h1>
      <label className="block text-sm">
        Time available{" "}
        <select
          aria-label="Time available"
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="rounded bg-neutral-800 p-1"
        >
          {[5, 15, 30].map((n) => (
            <option key={n} value={n}>
              {n} minutes
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-neutral-400">
        {gameState} Up to three focused tasks; unused time is left free. Estimated time is a guide,
        not a deadline.
      </p>
      {local.error && (
        <p role="alert" className="text-amber-300">
          {local.error}
        </p>
      )}
      <ol className="space-y-3">
        {recommendations.map((item, i) => (
          <li key={item.id} className="rounded bg-neutral-900 p-3">
            <h2 className="font-semibold">
              {i + 1}. {item.title} · about {item.minutes} min
            </h2>
            <p className="my-2 text-sm text-neutral-300">{item.why}</p>
            <button
              onClick={() => start(item)}
              disabled={item.target.kind !== "strategy" && !("__TAURI_INTERNALS__" in window)}
              className="rounded bg-emerald-700 px-3 py-1 text-sm"
            >
              {item.target.kind !== "strategy" && !("__TAURI_INTERNALS__" in window)
                ? "Requires desktop app"
                : "Start this practice"}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-xs text-neutral-400">
        Suggested order: due recall, repeated errors, transfer to new positions, then broader
        diagnostics. Small game samples prompt review. This supplements your desktop schedule; it
        does not mark its tasks complete.
      </p>
    </section>
  );
}
