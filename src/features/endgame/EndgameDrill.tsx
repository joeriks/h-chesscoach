import { useEffect, useRef, useState } from "react";
import type { Key } from "chessground/types";
import { Board } from "../../components/board/Board";
import { ipc, type DrillPosition } from "../../lib/ipc";
import { squaresOf, type PromotionRole, useDrillBoard } from "../openings/useDrillBoard";
import { BOARD_SIZE } from "../puzzles/PuzzleSolver";

export const REPLY_DELAY_MS = 400;

type Phase = "play" | "busy" | "done" | "failed";

/** One drill position: the user plays, the tablebase judges and defends. */
export function EndgameDrill({
  lessonId,
  index,
  position,
  onResult,
  onNext,
  saveError,
  onRetrySave,
  saving = false,
}: {
  lessonId: string;
  index: number;
  position: DrillPosition;
  onResult: (success: boolean) => void;
  onNext: () => void;
  saveError?: string | null;
  onRetrySave?: () => void;
  saving?: boolean;
}) {
  const [fen, setFen] = useState(position.fen);
  const [lastMove, setLastMove] = useState<[Key, Key] | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("play");
  const [message, setMessage] = useState<string>(position.note);
  const [moves, setMoves] = useState(0);
  const [promotion, setPromotion] = useState<{ orig: Key; dest: Key } | null>(null);
  const board = useDrillBoard(fen);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const finish = (success: boolean, text: string) => {
    setPhase(success ? "done" : "failed");
    setMessage(text);
    onResult(success);
  };

  const onMove = (orig: Key, dest: Key): boolean => {
    if (phase !== "play") return false;
    if (board.isPromotionMove(orig, dest)) {
      setPromotion({ orig, dest });
      return false;
    }
    return submitMove(orig, dest);
  };

  const submitMove = (orig: Key, dest: Key, promotionRole?: PromotionRole): boolean => {
    if (phase !== "play") return false;
    const uci = board.uciFor(orig, dest, promotionRole);
    if (!uci) return false;
    setPhase("busy");
    ipc
      .endgameJudge(lessonId, index, fen, uci)
      .then((v) => {
        if (!v.ok) {
          finish(
            false,
            v.message ||
              "That attempt did not meet the position's goal. Review the idea and try again.",
          );
          return;
        }
        setFen(v.fenAfter);
        setPromotion(null);
        setLastMove(squaresOf(fen, uci));
        const played = moves + 1;
        setMoves(played);
        if (v.done) {
          finish(true, v.message);
          return;
        }
        setMessage(v.message);
        timer.current = window.setTimeout(() => {
          if (v.fenNext && v.replyUci) {
            setLastMove(squaresOf(v.fenAfter, v.replyUci));
            setFen(v.fenNext);
          }
          setPhase("play");
        }, REPLY_DELAY_MS);
      })
      .catch((e: unknown) => {
        setPhase("play");
        board.snapBack();
        setMessage(e instanceof Error ? e.message : String(e));
      });
    return true;
  };

  const reset = () => {
    setFen(position.fen);
    setLastMove(undefined);
    setMoves(0);
    setMessage(position.note);
    setPhase("play");
    setPromotion(null);
  };

  const goal =
    position.goal === "win"
      ? position.success === "mate"
        ? "Mate the king."
        : "Promote with a winning position."
      : `Hold the draw for ${position.holdMoves} moves.`;

  return (
    <div className="flex flex-wrap gap-6">
      <div className="flex flex-col gap-3">
        <div style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
          <Board
            fen={board.fen}
            orientation={position.side}
            turnColor={board.turn}
            dests={phase === "play" ? board.dests : new Map()}
            lastMove={lastMove}
            check={board.check}
            onMove={onMove}
            revision={board.revision}
          />
        </div>
        <p
          className={`min-h-6 max-w-xl text-sm ${
            phase === "done"
              ? "text-emerald-400"
              : phase === "failed"
                ? "text-red-400"
                : "text-neutral-300"
          }`}
          data-testid="drill-status"
          aria-live="polite"
        >
          {message}
        </p>
        {saveError && (
          <div className="flex items-center gap-2 text-sm text-amber-300" role="alert">
            <span>{saveError}</span>
            {onRetrySave && (
              <button type="button" disabled={saving} className="underline" onClick={onRetrySave}>
                Retry save
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2 text-sm">
          {(phase === "failed" || phase === "done") && (
            <button
              type="button"
              onClick={reset}
              disabled={saving || !!saveError}
              className="rounded border border-neutral-700 px-3 py-1 hover:bg-neutral-800"
            >
              Try again
            </button>
          )}
          {phase === "done" && (
            <button
              type="button"
              onClick={onNext}
              disabled={saving || !!saveError}
              className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600"
            >
              Next
            </button>
          )}
        </div>
      </div>
      <aside className="w-80 space-y-2 text-sm text-neutral-400">
        <p>
          <span className="font-semibold text-neutral-200">
            {position.side === "white" ? "White" : "Black"} to move.
          </span>{" "}
          {goal}
        </p>
        <p data-testid="drill-moves">Moves played: {moves}</p>
        <p className="text-xs text-neutral-500">
          The defence comes from the Lichess tablebase (perfect play), so only real technique
          passes. Choose a queen, rook, bishop, or knight when promoting. Lines played before work
          offline.
        </p>
        {promotion && phase === "play" && (
          <div className="flex gap-2" role="group" aria-label="Choose promotion piece">
            {(["queen", "rook", "bishop", "knight"] as PromotionRole[]).map((role) => (
              <button
                key={role}
                type="button"
                className="rounded border border-neutral-700 px-2 py-1 capitalize hover:bg-neutral-800"
                onClick={() => submitMove(promotion.orig, promotion.dest, role)}
              >
                {role}
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
