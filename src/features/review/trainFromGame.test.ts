import { describe, expect, it } from "vitest";
import type { GameDetail, GameFinding } from "../../lib/ipc";
import { puzzleFromFinding } from "./trainFromGame";

const plies = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "f3g5", "d7d5"];
const game: GameDetail = {
  id: 9,
  source: "lichess",
  sourceGameId: "x",
  playedAt: null,
  timeControl: "180+0",
  timeClass: "blitz",
  white: "Hugo",
  black: "Rival",
  whiteRating: null,
  blackRating: null,
  userColor: "w",
  result: "0-1",
  termination: null,
  eco: "C57",
  openingName: "Two Knights",
  plyCount: plies.length,
  wallClockSec: null,
  pgn: "",
  initialSec: 180,
  plies: plies.map((uci, i) => ({
    ply: i + 1,
    san: "x",
    uci,
    clockMs: null,
    timeSpentMs: null,
    evalCp: null,
    evalMate: null,
    bestUci: null,
    bestPv: i === 8 - 1 ? "e4d5 f6d5 g5f7 e8f7 d1f3" : null,
    winBefore: null,
    winAfter: null,
    classification: null,
  })),
  analysis: null,
  findings: [],
};

const finding: GameFinding = {
  id: 1,
  ply: 9,
  kind: "missed_tactic",
  motifs: ["fork", "discoveredAttack"],
  severity: 25,
  phase: "opening",
  summary: "Missed…",
  bestUci: "e4d5",
  bestSan: "exd5",
};

describe("puzzleFromFinding", () => {
  it("builds a solver-first line from the position before the user's move", () => {
    // Ply 9 is White's move after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5.
    const g = {
      ...game,
      plies: game.plies.map((p) =>
        p.ply === 9 ? { ...p, bestPv: "e4d5 f6d5 g5f7 e8f7 d1f3 g8g7" } : p,
      ),
    };
    g.plies.push({
      ...game.plies[0]!,
      ply: 9,
      uci: "c4d5",
      bestPv: "e4d5 f6d5 g5f7 e8f7 d1f3 g8g7",
    });
    const p = puzzleFromFinding(g, finding);
    expect(p).not.toBeNull();
    expect(p!.id).toBe("game:9#9");
    expect(p!.fen).toBe("r1bqkb1r/ppp2ppp/2n2n2/3pp1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5");
    expect(p!.moves).toEqual(["e4d5", "f6d5", "g5f7", "e8f7", "d1f3"]);
    expect(p!.solverColor).toBe("white");
    expect(p!.ecoFamily).toBe("C");
    expect(p!.themes).toEqual(["fork", "discoveredAttack"]);
  });

  it("gives nothing without a motif or a best line", () => {
    expect(puzzleFromFinding(game, { ...finding, motifs: [] })).toBeNull();
    expect(puzzleFromFinding(game, { ...finding, ply: 3 })).toBeNull();
  });

  it("rejects an engine line that is not legal from the reconstructed root", () => {
    const g = { ...game, plies: [...game.plies] };
    g.plies.push({ ...game.plies[0]!, ply: 9, uci: "c4d5", bestPv: "a1a8" });
    expect(puzzleFromFinding(g, finding)).toBeNull();
  });
});
