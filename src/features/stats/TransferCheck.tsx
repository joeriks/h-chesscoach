import { useState } from "react";
import { ipc, type GameDetail } from "../../lib/ipc";
import { gamesAfterBaseline, samplePlay, type PlaySample } from "./gameTransfer";

interface Baseline {
  version: 1;
  savedAt: number;
  source: string;
  timeClass: string;
  sample: PlaySample;
}

export function TransferCheck() {
  const [source, setSource] = useState("lichess");
  const [timeClass, setTimeClass] = useState("rapid");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ baseline: Baseline; after: PlaySample } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const key = `chesscoach.play-baseline.v1:${source}:${timeClass}`;
  const collect = async () => {
    const page = await ipc.listGames({ source, timeClass }, 40, 0);
    const details: GameDetail[] = [];
    for (let i = 0; i < page.games.length; i += 5) {
      const batch = await Promise.all(page.games.slice(i, i + 5).map((g) => ipc.getGame(g.id)));
      for (const g of batch)
        if (g && g.source === source && g.timeClass === timeClass) details.push(g);
    }
    return details;
  };
  const run = async (create: boolean) => {
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      if (create) {
        if (localStorage.getItem(key))
          throw new Error(
            "A baseline already exists for this selection. Use Check new games to preserve the original comparison.",
          );
        const sample = samplePlay(await collect());
        if (sample.games < 10)
          throw new Error(
            `Review at least 10 games with your side assigned first (${sample.games} available in the latest 40).`,
          );
        const baseline: Baseline = { version: 1, savedAt: Date.now(), source, timeClass, sample };
        localStorage.setItem(key, JSON.stringify(baseline));
        setMessage(
          `Baseline saved: ${sample.games} games, ${sample.moves} classified moves, ${sample.errorsPer100!.toFixed(1)} mistakes or blunders per 100 moves. Play and review new games before comparing.`,
        );
      } else {
        const raw = localStorage.getItem(key);
        if (!raw) throw new Error("Save a baseline for this platform and time control first.");
        const baseline = JSON.parse(raw) as Baseline;
        if (
          baseline.version !== 1 ||
          baseline.source !== source ||
          baseline.timeClass !== timeClass ||
          !Number.isFinite(baseline.savedAt) ||
          !Array.isArray(baseline.sample?.gameIds) ||
          !Number.isFinite(baseline.sample.errorsPer100) ||
          baseline.sample.moves <= 0
        ) {
          throw new Error("The saved baseline could not be read. It has not been replaced.");
        }
        const after = samplePlay(
          gamesAfterBaseline(await collect(), baseline.savedAt, baseline.sample.gameIds),
        );
        setResult({ baseline, after });
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-3 rounded border border-neutral-800 p-4"
      aria-label="Transfer to new games"
    >
      <h2 className="font-semibold">Does practice carry over to new games?</h2>
      <p className="text-sm text-neutral-400">
        Save your current play as a baseline, then compare games played after that date. This counts
        engine-classified mistakes and blunders on your own moves in up to 40 recent games. It does
        not prove that training caused a change; opponent strength and position difficulty also
        matter.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Comparison platform"
          value={source}
          disabled={busy}
          onChange={(e) => {
            setSource(e.target.value);
            setResult(null);
            setMessage(null);
          }}
          className="rounded bg-neutral-900 p-2"
        >
          <option value="lichess">Lichess</option>
          <option value="chesscom">Chess.com</option>
          <option value="manual">Imported PGN</option>
        </select>
        <select
          aria-label="Comparison time control"
          value={timeClass}
          disabled={busy}
          onChange={(e) => {
            setTimeClass(e.target.value);
            setResult(null);
            setMessage(null);
          }}
          className="rounded bg-neutral-900 p-2"
        >
          {["rapid", "blitz", "classical", "bullet"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(true)}
          className="rounded border border-neutral-700 px-3 py-1 disabled:opacity-40"
        >
          Save baseline
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(false)}
          className="rounded bg-emerald-700 px-3 py-1 disabled:opacity-40"
        >
          Check new games
        </button>
      </div>
      {busy && <p role="status">Reading reviewed games…</p>}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {result && (
        <div role="status" className="space-y-1 text-sm">
          <p>
            Baseline: {result.baseline.sample.errorsPer100!.toFixed(1)} errors per 100 moves in{" "}
            {result.baseline.sample.games} games.
          </p>
          <p>
            New games: {result.after.errorsPer100?.toFixed(1) ?? "–"} errors per 100 moves in{" "}
            {result.after.games} games ({result.after.moves} classified moves).
          </p>
          {result.after.games < 10 && (
            <p>
              Too few new games for a useful comparison. Aim for at least 10 reviewed games with
              similar time settings and opponents.
            </p>
          )}
          <p>
            Keep the same analysis preset and similar time settings. This is a descriptive
            comparison, not a rating estimate or a causal test.
          </p>
        </div>
      )}
    </section>
  );
}
