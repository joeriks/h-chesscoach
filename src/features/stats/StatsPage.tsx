import { useEffect, useState } from "react";
import { ipc, type AreaScore, type PlayerStats } from "../../lib/ipc";
import { navigate, requestEndgame, requestOpenings, requestPuzzles } from "../../lib/navigation";
import { localAttemptSummary } from "../puzzles/localAttempts";
import { TransferCheck } from "./TransferCheck";
import { LineChart, type Series } from "./LineChart";

const AREA_COLORS: Record<AreaScore["area"], string> = {
  opening: "#3b82f6",
  middlegame: "#10b981",
  endgame: "#f59e0b",
  tactics: "#ec4899",
};
const AREA_LABEL: Record<AreaScore["area"], string> = {
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
  tactics: "Tactics",
};
const SOURCE_LABEL: Record<string, string> = { lichess: "Lichess", chesscom: "Chess.com" };

function scoreWord(score: number): string {
  if (score >= 60) return "higher estimated score";
  if (score > 40) return "middle estimated score";
  return "lower estimated score";
}

/** Ratings, strengths and weaknesses by area, and progress month by month. */
export function StatsPage() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recall] = useState(() => {
    try {
      return localAttemptSummary();
    } catch {
      return null;
    }
  });
  useEffect(() => {
    ipc
      .playerStats()
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!stats) return <p className="text-sm text-neutral-400">Loading…</p>;

  const labels = stats.history.map((m) => m.month);
  const areaSeries: Series[] = (["opening", "middlegame", "endgame", "tactics"] as const).map(
    (a) => ({
      key: a,
      label: AREA_LABEL[a],
      color: AREA_COLORS[a],
      values: stats.history.map((m) => m.areas[a] ?? null),
    }),
  );
  const sources = ["lichess", "chesscom"].filter((s) => stats.history.some((m) => s in m.ratings));
  const ratingSeries = (source: string): Series[] => [
    {
      key: source,
      label: SOURCE_LABEL[source] ?? source,
      color: source === "lichess" ? "#a3a3a3" : "#10b981",
      values: stats.history.map((m) => m.ratings[source] ?? null),
    },
  ];
  const ratingBounds = (source: string) => {
    const v = stats.history
      .map((m) => m.ratings[source])
      .filter((x): x is number => x !== undefined);
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return { min: Math.floor((lo - 50) / 50) * 50, max: Math.ceil((hi + 50) / 50) * 50 };
  };
  const train = (a: AreaScore["area"]) => {
    if (a === "tactics") requestPuzzles(null);
    else if (a === "endgame") requestEndgame({ lessonId: null });
    else if (a === "middlegame") navigate("strategy");
    else requestOpenings({});
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Stats</h1>
        <span className="text-sm text-neutral-400" data-testid="stats-coverage">
          {stats.analysedGames} of {stats.totalGames} games reviewed · model reference rating:{" "}
          {stats.referenceRating} rating
        </span>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Ratings</h2>
        {stats.ratings.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No rated games yet. Link your Lichess or Chess.com account in Settings.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3" aria-label="Ratings">
            {stats.ratings.map((r) => {
              const delta = r.threeMonthsAgo === null ? null : r.rating - r.threeMonthsAgo;
              return (
                <li
                  key={`${r.source}-${r.timeClass}`}
                  className="min-w-44 rounded border border-neutral-800 p-3"
                >
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    {SOURCE_LABEL[r.source] ?? r.source} · {r.timeClass}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">{r.rating}</div>
                  <div className="text-xs text-neutral-400">
                    {delta === null
                      ? `${r.games} games`
                      : `${delta >= 0 ? "+" : ""}${delta} in 3 months · ${r.games} games`}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Strengths and weaknesses
        </h2>
        <p className="text-sm text-neutral-400">
          These are model estimates, not calibrated comparisons with other players. Higher means a
          higher estimated score. Treat strength and weakness labels as working hypotheses; game
          difficulty and the number of analysed positions affect the result.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Areas">
          {stats.areas.map((a) => (
            <li
              key={a.area}
              className={`rounded border p-3 ${
                a.label === "strength"
                  ? "border-emerald-700"
                  : a.label === "weakness"
                    ? "border-red-800"
                    : "border-neutral-800"
              }`}
              data-testid={`area-${a.area}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: AREA_COLORS[a.area] }}
                />
                <span className="font-semibold">{AREA_LABEL[a.area]}</span>
                {a.label !== "average" && a.score !== null && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
                      a.label === "strength"
                        ? "bg-emerald-800 text-emerald-100"
                        : "bg-red-900 text-red-100"
                    }`}
                  >
                    {a.label}
                  </span>
                )}
                <span className="ml-auto text-2xl font-semibold">
                  {a.score === null ? "–" : Math.round(a.score)}
                </span>
              </div>
              {a.score !== null && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded bg-neutral-800">
                  <div
                    className="h-full"
                    style={{ width: `${Math.round(a.score)}%`, background: AREA_COLORS[a.area] }}
                  />
                </div>
              )}
              <p className="mt-1 text-xs text-neutral-400">
                {a.score === null
                  ? a.note
                  : `${scoreWord(a.score)} · ${a.sample} observations. Check examples in Insights before changing your training.`}
              </p>
              <button
                type="button"
                onClick={() => train(a.area)}
                className="mt-2 rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
              >
                Train {AREA_LABEL[a.area].toLowerCase()}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Progress</h2>
        <section
          aria-label="Delayed recall"
          className="rounded border border-neutral-800 p-3 text-sm"
        >
          <h3 className="font-semibold">Remembering your own mistakes</h3>
          {recall ? (
            <>
              <p>
                {recall.delayedCleanSolves} of {recall.delayedAttempts} delayed attempts solved
                without help · {recall.dueRetries} retries due.
              </p>
              <p className="text-neutral-400">
                A delayed attempt is at least 24 hours after your previous attempt at that position.
                Same-day practice ({recall.sameDayPractice}) is kept separate. Remembering an old
                position is not yet proof of improvement in new games.
              </p>
            </>
          ) : (
            <p role="alert">Local practice history could not be read.</p>
          )}
        </section>
        <TransferCheck />
        <LineChart
          title="Area scores"
          labels={labels}
          series={areaSeries}
          min={0}
          max={100}
          guide={{ value: 50, label: "model midpoint" }}
        />
        {sources.map((s) => {
          const b = ratingBounds(s);
          return (
            <LineChart
              key={s}
              title={`${SOURCE_LABEL[s] ?? s} rating`}
              labels={labels}
              series={ratingSeries(s)}
              min={b.min}
              max={b.max}
            />
          );
        })}
        <details className="text-sm">
          <summary className="cursor-pointer text-neutral-400">Month by month, as a table</summary>
          <table className="mt-2 w-full max-w-3xl text-xs" aria-label="Monthly stats">
            <thead className="text-left uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="pr-3">Month</th>
                <th className="pr-3">Games</th>
                <th className="pr-3">Reviewed</th>
                {sources.map((s) => (
                  <th key={s} className="pr-3">
                    {SOURCE_LABEL[s] ?? s}
                  </th>
                ))}
                {areaSeries.map((a) => (
                  <th key={a.key} className="pr-3">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.history.map((m) => (
                <tr key={m.month} className="border-t border-neutral-800">
                  <td className="pr-3 py-0.5">{m.month}</td>
                  <td className="pr-3">{m.games}</td>
                  <td className="pr-3">{m.analysed}</td>
                  {sources.map((s) => (
                    <td key={s} className="pr-3">
                      {m.ratings[s] ?? "–"}
                    </td>
                  ))}
                  {areaSeries.map((a) => (
                    <td key={a.key} className="pr-3">
                      {m.areas[a.key] === undefined ? "–" : Math.round(m.areas[a.key]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
