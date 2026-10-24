import type { PgnImportSummary } from "../../lib/ipc";

export function importSummaryText(s: PgnImportSummary): string {
  const parts = [`${s.inserted} game${s.inserted === 1 ? "" : "s"} imported`];
  if (s.duplicates) parts.push(`${s.duplicates} already in the library`);
  if (s.rejected.length) parts.push(`${s.rejected.length} could not be read`);
  if (s.unassigned) parts.push(`${s.unassigned} without your side yet`);
  return parts.join(", ") + ".";
}
