import type { EliteJob } from "../../lib/ipc";

/** One line for the running Elite import job. */
export function jobLine(job: EliteJob): string | null {
  switch (job.state) {
    case "running": {
      if (job.phase === "importing") {
        const pct = job.bytesTotal > 0 ? Math.round((100 * job.bytesDone) / job.bytesTotal) : 0;
        return `Importing ${job.month} (${job.monthsDone + 1} of ${job.monthsTotal}): ${pct}% of the file, ${job.games.toLocaleString()} games so far, ${Math.round(job.elapsedMs / 1000)} s`;
      }
      if (job.phase === "model games") {
        return `Vetting model games (${job.monthsDone + 1} of ${job.monthsTotal} lines), ${Math.round(job.elapsedMs / 1000)} s`;
      }
      return `${job.phase[0]!.toUpperCase()}${job.phase.slice(1)}… ${Math.round(job.elapsedMs / 1000)} s`;
    }
    case "done":
      return `Done: ${job.months} month${job.months === 1 ? "" : "s"}, ${job.games.toLocaleString()} games, model games for ${job.modelLines} lines, ${Math.round(job.elapsedMs / 1000)} s.`;
    case "failed":
      return `Import failed: ${job.error}`;
    case "cancelled":
      return "Import cancelled.";
    default:
      return null;
  }
}

export function mb(bytes: number): string {
  return bytes >= 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
    : `${Math.round(bytes / 1024 / 1024)} MB`;
}
