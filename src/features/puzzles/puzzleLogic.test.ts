import { describe, expect, it } from "vitest";
import type { Puzzle } from "../../lib/ipc";
import { isSolved, judgeMove, positionAt, replyPly, themeLabel } from "./puzzleLogic";

// From PLAN.md 0.2: 46. Nxe7+ Kf7 47. Nxg6, White to move.
const fork: Puzzle = {
  id: "xsX2JM7h#90",
  fen: "6k1/B3p1b1/KpN3r1/1P5p/8/8/8/8 w - - 0 46",
  moves: ["c6e7", "g8f7", "e7g6"],
  rating: 1282,
  eco: "D99",
  ecoFamily: "D",
  opening: "Grünfeld Defense",
  themes: ["endgame", "equality", "fork", "short"],
  solverColor: "white",
};

// Back rank: 1.Rd8# is scripted, 1.Ra1 is not mate.
const backRank: Puzzle = {
  ...fork,
  id: "aaaaaaaa#1",
  fen: "6k1/5ppp/8/8/8/8/5PPP/R2R2K1 w - - 0 1",
  moves: ["d1d8"],
  themes: ["mateIn1", "backRankMate"],
};

describe("judgeMove", () => {
  it("accepts the scripted move and rejects others mid-line", () => {
    expect(judgeMove(fork, 0, "c6e7")).toBe("correct");
    expect(judgeMove(fork, 0, "a7b6")).toBe("wrong");
  });

  it("accepts any mating move on the final move", () => {
    expect(judgeMove(backRank, 0, "d1d8")).toBe("correct");
    expect(judgeMove(backRank, 0, "a1a8")).toBe("mate-alternative");
    expect(judgeMove(backRank, 0, "a1a7")).toBe("wrong");
    expect(judgeMove(backRank, 0, "zz99")).toBe("wrong");
  });

  it("does not accept a non-mating alternative on the final move", () => {
    // After Nxe7+ Kf7 the scripted Nxg6 wins the rook; Nc8 is legal but not it.
    expect(judgeMove(fork, 2, "e7c8")).toBe("wrong");
  });
});

describe("line walking", () => {
  it("replays the opponent's reply and knows when the puzzle is solved", () => {
    expect(replyPly(fork, 0)).toBe(1);
    expect(replyPly(fork, 2)).toBeNull();
    expect(isSolved(fork, 3)).toBe(true);
    expect(isSolved(fork, 2)).toBe(false);
    expect(positionAt(fork, 2).turn).toBe("white");
  });
});

describe("themeLabel", () => {
  it("humanises Lichess theme ids", () => {
    expect(themeLabel("mateIn2")).toBe("Mate in 2");
    expect(themeLabel("hangingPiece")).toBe("Hanging piece");
    expect(themeLabel("fork")).toBe("Fork");
    expect(themeLabel("rookEndgame")).toBe("Rook endgame");
  });
});
