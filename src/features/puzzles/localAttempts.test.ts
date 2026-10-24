import { afterEach, describe, expect, it } from "vitest";
import type { Puzzle } from "../../lib/ipc";
import {
  LOCAL_ATTEMPTS_KEY,
  dueLocalRetries,
  localAttemptSummary,
  resolveLocalReminder,
  saveLocalAttempt,
} from "./localAttempts";

const puzzle: Puzzle = {
  id: "game:2#11",
  fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
  moves: ["a1a2"],
  rating: 0,
  eco: "",
  ecoFamily: "",
  opening: "",
  themes: ["fork"],
  solverColor: "white",
};

afterEach(() => localStorage.removeItem(LOCAL_ATTEMPTS_KEY));

describe("local game attempts", () => {
  it("does not increase recall intervals through immediate repetition, and resets after failure", () => {
    const first = saveLocalAttempt(puzzle, "solved", 1, 0, 1000);
    const repeat = saveLocalAttempt(puzzle, "solved", 1, 0, 2000);
    expect(first.retryCount).toBe(1);
    expect(repeat.retryCount).toBe(1);
    expect(repeat.dueAt).toBe(2000 + 24 * 60 * 60_000);
    const failed = saveLocalAttempt(puzzle, "failed", 1, 0, 3000);
    expect(failed.dueAt).toBe(3000 + 10 * 60_000);
  });
  it("removes a completed database reminder from the due queue without deleting its history", () => {
    saveLocalAttempt(puzzle, "skipped", 1, 0, 1000);
    resolveLocalReminder(puzzle.id);
    expect(dueLocalRetries(Number.MAX_SAFE_INTEGER)).toEqual([]);
    expect(localAttemptSummary().total).toBe(1);
  });
  it("stores the source puzzle and schedules a delayed retry", () => {
    const now = 1_000;
    const saved = saveLocalAttempt(puzzle, "skipped", 1200, 1, now);
    expect(saved.puzzle).toEqual(puzzle);
    expect(saved.dueAt).toBe(now + 10 * 60_000);
    expect(dueLocalRetries(now)).toEqual([]);
    expect(dueLocalRetries(saved.dueAt!)).toHaveLength(1);
  });

  it("uses only the latest attempt for a source position", () => {
    saveLocalAttempt(puzzle, "failed", 1, 0, 1_000);
    saveLocalAttempt(puzzle, "solved", 1, 0, 2_000);
    expect(dueLocalRetries(Number.MAX_SAFE_INTEGER)).toHaveLength(1);
  });

  it("counts delayed outcomes from the immediately previous attempt, not the initial try", () => {
    saveLocalAttempt(puzzle, "failed", 1, 0, 1_000);
    saveLocalAttempt(puzzle, "solved", 1, 0, 1_000 + 24 * 60 * 60_000);
    saveLocalAttempt(puzzle, "failed", 1, 0, 1_000 + 24 * 60 * 60_000 + 1_000);
    expect(localAttemptSummary()).toMatchObject({
      delayedAttempts: 1,
      delayedCleanSolves: 1,
      sameDayPractice: 1,
    });
  });
});
