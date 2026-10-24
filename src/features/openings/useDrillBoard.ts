import { useCallback, useMemo, useState } from "react";
import type { Key } from "chessground/types";
import type { Chess } from "chessops/chess";
import { makeFen } from "chessops/fen";
import { makeSquare } from "chessops/util";
import {
  dests as legalDests,
  isPromotion,
  legalMove,
  moveFromSquares,
  parseFenSafe,
  standardUci,
} from "../../lib/chess";

export type PromotionRole = "queen" | "rook" | "bishop" | "knight";

/** A board position from a FEN. Existing callers default promotions to queens. */
export function useDrillBoard(fen: string) {
  const parsed = useMemo(() => parseFenSafe(fen), [fen]);
  const pos: Chess | null = parsed.ok ? parsed.pos : null;
  const [revision, setRevision] = useState(0);
  const dests = useMemo(
    () => (pos ? (legalDests(pos) as Map<Key, Key[]>) : new Map<Key, Key[]>()),
    [pos],
  );
  /** Whether this move requires a promotion choice. */
  const isPromotionMove = useCallback(
    (orig: Key, dest: Key): boolean => Boolean(pos && isPromotion(pos, orig, dest)),
    [pos],
  );
  /** Standard UCI for a board move; existing callers default promotions to queens. */
  const uciFor = useCallback(
    (orig: Key, dest: Key, promotion: PromotionRole = "queen"): string | null => {
      if (!pos) return null;
      const move = moveFromSquares(
        orig,
        dest,
        isPromotion(pos, orig, dest) ? promotion : undefined,
      );
      return pos.isLegal(move) ? standardUci(pos, move) : null;
    },
    [pos],
  );
  /** Snaps the board back to the props after a refused move. */
  const snapBack = useCallback(() => setRevision((n) => n + 1), []);
  return {
    pos,
    fen: pos ? makeFen(pos.toSetup()) : fen,
    turn: pos?.turn ?? "white",
    check: pos?.isCheck() ?? false,
    dests,
    uciFor,
    isPromotionMove,
    revision,
    snapBack,
  };
}

/** The squares of a standard-UCI move for highlighting, if legal in `fen`. */
export function squaresOf(fen: string, uci: string): [Key, Key] | undefined {
  const parsed = parseFenSafe(fen);
  if (!parsed.ok) return undefined;
  const m = legalMove(parsed.pos, uci);
  return m ? [makeSquare(m.from), uci.slice(2, 4) as Key] : undefined;
}
