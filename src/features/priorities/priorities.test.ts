import { expect, it } from "vitest";
import type { ThemeWeakness } from "../../lib/ipc";
import { trainingPriorities } from "./priorities";
const weakness = (theme: string, n: number, misses: number, games: number): ThemeWeakness => ({
  theme,
  opportunities: n,
  misses,
  missRate: misses / n,
  evidenceGames: games,
  evidence: [
    {
      gameId: 1,
      ply: 12,
      summary: "example",
      white: "w",
      black: "b",
      playedAt: null,
      result: "*",
      userColor: "w",
    },
  ],
  score: 1,
  puzzleRating: null,
  puzzleGap: null,
});
it("chooses a repeated pattern over a one-game perfect miss rate", () => {
  const items = trainingPriorities(
    [],
    [],
    [weakness("fork", 1, 1, 1), weakness("pin", 30, 15, 8)],
    15,
    1000,
  );
  expect(items[0]!.target).toEqual({ kind: "puzzle", theme: "pin" });
  expect(items.find((i) => i.id === "review:fork")!.target.kind).toBe("review");
});
it("respects time budget and treats missing data as a diagnostic", () => {
  const items = trainingPriorities([], [], [], 5, 1000);
  expect(items).toHaveLength(1);
  expect(items[0]!.title).toMatch(/baseline/);
  expect(items.reduce((n, i) => n + i.minutes, 0)).toBeLessThanOrEqual(5);
  expect(trainingPriorities([], [], [], 0)).toEqual([]);
});
it("ignores impossible opportunity counts", () => {
  expect(
    trainingPriorities([], [], [weakness("bad", 2, 3, 8)], 15).some((i) => i.id === "theme:bad"),
  ).toBe(false);
});
