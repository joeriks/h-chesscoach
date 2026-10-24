// Client-side chess logic with chessops, so the board responds without an IPC round trip.
// Moves are kept in standard UCI (castling as e1g1), the notation Stockfish uses.
import { Chess, normalizeMove } from "chessops/chess";
import { chessgroundDests } from "chessops/compat";
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";
import type { NormalMove, Role, SquareName } from "chessops/types";
import { makeSquare, makeUci, parseSquare, parseUci } from "chessops/util";
import type { Score } from "./ipc";

export { INITIAL_FEN };

export type ParsedFen = { ok: true; pos: Chess; fen: string } | { ok: false; error: string };

/** Validates a FEN, returning the position and its normalised form. */
export function parseFenSafe(fen: string): ParsedFen {
  const setup = parseFen(fen.trim());
  if (setup.isErr) return { ok: false, error: `Invalid FEN (${setup.error.message})` };
  const pos = Chess.fromSetup(setup.value);
  if (pos.isErr) return { ok: false, error: `Illegal position (${pos.error.message})` };
  return { ok: true, pos: pos.value, fen: makeFen(pos.value.toSetup()) };
}

/** Converts a chessops move to standard UCI: castling becomes the king's two-square move. */
export function standardUci(pos: Chess, move: NormalMove): string {
  const piece = pos.board.get(move.from);
  const target = pos.board.get(move.to);
  if (piece?.role === "king" && target?.role === "rook" && target.color === piece.color) {
    const rank = move.from >> 3;
    const file = move.to > move.from ? 6 : 2;
    return makeUci({ from: move.from, to: rank * 8 + file });
  }
  return makeUci(move);
}

/** Parses a standard-UCI move and checks it is legal in `pos`. */
export function legalMove(pos: Chess, uci: string): NormalMove | undefined {
  const parsed = parseUci(uci);
  if (!parsed || !("from" in parsed)) return undefined;
  const move = normalizeMove(pos, parsed) as NormalMove;
  return pos.isLegal(move) ? move : undefined;
}

export interface Replay {
  pos: Chess;
  /** SAN of each move, in order. */
  sans: string[];
  /** The last move as chessground squares, for highlighting. */
  lastMove?: [SquareName, SquareName];
}

/** Plays `moves` (standard UCI) from `fen`. Stops at the first illegal move. */
export function replay(fen: string, moves: string[]): Replay {
  const parsed = parseFenSafe(fen);
  if (!parsed.ok) throw new Error(parsed.error);
  const pos = parsed.pos;
  const sans: string[] = [];
  let lastMove: Replay["lastMove"];
  for (const uci of moves) {
    const move = legalMove(pos, uci);
    if (!move) break;
    lastMove = [makeSquare(move.from), makeSquare(parseUci(uci)!.to)];
    sans.push(makeSanAndPlay(pos, move));
  }
  return { pos, sans, lastMove };
}

/** SAN for an engine PV from `pos` (not modified). Stops at the first illegal move. */
export function pvToSan(pos: Chess, pv: string[], max = 12): string[] {
  const p = pos.clone();
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    const move = legalMove(p, uci);
    if (!move) break;
    out.push(makeSanAndPlay(p, move));
  }
  return out;
}

export interface NumberedMove {
  san: string;
  /** "12." before a White move, "12..." before a first Black move, otherwise null. */
  number: string | null;
}

/** Attaches move numbers to SAN moves starting at `fullmoves` with `whiteToMove`. */
export function numberMoves(
  sans: string[],
  fullmoves: number,
  whiteToMove: boolean,
): NumberedMove[] {
  let n = fullmoves;
  let white = whiteToMove;
  return sans.map((san, i) => {
    const number = white ? `${n}.` : i === 0 ? `${n}...` : null;
    if (!white) n++;
    white = !white;
    return { san, number };
  });
}

/** Move-numbered SAN, e.g. "12...Nf6 13.Bg5 h6", starting from `pos`. */
export function numberedLine(pos: Chess, sans: string[]): string {
  return numberMoves(sans, pos.fullmoves, pos.turn === "white")
    .map((m) => (m.number ? `${m.number}${m.san}` : m.san))
    .join(" ");
}

export function dests(pos: Chess): Map<SquareName, SquareName[]> {
  return chessgroundDests(pos);
}

/** True when moving from `orig` to `dest` is a pawn reaching the last rank. */
export function isPromotion(pos: Chess, orig: string, dest: string): boolean {
  const piece = pos.board.get(parseSquare(orig)!);
  const rank = dest[1];
  return piece?.role === "pawn" && (rank === "8" || rank === "1");
}

export function moveFromSquares(orig: string, dest: string, promotion?: Role): NormalMove {
  return { from: parseSquare(orig)!, to: parseSquare(dest)!, promotion };
}

/** "+0.34", "−1.20", "#3", "#-2", always from White's point of view. */
export function formatScore(score: Score): string {
  if (score.kind === "mate") return `#${score.value}`;
  const pawns = score.value / 100;
  return `${pawns > 0 ? "+" : pawns < 0 ? "−" : ""}${Math.abs(pawns).toFixed(2)}`;
}
