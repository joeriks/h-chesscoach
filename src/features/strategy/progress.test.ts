import { beforeEach, expect, it, vi } from "vitest";
import { PLAN_EXERCISES } from "./positions";
import {
  dueAt,
  passed,
  rankStrategy,
  readStrategyHistory,
  saveStrategyAttempt,
  STRATEGY_HISTORY_KEY,
  strategyEvidence,
  type StrategyAttempt,
} from "./progress";
const day = 86_400_000;
const record = (id: string, at: number, correct = true): StrategyAttempt => ({
  id: `${id}:${at}`,
  exerciseId: id,
  at,
  planCorrect: correct,
  counterCorrect: correct,
  reason: "central break",
  confidence: "certain",
});
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it("prioritises a due confident error over unseen diagnostics", () => {
  const e = PLAN_EXERCISES.find((e) => e.kind === "guided")!;
  const ranked = rankStrategy([record(e.id, 0, false)], day);
  expect(ranked[0]!.exercise.id).toBe(e.id);
  expect(ranked[0]!.why).toMatch(/confident error/);
});
it("uses a different position in the same theme after success", () => {
  const e = PLAN_EXERCISES.find((e) => e.kind === "guided")!;
  const next = rankStrategy([record(e.id, 1000)], 1001, [e.id])[0]!;
  expect(next.exercise.kind).toBe("transfer");
  expect(next.exercise.theme).toBe(e.theme);
  expect(next.exercise.id).not.toBe(e.id);
});
it("requires both objectives and does not increase interval for same-day repetitions", () => {
  const a = record("x", 1000);
  const b = record("x", 2000);
  expect(passed({ ...a, counterCorrect: false })).toBe(false);
  expect(dueAt("x", [a, b])).toBe(1000 + day);
  expect(dueAt("x", [a, record("x", day + 1000)])).toBe(day + 1000 + 3 * day);
});
it("preserves corrupt history and retries saves idempotently", () => {
  localStorage.setItem(STRATEGY_HISTORY_KEY, "broken");
  expect(() => saveStrategyAttempt(record("x", 1))).toThrow();
  expect(localStorage.getItem(STRATEGY_HISTORY_KEY)).toBe("broken");
  localStorage.clear();
  const a = record("x", 1);
  saveStrategyAttempt(a);
  saveStrategyAttempt(a);
  expect(readStrategyHistory()).toHaveLength(1);
});
it("never rewrites a first transfer failure as a success after memorisation", () => {
  const e = PLAN_EXERCISES.find((e) => e.kind === "transfer")!;
  expect(strategyEvidence([record(e.id, 1, false), record(e.id, 2, true)])).toMatchObject({
    transferTotal: 1,
    transferPassed: 0,
    distinct: 1,
  });
});
