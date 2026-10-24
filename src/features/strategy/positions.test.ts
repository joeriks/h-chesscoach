import { describe, expect, it } from "vitest";
import { attacks } from "chessops/attacks";
import { parseSquare } from "chessops/util";
import { INITIAL_FEN, legalMove, replay } from "../../lib/chess";
import { exerciseFen, PLAN_EXERCISES } from "./positions";

function position(id: string, continuation: string[] = []) {
  const exercise = PLAN_EXERCISES.find((item) => item.id === id)!;
  expect(exercise, id).toBeDefined();
  const moves = [...exercise.moves, ...continuation];
  const result = replay(INITIAL_FEN, moves);
  expect(result.sans, `${id}: ${continuation.join(" ")}`).toHaveLength(moves.length);
  return result.pos;
}

// Concrete witnesses for the moves used in the explanations, including the
// distractors. Legality alone cannot establish strategic quality: the separate
// tactical/structural checks below protect the facts on which the answers rely.
const LEGAL_EXAMPLES: Record<string, string[][]> = {
  "central-break-guided": [
    ["d2d4", "e5d4", "c3d4", "c5b4"],
    ["d2d3"],
    ["a2a4"],
    ["d2d4", "c5b6"],
    ["d2d4", "a7a6"],
  ],
  "central-break-transfer-scotch": [
    ["b1c3", "f6e4"],
    ["c1d2"],
    ["e1f1"],
    ["e1e2"],
    ["b1c3", "d7d6"],
    ["b1c3", "e8g8"],
  ],
  "pawn-chain-guided": [
    ["c7c5", "c2c3"],
    ["f7f6"],
    ["b7b6", "g1f3", "c8b7"],
    ["c7c5", "f1d3"],
    ["c7c5", "a2a3"],
  ],
  "pawn-chain-transfer-pressure": [
    ["c5d4", "c3d4", "d8b6"],
    ["c5c4"],
    ["f7f6"],
    ["c5d4", "f3d4"],
    ["c5d4", "f1e2"],
  ],
  "minority-attack-guided": [
    ["b2b4", "f6e4"],
    ["a2a4"],
    ["e3e4"],
    ["b2b4", "a6a5"],
    ["b2b4", "f8e8"],
  ],
  "minority-attack-transfer-activity": [
    ["g5e7", "d8e7", "d1c2"],
    ["b4b5", "e4c3"],
    ["c3e4", "d5e4"],
    ["c3e4", "d5e4", "d3e4", "a6a5"],
    ["c3e4", "d5e4", "d3e4", "b7b5"],
  ],
  "isolated-pawn-guided": [
    ["f1e2", "b8c6", "e1g1"],
    ["c3d5", "e6d5"],
    ["a2a3", "b8c6", "b2b4"],
    ["f1e2", "b7b6", "e1g1", "c8b7"],
    ["f1e2", "a7a6", "e1g1", "b7b5"],
  ],
  "isolated-pawn-transfer-castled": [
    ["e7f6"],
    ["b7b5"],
    ["f7f5"],
    ["e7f6", "c3d5", "e6d5"],
    ["e7f6", "a2a3"],
    ["e7f6", "a1c1"],
  ],
  "semi-open-file-guided": [
    ["f1e2", "d8c7"],
    ["f1e2", "b7b5"],
    ["f1e2", "e7e5"],
    ["f1e2", "g7g6"],
  ],
  "semi-open-file-transfer-development": [
    ["g2g4"],
    ["c1b1", "d6d5"],
    ["c1b1", "b7b5"],
    ["c1b1", "h7h5"],
    ["h2h4"],
  ],
  "closed-centre-guided": [
    ["c4c5"],
    ["h2h4"],
    ["f3e1", "f6e8", "f2f4"],
    ["a2a3", "f6e8", "b2b4", "f7f5"],
    ["a2a3", "a7a5"],
    ["a2a3", "c7c6"],
  ],
  "closed-centre-transfer-queenside": [
    ["e3f2", "g6g5", "a2a3", "g5g4"],
    ["c4c5", "f4e3"],
    ["b2b4", "f4e3"],
    ["e3f2", "a7a5"],
    ["e3f2", "c7c6"],
  ],
};

