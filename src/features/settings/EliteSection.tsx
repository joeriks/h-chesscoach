import { useCallback, useEffect, useState } from "react";
import { ipc, type EliteJob, type EliteOverview } from "../../lib/ipc";
import { jobLine, mb } from "./eliteText";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Settings → Data → Elite Database: folder, months, import, disk use. */
export function EliteSection() {
  const [overview, setOverview] = useState<EliteOverview | null>(null);
  const [job, setJob] = useState<EliteJob>({ state: "idle" });
  const [selected, setSelected] = useState<string[]>([]);
  const [folderInput, setFolderInput] = useState("");
  const [fileInput, setFileInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    ipc
      .eliteStatus()
      .then((o) => {
        setOverview(o);
        setJob(o.job);
        setFolderInput(o.folder ?? "");
      })
      .catch((e: unknown) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    load();
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    ipc
      .onEliteEvent((e) => {
        setJob(e);
        if (e.state !== "running") load();
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

  if (!overview) return <p className="text-neutral-400">{error ?? "Loading…"}</p>;

  const available = overview.months.filter((m) => m.path);
  const running = job.state === "running";
  const preset = (count: number | null) => {
    const months = available.map((m) => m.month);
    setSelected(count === null ? months : months.slice(-count));
  };
  const totalSelected = available
    .filter((m) => selected.includes(m.month))
    .reduce((n, m) => n + m.bytes, 0);

  const act = (p: Promise<unknown>) => {
    setError(null);
    p.then(load).catch((e: unknown) => setError(errorText(e)));
  };

  return (
    <section className="space-y-3" data-testid="elite-section">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Elite Database (master games)
      </h2>
      <p className="text-sm text-neutral-400">
        Optional: curated Lichess games between strong players (2400+ vs 2200+, bullet excluded) for
        the Master Explorer, model games and the comparison of your openings with master practice.
        Compiled by nikonoel, games by Lichess (public domain).
      </p>
      <p className="text-sm" data-testid="elite-totals">
        {overview.totals.monthsDone === 0
          ? "No master games imported yet."
          : `${overview.totals.monthsDone} months, ${overview.totals.games.toLocaleString()} games, ${overview.totals.explorerRows.toLocaleString()} explorer rows, ${mb(overview.totals.dbBytes)} on disk (${overview.totals.oldestMonth} to ${overview.totals.newestMonth}).`}
      </p>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-400">Folder</span>
        <input
          value={folderInput}
          onChange={(e) => setFolderInput(e.target.value)}
          aria-label="Elite folder"
          className="min-w-80 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
        />
        <button
          type="button"
          onClick={() => act(ipc.eliteSetFolder(folderInput || null))}
          className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
        >
          Use this folder
        </button>
      </label>
      {available.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-400">Scope</span>
            <button
              type="button"
              onClick={() => preset(12)}
              className="rounded border border-neutral-700 px-2 py-0.5 hover:bg-neutral-800"
            >
              Last 12 months
            </button>
            <button
              type="button"
              onClick={() => preset(36)}
              className="rounded border border-neutral-700 px-2 py-0.5 hover:bg-neutral-800"
            >
              Last 3 years
            </button>
            <button
              type="button"
              onClick={() => preset(null)}
              className="rounded border border-neutral-700 px-2 py-0.5 hover:bg-neutral-800"
            >
              Everything
            </button>
            <span className="text-neutral-500" data-testid="elite-selection">
              {selected.length} month{selected.length === 1 ? "" : "s"} selected ·{" "}
              {mb(totalSelected)} of PGN
            </span>
            <button
              type="button"
              disabled={running || selected.length === 0}
              onClick={() => act(ipc.eliteImport(selected))}
              className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
              Import selected
            </button>
            {running && (
              <button
                type="button"
                onClick={() => ipc.eliteCancel()}
                className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-auto rounded border border-neutral-800">
            <table className="w-full text-sm" aria-label="Elite months">
              <thead className="sticky top-0 bg-neutral-950 text-left text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-2 py-1"></th>
                  <th className="px-2 py-1">Month</th>
                  <th className="px-2 py-1">PGN</th>
                  <th className="px-2 py-1">State</th>
                  <th className="px-2 py-1">Games</th>
                  <th className="px-2 py-1">Rows</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {[...overview.months].reverse().map((m) => (
                  <tr key={m.month} className="border-t border-neutral-800">
                    <td className="px-2 py-1">
                      {m.path && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${m.month}`}
                          checked={selected.includes(m.month)}
                          onChange={(e) =>
                            setSelected((s) =>
                              e.target.checked ? [...s, m.month] : s.filter((x) => x !== m.month),
                            )
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 py-1">{m.month}</td>
                    <td className="px-2 py-1 text-neutral-400">{mb(m.bytes)}</td>
                    <td
                      className={`px-2 py-1 ${m.state === "done" ? "text-emerald-400" : "text-neutral-400"}`}
                    >
                      {m.state}
                    </td>
                    <td className="px-2 py-1">
                      {m.gamesImported ? m.gamesImported.toLocaleString() : ""}
                    </td>
                    <td className="px-2 py-1 text-neutral-400">
                      {m.explorerRows ? m.explorerRows.toLocaleString() : ""}
                    </td>
                    <td className="px-2 py-1">
                      {m.state === "done" && (
                        <button
                          type="button"
                          disabled={running}
                          onClick={() => act(ipc.eliteRemoveMonth(m.month))}
                          className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {available.length === 0 && (
        <p className="text-sm text-neutral-400">
          No <code>lichess_elite_YYYY-MM.pgn</code> files found in that folder.
        </p>
      )}
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-400">Import a PGN file</span>
        <input
          value={fileInput}
          onChange={(e) => setFileInput(e.target.value)}
          placeholder="C:\\path\\to\\lichess_elite_2024-01.pgn"
          aria-label="PGN file"
          className="min-w-80 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
        />
        <button
          type="button"
          disabled={running || !fileInput}
          onClick={() => act(ipc.eliteImportFile(fileInput))}
          className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800 disabled:opacity-50"
        >
          Import file
        </button>
      </label>
      {jobLine(job) && (
        <p className="text-sm text-emerald-300" data-testid="elite-job">
          {jobLine(job)}
        </p>
      )}
      <p className="text-xs text-neutral-500">
        Opening positions up to ply {overview.plyCap} are indexed; the database lives at{" "}
        {overview.dbPath}. Newer months can be downloaded from database.nikonoel.fr and imported as
        a file.
      </p>
    </section>
  );
}
