import { useCallback, useEffect, useState } from "react";
import { ipc, type MasterDeviationGroup } from "../../lib/ipc";
import { requestGame } from "../../lib/navigation";

/** Recurring "off master practice" points from the user's games, with actions. */
export function MasterDeviations({
  available,
  onExplore,
}: {
  available: boolean;
  onExplore: (fen: string) => void;
}) {
  const [items, setItems] = useState<MasterDeviationGroup[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const load = useCallback(() => {
    (available ? ipc.masterDeviations(100) : Promise.resolve([]))
      .then(setItems)
      .catch(() => setItems([]));
  }, [available]);
  useEffect(load, [load]);

  if (!available) return null;
  if (!items) return <p className="text-sm text-neutral-400">Loading…</p>;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Off master practice
      </h2>
      {items.length === 0 ? (
        <p className="max-w-2xl text-sm text-neutral-400">
          Your reviewed games stay within master practice as far as the data reaches, or nothing
          recurring has turned up yet.
        </p>
      ) : (
        <ul className="max-w-3xl space-y-2" aria-label="Master deviations">
          {items.map((d) => {
            const key = `${d.fen}|${d.userUci}`;
            return (
              <li key={key} className="rounded border border-neutral-800 p-3 text-sm">
                <div className="text-neutral-400">
                  {d.games === 1 ? "Once" : `In ${d.games} games`}
                  {d.opening ? ` · ${d.opening}` : ""}
                </div>
                <div className="mt-1">
                  On move {Math.ceil(d.ply / 2)} you play{" "}
                  <span className="font-semibold">{d.userSan}</span>
                  {d.verdict === "dubious" ? " (the engine dislikes it)" : " (rare but sound)"}.
                  Elite players choose {d.topSan} in {Math.round(d.topShare)}% of games and score{" "}
                  {Math.round(d.topScore)}%
                  {d.userScore > 0
                    ? `; with ${d.userSan} they score ${Math.round(d.userScore)}%`
                    : ""}
                  .
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onExplore(d.fen)}
                    className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                  >
                    Show in explorer
                  </button>
                  <button
                    type="button"
                    onClick={() => requestGame(d.latestGameId, d.ply)}
                    className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                  >
                    Show the game
                  </button>
                  <button
                    type="button"
                    disabled={added.includes(key)}
                    onClick={() =>
                      ipc
                        .addMasterDrill(d.fen, d.topUci)
                        .then(() => setAdded((a) => [...a, key]))
                        .catch(() => {})
                    }
                    className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {added.includes(key) ? "Drill added" : "Add a drill"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      ipc
                        .keepMasterMove(d.fen, d.userUci)
                        .then(load)
                        .catch(() => {})
                    }
                    className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                  >
                    Keep my move
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
