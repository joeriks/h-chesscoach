// Pure puzzle-solving rules (PLAN.md 2.3.2 step 5), kept free of React so they are easy to test.
import type { Chess } from "chessops/chess";
import { legalMove, replay } from "../../lib/chess";
import type { Puzzle } from "../../lib/ipc";

export type MoveVerdict = "correct" | "mate-alternative" | "wrong";

/** The position after `ply` moves of the puzzle line have been played. */
export function positionAt(puzzle: Puzzle, ply: number): Chess {
  return replay(puzzle.fen, puzzle.moves.slice(0, ply)).pos;
}

/**
 * Judges the user's move at `ply` (0-based index into `puzzle.moves`, always a solver move).
 * The scripted move is correct. On the final move, any move that gives checkmate is also
 * accepted (the Lichess rule). Anything else is wrong.
 */
export function judgeMove(puzzle: Puzzle, ply: number, uci: string): MoveVerdict {
  if (uci === puzzle.moves[ply]) return "correct";
  const isLast = ply === puzzle.moves.length - 1;
  if (!isLast) return "wrong";
  const pos = positionAt(puzzle, ply);
  const move = legalMove(pos, uci);
  if (!move) return "wrong";
  const after = pos.clone();
  after.play(move);
  return after.isCheckmate() ? "mate-alternative" : "wrong";
}

/** The ply of the opponent's scripted reply after the solver's move at `ply`, if any. */
export function replyPly(puzzle: Puzzle, ply: number): number | null {
  return ply + 1 < puzzle.moves.length ? ply + 1 : null;
}

export function isSolved(puzzle: Puzzle, ply: number): boolean {
  return ply >= puzzle.moves.length;
}

/** "Mate in 2", "Fork", "Endgame" … from a Lichess theme id. */
export function themeLabel(theme: string): string {
  const special: Record<string, string> = {
    mateIn1: "Mate in 1",
    mateIn2: "Mate in 2",
    mateIn3: "Mate in 3",
    mateIn4: "Mate in 4",
    mateIn5: "Mate in 5",
    xRayAttack: "X-ray attack",
    oneMove: "One move",
    veryLong: "Very long",
    masterVsMaster: "Master vs master",
  };
  if (special[theme]) return special[theme];
  const spaced = theme.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** General coaching prompts: useful without pretending we know a position-specific reason. */
export function coachingHint(themes: string[], stage: number): string {
  const motif = themes[0] ? themeLabel(themes[0]).toLowerCase() : "tactical idea";
  if (stage <= 1) return `Look for checks, captures, and threats; this puzzle features ${motif}.`;
  if (stage === 2)
    return "Compare forcing moves first. Which piece can create the most urgent problem?";
  return "The highlighted piece is a candidate. Calculate your opponent's strongest reply before moving.";
}

export function coachingExplanation(themes: string[]): string {
  const labels = themes.slice(0, 2).map(themeLabel).join(" and ");
  return labels
    ? `Study the ${labels.toLowerCase()} pattern: use forcing moves, then verify the opponent's best defence.`
    : "Study the forcing moves and verify the opponent's best defence.";
}
