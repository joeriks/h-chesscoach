import { expect, it } from "vitest";
import type { GameDetail } from "../../lib/ipc";
import { gamesAfterBaseline, samplePlay } from "./gameTransfer";

const game = (extra: Partial<GameDetail> = {}): GameDetail =>
  ({
    id: 1,
    userColor: "w",
    analysis: { analyzedAt: "2026-01-01", preset: "quick", nodes: 1 },
    playedAt: "2026-02-01T12:00:00Z",
    pgn: "",
    plies: [
      { ply: 1, classification: "good" },
      { ply: 2, classification: "blunder" },
      { ply: 3, classification: "mistake" },
      { ply: 4, classification: "good" },
      { ply: 5, classification: null },
    ],
    ...extra,
  }) as GameDetail;

it("counts only classified player moves, excludes duplicate and unknown-side games", () => {
  expect(samplePlay([game(), game(), game({ id: 2, userColor: null })])).toMatchObject({
    games: 1,
    moves: 2,
    errors: 1,
    errorsPer100: 50,
  });
});
it("handles a PGN starting with Black to move", () => {
  expect(samplePlay([game({ pgn: '[FEN "8/8/8/8/8/8/K6r/7k b - - 0 1"]' })])).toMatchObject({
    moves: 2,
    errors: 1,
  });
});
it("does not mistake imported old games or baseline games for new play", () => {
  const baselineAt = Date.parse("2026-01-20T00:00:00Z");
  expect(
    gamesAfterBaseline(
      [
        game(),
        game({ id: 2, playedAt: "2026-01-10" }),
        game({ id: 3 }),
        game({ id: 4, playedAt: null }),
      ],
      baselineAt,
      [1],
    ).map((g) => g.id),
  ).toEqual([3]);
});
