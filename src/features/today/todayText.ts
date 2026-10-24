import type { PlanTask, Streak } from "../../lib/ipc";

/** "12–19 min" for a game block, "15 min (10–22)" for anything else. */
export function lengthLabel(t: PlanTask): string {
  if (t.kind === "play_game" && t.estimate) {
    const p20 = Math.round(t.estimate.p20Sec / 60);
    const p80 = Math.round(t.estimate.p80Sec / 60);
    return `${t.plannedMin} min reserved · usually ${p20}–${p80} min${
      t.estimate.source === "learned" ? " for you" : ""
    }`;
  }
  if (t.minMin === t.maxMin) return `${t.plannedMin} min`;
  return `${t.plannedMin} min (${t.minMin}–${t.maxMin})`;
}

export function stateLabel(t: PlanTask): string | null {
  switch (t.state) {
    case "done":
      return `Done · ${t.actualMin ?? t.plannedMin} min`;
    case "skipped":
      return "Skipped";
    case "dropped":
      return "Moved to tomorrow";
    case "active":
      return "In progress";
    default:
      return t.carried ? "From yesterday" : null;
  }
}

/** Elapsed time of an active block as "m:ss". */
export function elapsedLabel(startedAt: string, now: number): string {
  const sec = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function streakLine(s: Streak): string {
  const days = s.days === 0 ? "No streak yet" : `${s.days}-day streak`;
  return `${days} · ${s.minutesToday} min today · ${s.minutesThisWeek} min this week`;
}

/** Minutes left of a plan: budget minus done (actual) and active (planned) tasks. */
export function minutesLeft(tasks: PlanTask[], budget: number): number {
  const used = tasks.reduce((sum, t) => {
    if (t.state === "done") return sum + (t.actualMin ?? t.plannedMin);
    if (t.state === "active") return sum + t.plannedMin;
    return sum;
  }, 0);
  return Math.max(0, budget - used);
}
