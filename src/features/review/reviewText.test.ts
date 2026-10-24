import { describe, expect, it } from "vitest";
import type { GameFinding, GamePly } from "../../lib/ipc";
import { classificationMark, keyMoments, moveLabel, whiteWinAfter } from "./reviewText";

function ply(
  n: number,
  winAfter: number | null,
  classification: GamePly["classification"] = null,
): GamePly {
  return {
    ply: n,
    san: "x",
    uci: "a1a2",
    clockMs: null,
    timeSpentMs: null,
    evalCp: null,
    evalMate: null,
    bestUci: null,
    bestPv: null,
    winBefore: null,
    winAfter,
    classification,
  };
}

function finding(id: number, plyNo: number, severity: number): GameFinding {
  return {
    id,
    ply: plyNo,
    kind: "missed_tactic",
    motifs: ["fork"],
    severity,
    phase: "middlegame",
    summary: "…",
    bestUci: null,
    bestSan: null,
  };
}

describe("reviewText", () => {
  it("marks errors only", () => {
    expect(classificationMark("blunder")?.text).toBe("??");
    expect(classificationMark("mistake")?.text).toBe("?");
    expect(classificationMark("inaccuracy")?.text).toBe("?!");
    expect(classificationMark("good")).toBeNull();
    expect(classificationMark(null)).toBeNull();
  });

  it("turns mover-relative win chances into White's", () => {
    const plies = [ply(1, 60), ply(2, 70), ply(3, null)];
    expect(whiteWinAfter(plies, 1)).toBe(60);
    expect(whiteWinAfter(plies, 2)).toBe(30);
    expect(whiteWinAfter(plies, 3)).toBeNull();
    expect(whiteWinAfter(plies, 9)).toBeNull();
  });

  it("picks the most severe moments, one per ply, in game order", () => {
    const all = [
      finding(1, 30, 12),
      finding(2, 10, 40),
      finding(3, 10, 5),
      finding(4, 20, 25),
      finding(5, 40, 1),
    ];
    const key = keyMoments(all, 3);
    expect(key.map((f) => f.id)).toEqual([2, 4, 1]);
    // The moment the user navigated to is always listed, even if it is minor.
    expect(keyMoments(all, 3, 40).map((f) => f.id)).toEqual([2, 4, 5]);
    expect(keyMoments(all, 3, 99).map((f) => f.id)).toEqual([2, 4, 1]);
    expect(moveLabel(1)).toBe("1.");
    expect(moveLabel(2)).toBe("1…");
    expect(moveLabel(21)).toBe("11.");
  });
});
