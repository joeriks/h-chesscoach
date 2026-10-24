import { describe, expect, it } from "vitest";
import {
  INITIAL_FEN,
  formatScore,
  isPromotion,
  legalMove,
  moveFromSquares,
  numberedLine,
  parseFenSafe,
  pvToSan,
  replay,
  standardUci,
} from "./chess";

const RUY = "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4";

describe("parseFenSafe", () => {
  it("accepts and normalises a legal FEN", () => {
    const r = parseFenSafe(`  ${INITIAL_FEN}  `);
    expect(r.ok && r.fen).toBe(INITIAL_FEN);
  });

  it("rejects garbage and illegal positions", () => {
    expect(parseFenSafe("hello").ok).toBe(false);
    // Side not to move is in check.
    const r = parseFenSafe("4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1");
    expect(r.ok).toBe(false);
  });
});

describe("castling uses standard UCI", () => {
  const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

  it("king onto own rook (chessground's castling gesture) becomes e1g1", () => {
    const r = parseFenSafe(fen);
    if (!r.ok) throw new Error(r.error);
    expect(standardUci(r.pos, moveFromSquares("e1", "h1"))).toBe("e1g1");
    expect(standardUci(r.pos, moveFromSquares("e1", "a1"))).toBe("e1c1");
    expect(standardUci(r.pos, moveFromSquares("e1", "f1"))).toBe("e1f1");
  });

  it("replays e1g1 and e8c8 as castling", () => {
    const { sans, pos } = replay(fen, ["e1g1", "e8c8"]);
    expect(sans).toEqual(["O-O", "O-O-O"]);
    expect(pos.board.get(5)?.role).toBe("rook"); // f1
  });
});

describe("engine lines", () => {
  it("turns a Stockfish PV into numbered SAN", () => {
    const r = parseFenSafe(RUY);
    if (!r.ok) throw new Error(r.error);
    const sans = pvToSan(r.pos, ["b5a4", "g8f6", "e1g1", "f8e7"]);
    expect(sans).toEqual(["Ba4", "Nf6", "O-O", "Be7"]);
    expect(numberedLine(r.pos, sans)).toBe("4.Ba4 Nf6 5.O-O Be7");
  });

  it("numbers a line that starts with Black to move", () => {
    const { pos } = replay(INITIAL_FEN, ["e2e4"]);
    expect(numberedLine(pos, pvToSan(pos, ["e7e5", "g1f3"]))).toBe("1...e5 2.Nf3");
  });

  it("stops at an illegal PV move instead of throwing", () => {
    const r = parseFenSafe(INITIAL_FEN);
    if (!r.ok) throw new Error(r.error);
    expect(pvToSan(r.pos, ["e2e4", "e2e4"])).toEqual(["e4"]);
    expect(legalMove(r.pos, "e1e2")).toBeUndefined();
  });
});

describe("helpers", () => {
  it("formats scores from White's view", () => {
    expect(formatScore({ kind: "cp", value: 34 })).toBe("+0.34");
    expect(formatScore({ kind: "cp", value: -120 })).toBe("−1.20");
    expect(formatScore({ kind: "cp", value: 0 })).toBe("0.00");
    expect(formatScore({ kind: "mate", value: 3 })).toBe("#3");
    expect(formatScore({ kind: "mate", value: -2 })).toBe("#-2");
  });

  it("detects promotions", () => {
    const r = parseFenSafe("8/4P3/8/8/8/8/k7/4K3 w - - 0 1");
    if (!r.ok) throw new Error(r.error);
    expect(isPromotion(r.pos, "e7", "e8")).toBe(true);
    expect(isPromotion(r.pos, "e1", "d1")).toBe(false);
    const { sans } = replay("8/4P3/8/8/8/8/k7/4K3 w - - 0 1", ["e7e8n"]);
    expect(sans).toEqual(["e8=N"]);
  });
});
