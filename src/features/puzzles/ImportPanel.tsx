import { useState } from "react";
import type { ImportReport, PuzzleImportState, PuzzleImportStatus } from "../../lib/ipc";

interface ImportPanelProps {
  status: PuzzleImportStatus;
  job: PuzzleImportState;
  onStart: (folder: string | null) => void;
  onCancel: () => void;
  /** Shown as a compact strip when puzzles already exist and nothing is pending. */
  compact?: boolean;
}

function mb(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
}

export function ImportPanel({ status, job, onStart, onCancel, compact }: ImportPanelProps) {
  const [folder, setFolder] = useState("");
  const [showRejects, setShowRejects] = useState(false);
  const running = job.state === "running";
  const report: ImportReport | null =
    job.state === "done" ? job : status.lastReport && !running ? status.lastReport : null;

  // Once everything is in, a line is enough. An import that just finished in this session
  // adds its result to that line, so the outcome is not lost.
  if (compact && !running && status.pendingFiles === 0) {
    return (
      <p className="text-xs text-neutral-500" data-testid="import-summary">
        {status.puzzlesInDb.toLocaleString()} puzzles from {status.importedFiles} files.
        {job.state === "done" &&
          ` Just imported ${job.imported.toLocaleString()} in ${duration(job.elapsedMs)}` +
            (job.rejected > 0 ? `, ${job.rejected} rejected.` : ", nothing rejected.")}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded border border-neutral-800 p-4" aria-label="Puzzle import">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Puzzle database
      </h2>
      {status.folder ? (
        <p className="text-sm text-neutral-300">
          <span className="break-all font-mono text-xs text-neutral-400">{status.folder}</span>
          <br />
          {status.files} PGN files, {mb(status.totalBytes)}.{" "}
          {status.puzzlesInDb > 0 && `${status.puzzlesInDb.toLocaleString()} puzzles imported.`}{" "}
          {status.pendingFiles > 0 && `${status.pendingFiles} files new or changed.`}
        </p>
      ) : (
        <p className="text-sm text-amber-400">
          No puzzle folder found. Enter the path to the "Lichess puzzles by ECO" folder.
        </p>
      )}

      {running ? (
        <div className="space-y-2" data-testid="import-progress">
          <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
            <div
              className="h-full bg-emerald-600 transition-[width]"
              style={{ width: `${job.filesTotal ? (100 * job.filesDone) / job.filesTotal : 0}%` }}
            />
          </div>
          <p className="text-sm text-neutral-300">
            Importing {job.currentFile}: file {job.filesDone + 1} of {job.filesTotal},{" "}
            {job.imported.toLocaleString()} puzzles so far
            {job.rejected > 0 && `, ${job.rejected} rejected`}
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-neutral-700 px-2.5 py-1 text-sm hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder={status.folder ?? "C:\\…\\Lichess puzzles by ECO"}
            aria-label="Puzzle folder"
            className="min-w-64 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => onStart(folder.trim() || null)}
            className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
          >
            {status.puzzlesInDb > 0 ? "Import new files" : "Import puzzles"}
          </button>
        </div>
      )}

      {job.state === "failed" && (
        <p className="text-sm text-red-400" role="alert">
          Import failed: {job.error}
        </p>
      )}

      {report && (
        <div className="space-y-1 text-sm text-neutral-300" data-testid="import-report">
          <p>
            Last import: {report.imported.toLocaleString()} puzzles from{" "}
            {report.files - report.filesSkipped} files in {duration(report.elapsedMs)}
            {report.filesSkipped > 0 && ` (${report.filesSkipped} unchanged files skipped)`}.{" "}
            {report.duplicates > 0 && `${report.duplicates} duplicates ignored. `}
            {report.rejected > 0 ? (
              <button
                type="button"
                onClick={() => setShowRejects((v) => !v)}
                className="text-amber-400 underline"
              >
                {report.rejected} rejected
              </button>
            ) : (
              "Nothing rejected."
            )}
          </p>
          {showRejects && (
            <div className="max-h-48 overflow-auto rounded bg-neutral-950 p-2 font-mono text-xs">
              {report.rejectReasons.map(([reason, n]) => (
                <div key={reason}>
                  {n} × {reason}
                </div>
              ))}
              <div className="mt-2 text-neutral-500">First rejected records:</div>
              {report.rejects.slice(0, 50).map((r, i) => (
                <div key={i} className="text-neutral-400">
                  {r.file} {r.site}: {r.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
