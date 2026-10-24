import { INITIAL_FEN, parseFenSafe } from "./chess";

/** Preserve SetUp/FEN games instead of silently replaying them from the usual start. */
export function gameRootFen(pgn: string): string {
  const fen = /\[FEN\s+"([^"]+)"\]/i.exec(pgn)?.[1];
  if (!fen) return INITIAL_FEN;
  const parsed = parseFenSafe(fen);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.fen;
}
