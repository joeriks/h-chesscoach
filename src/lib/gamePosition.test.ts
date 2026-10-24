import { expect, it } from "vitest";
import { gameRootFen } from "./gamePosition";
import { INITIAL_FEN } from "./chess";

it("preserves the initial side of a setup PGN and rejects an invalid setup", () => {
  expect(gameRootFen('[FEN "8/8/8/8/8/8/7k/K7 b - - 0 40"]')).toBe("8/8/8/8/8/8/7k/K7 b - - 0 40");
  expect(gameRootFen("1. e4 e5")).toBe(INITIAL_FEN);
  expect(() => gameRootFen('[FEN "broken"]')).toThrow();
});
