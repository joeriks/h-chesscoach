import { PLAN_EXERCISES, type PlanExercise } from "./positions";

export const STRATEGY_HISTORY_KEY = "chesscoach.strategy.v1";
const DAY = 86_400_000;
export interface StrategyAttempt {
  id: string;
  exerciseId: string;
  at: number;
  planCorrect: boolean;
  counterCorrect: boolean;
  confidence: "unsure" | "fairly" | "certain";
  reason: string;
}
export function readStrategyHistory(): StrategyAttempt[] {
  const raw = localStorage.getItem(STRATEGY_HISTORY_KEY);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    !value.every(
      (a: Partial<StrategyAttempt>) =>
        a &&
        typeof a.id === "string" &&
        typeof a.exerciseId === "string" &&
        typeof a.at === "number" &&
        Number.isFinite(a.at) &&
        a.at >= 0 &&
        typeof a.planCorrect === "boolean" &&
        typeof a.counterCorrect === "boolean" &&
        ["unsure", "fairly", "certain"].includes(a.confidence ?? "") &&
        typeof a.reason === "string",
    )
  )
    throw new Error("Training history could not be read. It has been preserved.");
  return value;
}
export function saveStrategyAttempt(attempt: StrategyAttempt): void {
  const history = readStrategyHistory();
  if (history.some((a) => a.id === attempt.id)) return;
  localStorage.setItem(STRATEGY_HISTORY_KEY, JSON.stringify([...history, attempt]));
}
export const passed = (a: StrategyAttempt) => a.planCorrect && a.counterCorrect;
export function dueAt(exerciseId: string, history: StrategyAttempt[]): number | null {
  const attempts = history.filter((a) => a.exerciseId === exerciseId).sort((a, b) => a.at - b.at);
  const last = attempts.at(-1);
  if (!last) return null;
  if (!passed(last)) return last.at + 10 * 60_000;
  // Only successful recalls separated by a full day extend the interval.
  let count = 0;
  let previous = -Infinity;
  for (const a of attempts) {
    if (!passed(a)) {
      count = 0;
      previous = -Infinity;
    } else if (a.at - previous >= DAY) {
      count++;
      previous = a.at;
    }
  }
  return previous + [DAY, 3 * DAY, 7 * DAY][Math.min(Math.max(count - 1, 0), 2)]!;
}
export interface StrategyChoice {
  exercise: PlanExercise;
  why: string;
  priority: number;
}
export function rankStrategy(
  history: StrategyAttempt[],
  now = Date.now(),
  excluded: string[] = [],
): StrategyChoice[] {
  return PLAN_EXERCISES.filter((e) => !excluded.includes(e.id))
    .map((exercise) => {
      const own = history
        .filter((a) => a.exerciseId === exercise.id && a.at <= now)
        .sort((a, b) => a.at - b.at);
      const last = own.at(-1);
      const themeIds = new Set(
        PLAN_EXERCISES.filter((e) => e.theme === exercise.theme).map((e) => e.id),
      );
      const latestByPosition = new Map<string, StrategyAttempt>();
      for (const a of [...history].sort((a, b) => a.at - b.at))
        if (themeIds.has(a.exerciseId) && a.at <= now) latestByPosition.set(a.exerciseId, a);
      const themeAttempts = [...latestByPosition.values()];
      const failure = themeAttempts.some((a) => !passed(a));
      const ready = themeAttempts.some(passed);
      const due = dueAt(exercise.id, own);
      if (last && due !== null && due <= now)
        return {
          exercise,
          priority: passed(last) ? 65 : 95,
          why: passed(last)
            ? "A delayed recall is due. Check whether the idea stayed with you."
            : `${last.confidence === "certain" ? "A confident error" : "An error"} needs another attempt at the plan and opponent's reply.`,
        };
      if (!last && exercise.kind === "transfer" && ready)
        return {
          exercise,
          priority: failure ? 85 : 80,
          why: "Apply a practised idea to a different position before claiming understanding.",
        };
      if (!last && exercise.kind === "guided")
        return {
          exercise,
          priority: failure ? 75 : 55,
          why: failure
            ? "Another example targets a theme you found difficult."
            : "No result yet for this position: use it as a diagnostic, not a known weakness.",
        };
      return {
        exercise,
        priority: last ? 10 : 30,
        why: last
          ? "Optional extra practice; this position is not due yet."
          : "A more demanding diagnostic in an unfamiliar position.",
      };
    })
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.exercise.level - b.exercise.level ||
        a.exercise.id.localeCompare(b.exercise.id),
    );
}
export function strategyEvidence(history: StrategyAttempt[]) {
  const first = new Map<string, StrategyAttempt>();
  for (const a of [...history].sort((a, b) => a.at - b.at))
    if (!first.has(a.exerciseId)) first.set(a.exerciseId, a);
  const transferIds = new Set(PLAN_EXERCISES.filter((e) => e.kind === "transfer").map((e) => e.id));
  const transfer = [...first.values()].filter((a) => transferIds.has(a.exerciseId));
  return {
    distinct: first.size,
    transferTotal: transfer.length,
    transferPassed: transfer.filter(passed).length,
  };
}