describe("middlegame plan content", () => {
  it("provides guided and transfer practice for each of at least six themes", () => {
    expect(PLAN_EXERCISES.length).toBeGreaterThanOrEqual(12);
    const themes = new Map<string, typeof PLAN_EXERCISES>();
    for (const exercise of PLAN_EXERCISES) {
      const items = themes.get(exercise.theme) ?? [];
      items.push(exercise);
      themes.set(exercise.theme, items);
    }
    expect(themes.size).toBeGreaterThanOrEqual(6);
    for (const exercises of themes.values()) {
      expect(exercises.some((exercise) => exercise.kind === "guided")).toBe(true);
      expect(exercises.some((exercise) => exercise.kind === "transfer")).toBe(true);
      const questions = exercises.map((exercise) => exercise.question);
      expect(new Set(questions).size).toBe(questions.length);
    }
  });

  it("uses legal distinct boards, the correct side and one preferred choice per prompt", () => {
    const fens = new Set<string>();
    const ids = new Set<string>();
    for (const exercise of PLAN_EXERCISES) {
      expect(ids.has(exercise.id)).toBe(false);
      ids.add(exercise.id);
      const pos = position(exercise.id);
      const key = exerciseFen(exercise).split(" ").slice(0, 4).join(" ");
      expect(fens.has(key), exercise.id).toBe(false);
      fens.add(key);
      expect(exercise.question.toLowerCase()).toContain(`${pos.turn} to move`);
      for (const options of [exercise.options, exercise.counterplay.options]) {
        expect(options.length).toBeGreaterThanOrEqual(3);
        expect(options.filter((option) => option.preferred)).toHaveLength(1);
        expect(new Set(options.map((option) => option.text)).size).toBe(options.length);
        expect(
          options.every((option) => option.text.length > 10 && option.reason.length > 15),
        ).toBe(true);
      }
    }
  });

  it("does not let answer position reveal the preferred plan or counterplay", () => {
    for (const field of ["options", "counterplay"] as const) {
      const indices = PLAN_EXERCISES.map((exercise) =>
        (field === "options" ? exercise.options : exercise.counterplay.options).findIndex(
          (option) => option.preferred,
        ),
      );
      expect(new Set(indices).size).toBeGreaterThanOrEqual(3);
    }
  });

  it("excludes the impossible stock distractors that previously passed legality-only checks", () => {
    const impossible =
      /pawn.{0,35}(backward|returning to|back to c2)|backward.{0,25}pawn|knight promotion|promot(?:e|ing) (?:a |the )?knight|trad(?:e|ing) (?:a |the )?king|through (?:its|their|black's|white's) own|captured.{0,20}pawn.{0,20}(back|return)|open(?:ing)? (?:a |the )?(?:h-)?file by moving.{0,10}king/i;
    for (const exercise of PLAN_EXERCISES) {
      for (const option of [...exercise.options, ...exercise.counterplay.options]) {
        expect(option.text, exercise.id).not.toMatch(impossible);
      }
    }
  });

  it("can legally play the concrete alternatives and explanatory continuations", () => {
    expect(Object.keys(LEGAL_EXAMPLES).sort()).toEqual(
      PLAN_EXERCISES.map((exercise) => exercise.id).sort(),
    );
    for (const [id, lines] of Object.entries(LEGAL_EXAMPLES)) {
      for (const line of lines) position(id, line);
    }
  });

  it("grounds the central transfer in an actual check and an actual pinned recapture", () => {
    const id = "central-break-transfer-scotch";
    expect(position(id).isCheck()).toBe(true);
    expect(position(id, ["b1c3"]).isCheck()).toBe(false);
    const pinned = position(id, ["b1c3", "f6e4"]);
    expect(legalMove(pinned, "c3e4")).toBeUndefined();
    expect(pinned.board.get(parseSquare("e4")!)).toMatchObject({ color: "black", role: "knight" });
  });

  it("grounds the minority transfer in the loose knight, queen tempo and pawn fork", () => {
    const id = "minority-attack-transfer-activity";
    const pos = position(id);
    const e4 = parseSquare("e4")!;
    const knightTargets = attacks(pos.board.get(e4)!, e4, pos.board.occupied);
    for (const square of ["c3", "g5"] as const)
      expect(knightTargets.has(parseSquare(square)!)).toBe(true);
    expect(pos.board.get(parseSquare("b2")!)).toBeUndefined();
    const afterCapture = position(id, ["b4b5", "e4c3"]);
    const c3 = parseSquare("c3")!;
    expect(
      attacks(afterCapture.board.get(c3)!, c3, afterCapture.board.occupied).has(parseSquare("d1")!),
    ).toBe(true);
    const fork = position(id, ["c3e4", "d5e4"]);
    expect(fork.board.get(e4)).toMatchObject({ color: "black", role: "pawn" });
    const pawnTargets = attacks(fork.board.get(e4)!, e4, fork.board.occupied);
    expect(pawnTargets.has(parseSquare("d3")!)).toBe(true);
    expect(pawnTargets.has(parseSquare("f3")!)).toBe(true);
    expect(fork.board.get(parseSquare("d3")!)?.role).toBe("bishop");
    expect(fork.board.get(parseSquare("f3")!)?.role).toBe("knight");
  });

  it("recognises the existing blockade and the structure after exchanging it", () => {
    const guided = position("isolated-pawn-guided");
    expect(guided.board.get(parseSquare("d5")!)).toMatchObject({ color: "black", role: "knight" });
    expect(legalMove(guided, "d4d5")).toBeUndefined();
    const changed = position("isolated-pawn-transfer-castled", ["e7f6", "c3d5", "e6d5"]);
    for (const [square, color] of [
      ["d4", "white"],
      ["d5", "black"],
    ] as const) {
      expect(changed.board.get(parseSquare(square)!)).toMatchObject({ color, role: "pawn" });
    }
    expect(
      [...changed.board.pawn.intersect(changed.board.black)].every(
        (square) => ![2, 4].includes(square % 8),
      ),
    ).toBe(true);
  });

  it("grounds the remaining transfer answers in their changed board features", () => {
    const chain = position("pawn-chain-transfer-pressure", ["c5d4", "c3d4", "d8b6"]);
    const b6 = parseSquare("b6")!;
    expect(attacks(chain.board.get(b6)!, b6, chain.board.occupied).has(parseSquare("d4")!)).toBe(
      true,
    );
    const file = position("semi-open-file-transfer-development");
    expect(file.board.get(parseSquare("c1")!)).toMatchObject({ color: "white", role: "king" });
    expect(file.board.get(parseSquare("c2")!)).toMatchObject({ color: "white", role: "pawn" });
    const wing = position("closed-centre-transfer-queenside");
    const f4 = parseSquare("f4")!;
    expect(wing.board.get(parseSquare("e3")!)).toMatchObject({ color: "white", role: "bishop" });
    expect(attacks(wing.board.get(f4)!, f4, wing.board.occupied).has(parseSquare("e3")!)).toBe(
      true,
    );
    const sheltered = position("closed-centre-transfer-queenside", ["e3f2"]);
    expect(
      attacks(sheltered.board.get(f4)!, f4, sheltered.board.occupied).has(parseSquare("f2")!),
    ).toBe(false);
  });
});
