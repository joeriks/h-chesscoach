import { useCallback, useEffect, useState } from "react";
import { ipc, type AnalysisProgress, type SoftSkills, type WeaknessProfile } from "../../lib/ipc";
import { requestGame, requestPuzzles } from "../../lib/navigation";
import { themeLabel } from "../puzzles/puzzleLogic";
import { weaknessLine } from "./insightsText";
import { WeaknessRadar } from "./WeaknessRadar";

const BATCH = 20;

/** Weakness radar, top weaknesses with evidence, and a way to review more games. */
export function InsightsPage() {
  const [profile, setProfile] = useState<WeaknessProfile | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [queued, setQueued] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [soft, setSoft] = useState<SoftSkills | null>(null);

  const load = useCallback(() => {
    ipc
      .weaknessProfile()
      .then(setProfile)
      .catch((e: unknown) => setError(String(e)));
    ipc
      .softSkills()
      .then((s) => setSoft(Array.isArray(s?.insights) ? s : null))
      .catch(() => setSoft(null));
    ipc
      .analysisStatus()
      .then((s) => {
        setQueued(s.queued.length);
        setProgress(s.current);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    ipc
      .onAnalysisEvent((p) => {
        setProgress(p);
        ipc
          .analysisStatus()
          .then((s) => setQueued(s.queued.length))
          .catch(() => {});
        if (p.state === "done") load();
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
  }, [load]);

  const analyseMore = () => {
    setError(null);
    ipc
      .analyzeUnreviewed(BATCH)
      .then((n) => {
        if (n === 0) setError("Every game with a known side is already reviewed.");
        load();
      })
      .catch((e: unknown) => setError(String(e)));
  };

  if (!profile) return <p className="text-sm text-neutral-400">{error ?? "Loading…"}</p>;

  const running = progress?.state === "running";
  const top = profile.themes.slice(0, 3);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Insights</h1>
        <span className="text-sm text-neutral-400" data-testid="coverage">
          {profile.analysedGames} game{profile.analysedGames === 1 ? "" : "s"} reviewed,{" "}
          {profile.unanalysedGames} waiting
        </span>
        {running ? (
          <span className="text-sm text-neutral-300" data-testid="review-progress">
            Reviewing a game: {progress.done} / {progress.total}
            {queued > 0 && `, ${queued} more queued`}
          </span>
        ) : (
          profile.unanalysedGames > 0 && (
            <button
              type="button"
              onClick={analyseMore}
              className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
            >
              Review {Math.min(BATCH, profile.unanalysedGames)} newest games
            </button>
          )
        )}
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {profile.themes.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No tactical pattern stands out yet. Review a few games (and solve some puzzles) and the
          picture will fill in. Patterns can appear after only two chances in the last{" "}
          {profile.windowDays} days, so early results are tentative.
        </p>
      ) : (
        <>
          <WeaknessRadar themes={profile.themes} />
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Patterns to investigate
            </h2>
            <ol className="space-y-4" aria-label="Weaknesses">
              {top.map((t, i) => (
                <li key={t.theme} className="rounded border border-neutral-800 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold">
                      {i + 1}. {themeLabel(t.theme)}
                    </span>
                    <span className="text-sm text-neutral-400">
                      {Math.round(t.missRate * 100)}% missed
                    </span>
                    <button
                      type="button"
                      onClick={() => requestPuzzles(t.theme)}
                      className="ml-auto rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
                    >
                      Train {themeLabel(t.theme).toLowerCase()}
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-neutral-300">{weaknessLine(t)}</p>
                  <p className="mt-1 text-xs text-amber-300">
                    {t.opportunities < 20 || t.evidenceGames < 5
                      ? "Small sample — treat this as a training hypothesis, not a settled weakness."
                      : "Repeated pattern — inspect the examples and check whether it persists in new games."}{" "}
                    The same theme can arise from missed threats, calculation errors or time
                    pressure.
                  </p>
                  {t.evidence.length > 0 && (
                    <ul
                      className="mt-2 space-y-1 text-sm"
                      aria-label={`${themeLabel(t.theme)} examples`}
                    >
                      {t.evidence.map((e) => (
                        <li key={`${e.gameId}-${e.ply}`}>
                          <button
                            type="button"
                            onClick={() => requestGame(e.gameId, e.ply)}
                            className="text-left text-neutral-300 hover:text-white"
                            title="Open this moment on the board"
                          >
                            <span className="text-neutral-500">
                              {e.playedAt?.slice(0, 10) ?? "?"} · {e.white} vs {e.black} ·{" "}
                            </span>
                            {e.summary}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {soft && (
        <section className="space-y-3" data-testid="soft-skills">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Time and mind · last {soft.windowDays} days
          </h2>
          {soft.insights.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Nothing stands out yet. These insights need a handful of reviewed games with clocks (
              {soft.gamesWithClocks} of {soft.games} games have them so far).
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" aria-label="Time and mind">
              {soft.insights.map((i) => (
                <li
                  key={i.id}
                  className={`rounded border p-3 ${
                    i.positive ? "border-emerald-900" : "border-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-neutral-500">
                      {i.area === "time" ? "Time" : "Mind"}
                    </span>
                    <span className="font-semibold">{i.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-200">{i.observation}</p>
                  <p className="mt-1 text-xs text-neutral-500">{i.why}</p>
                  <p className="mt-1 text-sm text-emerald-300">{i.action}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
