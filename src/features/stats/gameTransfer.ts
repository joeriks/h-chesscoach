import type { GameDetail } from "../../lib/ipc";

export interface PlaySample {
  gameIds: number[];
  games: number;
  moves: number;
  errors: number;
  errorsPer100: number | null;
}
/** Counts only classified moves belonging to the player, with duplicate games excluded. */
export function samplePlay(games: GameDetail[]): PlaySample {
  const seen = new Set<number>();
  const ids: number[] = [];
  let moves = 0;
  let errors = 0;
  for (const game of games) {
    if (seen.has(game.id) || !game.analysis || !game.userColor) continue;
    seen.add(game.id);
    // Nonstandard starting positions need an explicit side-to-move to count correctly.
    const initialTurn = /\[FEN\s+"[^"\s]+\s+([wb])\s/.exec(game.pgn)?.[1] ?? "w";
    let counted = 0;
    for (const ply of game.plies) {
      const color = ply.ply % 2 === 1 ? initialTurn : initialTurn === "w" ? "b" : "w";
      if (color !== game.userColor || !ply.classification) continue;
      counted++;
      moves++;
      if (ply.classification === "mistake" || ply.classification === "blunder") errors++;
    }
    if (counted > 0) ids.push(game.id);
  }
  return {
    gameIds: ids,
    games: ids.length,
    moves,
    errors,
    errorsPer100: moves ? (100 * errors) / moves : null,
  };
}

export function gamesAfterBaseline(
  games: GameDetail[],
  savedAt: number,
  baselineIds: number[],
): GameDetail[] {
  const excluded = new Set(baselineIds);
  return games.filter(
    (g) => !excluded.has(g.id) && g.playedAt !== null && Date.parse(g.playedAt) > savedAt,
  );
}
