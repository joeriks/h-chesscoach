import type { EngineStatus } from "../../lib/ipc";

/** The one-line engine status shown in Settings, e.g. "Stockfish 19 ready". */
export function engineLabel(status: EngineStatus): string {
  if (status.ready) return `${status.name ?? "Engine"} ready`;
  return `Engine not ready: ${status.error ?? "unknown error"}`;
}
