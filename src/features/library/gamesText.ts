import type { GameSummary } from "../../lib/ipc";

/** "W" / "L" / "D" from the user's side, or the raw result when the side is unknown. */
export function outcomeFor(game: GameSummary): {
  label: string;
  tone: "win" | "loss" | "draw" | "none";
} {
  if (game.result === "*") return { label: "*", tone: "none" };
  if (!game.userColor) return { label: game.result, tone: "none" };
  if (game.result === "1/2-1/2") return { label: "D", tone: "draw" };
  const userWon = (game.result === "1-0") === (game.userColor === "w");
  return userWon ? { label: "W", tone: "win" } : { label: "L", tone: "loss" };
}

export function describeGame(game: GameSummary): string {
  const date = game.playedAt ? game.playedAt.slice(0, 10) : "unknown date";
  const w = game.whiteRating ? `${game.white} (${game.whiteRating})` : game.white;
  const b = game.blackRating ? `${game.black} (${game.blackRating})` : game.black;
  return `${date} · ${w} vs ${b}`;
}

export function sourceLabel(source: GameSummary["source"]): string {
  return source === "lichess" ? "Lichess" : source === "chesscom" ? "Chess.com" : "PGN";
}
