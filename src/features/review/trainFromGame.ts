import { makeFen } from "chessops/fen";
import { legalMove, replay } from "../../lib/chess";
import { gameRootFen } from "../../lib/gamePosition";
import type { GameDetail, GameFinding, Puzzle } from "../../lib/ipc";
import { trainableTheme } from "./reviewText";

/** Ids of puzzles made from the user's own games, which have no database row. */
export const GAME_PUZZLE_PREFIX = "game:";

/**
 * The position of a finding as puzzle #0 of a training set: the user's own missed moment,
 * with the engine's best line (solver first and odd length) as the suggested line.
 */
export function puzzleFromFinding(game: GameDetail, finding: GameFinding): Puzzle | null {
  const theme = trainableTheme(finding);
  const ply = game.plies.find((p) => p.ply === finding.ply);
  const pv = (ply?.bestPv ?? "").split(" ").filter(Boolean);
  if (!theme || pv.length === 0) return null;
  let fen: string;
  try {
    const before = game.plies.slice(0, finding.ply - 1).map((p) => p.uci);
    const position = replay(gameRootFen(game.pgn), before);
    if (position.sans.length !== before.length) return null;
    fen = makeFen(position.pos.toSetup());
  } catch {
    return null;
  }
  // A PV can end after either side's move. Keep all solver moves, but only if every UCI move
  // actually applies to the reconstructed root position. Never construct an unplayable trainer.
  const moves = pv.slice(0, pv.length % 2 === 1 ? pv.length : pv.length - 1);
  if (moves.length === 0) return null;
  try {
    const pos = replay(fen, []).pos;
    for (const uci of moves) {
      const move = legalMove(pos, uci);
      if (!move) return null;
      pos.play(move);
    }
  } catch {
    return null;
  }
  return {
    id: `${GAME_PUZZLE_PREFIX}${game.id}#${finding.ply}`,
    fen,
    moves,
    rating: 0,
    eco: game.eco ?? "",
    ecoFamily: game.eco?.[0] ?? "",
    opening: game.openingName ?? "",
    themes: finding.motifs,
    solverColor: replay(fen, []).pos.turn,
  };
}
