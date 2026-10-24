import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";
import { makeFen } from "chessops/fen";
import type { Role } from "chessops/types";
import { Board } from "../../components/board/Board";
import {
  dests as legalDests,
  isPromotion,
  moveFromSquares,
  standardUci,
  pvToSan,
} from "../../lib/chess";
import type { AttemptResult, Puzzle } from "../../lib/ipc";
import { coachingExplanation, coachingHint, themeLabel } from "./puzzleLogic";
import { usePuzzleSession } from "./usePuzzleSession";
import { AlternativeFeedback } from "./AlternativeFeedback";

const PROMOTION_ROLES: Role[] = ["queen", "rook", "bishop", "knight"];
export const BOARD_SIZE = "min(calc(100vh - 12rem), 640px)";
/** Pause after a clean solve before the next puzzle loads on its own. */
export const AUTO_NEXT_DELAY_MS = 900;

interface PuzzleSolverProps {
  puzzle: Puzzle;
  onRecorded: (r: AttemptResult) => void;
  onNext: (outcome: "solved" | "failed" | "skipped" | "compared") => void;
  /** Load the next puzzle by itself after a solve without mistakes. */
  autoNext?: boolean;
}

/** One puzzle on the board. Mount with `key={puzzle.id}` so state resets per puzzle. */
export function PuzzleSolver({ puzzle, onRecorded, onNext, autoNext = false }: PuzzleSolverProps) {
  const session = usePuzzleSession(puzzle, onRecorded);
  const [promotion, setPromotion] = useState<{ orig: Key; dest: Key } | null>(null);
  const [hintSquare, setHintSquare] = useState<string | null>(null);

  const pos = session.pos;
  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);
  const { phase, mistakes, hintsUsed, lastVerdict } = session.state;

  // Auto-advance: a clean solve moves on after a short pause (the user still sees "Solved!").
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);
  useEffect(() => {
    if (!autoNext || phase !== "solved" || mistakes > 0 || session.saveState !== "saved") return;
    const id = window.setTimeout(() => onNextRef.current("solved"), AUTO_NEXT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [autoNext, phase, mistakes, session.saveState]);
  const canMove = phase === "solving" && !promotion;
  const dests = useMemo(
    () => (canMove ? (legalDests(pos) as Map<Key, Key[]>) : new Map<Key, Key[]>()),
    [pos, canMove],
  );

  const [boardRevision, setBoardRevision] = useState(0);

  const onMove = useCallback(
    (orig: Key, dest: Key) => {
      if (isPromotion(pos, orig, dest)) {
        setPromotion({ orig, dest });
        return true;
      }
      setHintSquare(null);
      // A wrong move stays on the board only if we let it: refuse it so the board snaps back.
      const verdict = session.playUserMove(standardUci(pos, moveFromSquares(orig, dest)));
      return verdict !== "wrong" && verdict !== "compared";
    },
    [pos, session],
  );

  const choosePromotion = (role: Role | null) => {
    const verdict =
      promotion && role
        ? session.playUserMove(
            standardUci(pos, moveFromSquares(promotion.orig, promotion.dest, role)),
          )
        : "wrong";
    if (verdict === "wrong" || verdict === "compared") setBoardRevision((n) => n + 1);
    else setHintSquare(null);
    setPromotion(null);
  };

  const showHint = () => {
    const move = session.hint();
    if (move && hintsUsed >= 2) setHintSquare(move.slice(0, 2));
  };
  const hintText = hintsUsed > 0 ? coachingHint(puzzle.themes, hintsUsed) : null;

  const shapes = useMemo<DrawShape[]>(() => {
    if (hintSquare && phase === "solving") return [{ orig: hintSquare as Key, brush: "yellow" }];
    const expected = session.expectedMove;
    if (phase === "failed" && expected) {
      return [
        { orig: expected.slice(0, 2) as Key, dest: expected.slice(2, 4) as Key, brush: "red" },
      ];
    }
    return [];
  }, [hintSquare, phase, session.expectedMove]);

  const side = puzzle.solverColor === "white" ? "White" : "Black";
  const ownGame = puzzle.id.startsWith("game:");
  const statusText =
    phase === "solved"
      ? mistakes === 0 && hintsUsed === 0
        ? ownGame
          ? "Line recalled. This does not prove it was the only good move."
          : "Solved!"
        : "Solved, with help."
      : phase === "compared"
        ? "Move recorded for comparison. This position is not automatically graded."
        : phase === "skipped"
          ? "Skipped. It will return later for review."
          : phase === "failed"
            ? session.expectedMove
              ? "The solution, move by move."
              : "That was the line."
            : lastVerdict === "wrong"
              ? "That's not it. Try again."
              : lastVerdict === "mate-alternative"
                ? "Also mate. Accepted!"
                : lastVerdict === "correct" && phase === "replying"
                  ? "Good move."
                  : `${side} to move. Find the best move.`;
  const finished =
    phase === "solved" || phase === "failed" || phase === "skipped" || phase === "compared";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative" style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
        <Board
          fen={fen}
          orientation={puzzle.solverColor}
          turnColor={pos.turn}
          dests={dests}
          lastMove={session.lastMove}
          check={pos.isCheck()}
          shapes={shapes}
          onMove={onMove}
          revision={boardRevision}
        />
        {promotion && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <div
              className="flex gap-2 rounded bg-neutral-800 p-3"
              role="dialog"
              aria-label="Promote to"
            >
              {PROMOTION_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => choosePromotion(role)}
                  className="rounded bg-neutral-700 px-3 py-2 text-sm capitalize hover:bg-neutral-600"
                >
                  {role}
                </button>
              ))}
              <button
                type="button"
                onClick={() => choosePromotion(null)}
                className="px-2 text-sm text-neutral-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <p
        className={`min-h-6 text-sm ${
          phase === "solved"
            ? "text-emerald-400"
            : lastVerdict === "wrong"
              ? "text-red-400"
              : "text-neutral-300"
        }`}
        data-testid="puzzle-status"
        aria-live="polite"
      >
        {statusText}
      </p>
      {hintText && phase === "solving" && <p className="text-xs text-amber-200">{hintText}</p>}
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={finished ? () => onNext(phase) : session.skip}
          disabled={finished && session.saveState !== "saved"}
          className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600"
        >
          {finished ? "Next puzzle" : "Skip for now"}
        </button>
        {phase === "solving" && (
          <>
            <button
              type="button"
              onClick={showHint}
              className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800"
              title="Highlight the piece to move"
            >
              Hint
            </button>
            <button
              type="button"
              onClick={session.giveUp}
              className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800"
            >
              {ownGame ? "Show suggested line" : "Show solution"}
            </button>
          </>
        )}
        {phase === "failed" && session.expectedMove && (
          <button
            type="button"
            onClick={session.stepSolution}
            className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800"
          >
            Play next move
          </button>
        )}
      </div>
      {finished && (
        <section className="space-y-1 text-sm" data-testid="puzzle-info">
          <p>
            {ownGame ? "From your own game" : `Puzzle rating ${puzzle.rating}`} · {puzzle.eco}{" "}
            {puzzle.opening}
          </p>
          <p className="text-neutral-400">{puzzle.themes.map(themeLabel).join(", ")}</p>
          <p className="text-neutral-400">{coachingExplanation(puzzle.themes)}</p>
          {session.result && (
            <p className="text-neutral-400" data-testid="rating-change">
              Your rating: {Math.round(session.result.overall.rating)}
            </p>
          )}
          {session.recordError && (
            <p className="text-red-400" role="alert">
              {session.recordError}
            </p>
          )}
          {session.saveState === "saving" && <p className="text-neutral-400">Saving attempt…</p>}
          {session.saveState === "error" && (
            <button
              type="button"
              onClick={session.retrySave}
              className="rounded border border-red-600 px-2 py-1 text-red-300"
            >
              Retry saving
            </button>
          )}
          {ownGame && (
            <p className="text-neutral-400">
              Suggested line from your game; alternatives are kept ungraded unless analysed.
            </p>
          )}
          {phase === "compared" && session.candidate && (
            <div className="space-y-1 rounded border border-neutral-700 p-2">
              <p>Your candidate: {pvToSan(pos, [session.candidate.uci]).join(" ")}</p>
              <p>
                Stored engine continuation:{" "}
                {pvToSan(pos, puzzle.moves.slice(session.candidate.ply), puzzle.moves.length).join(
                  " ",
                )}
              </p>
              <p>
                This shows a reference line, not a refutation of your move. Compare the opponent's
                best reply on the analysis board.
              </p>
              <AlternativeFeedback
                key={`${fen}:${session.candidate.uci}`}
                fen={fen}
                uci={session.candidate.uci}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
