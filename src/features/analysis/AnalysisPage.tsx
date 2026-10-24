import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";
import type { Role } from "chessops/types";
import { Board, type Color } from "../../components/board/Board";
import { EvalBar } from "../../components/board/EvalBar";
import {
  INITIAL_FEN,
  dests as legalDests,
  formatScore,
  isPromotion,
  moveFromSquares,
  standardUci,
} from "../../lib/chess";
import { makeFen } from "chessops/fen";
import { EngineLines } from "./EngineLines";
import { MoveList, type MoveMark } from "./MoveList";
import { useAnalysis } from "./useAnalysis";
import { CoachReflection } from "../review/CoachReflection";

const PROMOTION_ROLES: Role[] = ["queen", "rook", "bishop", "knight"];
/** The largest square that fits under the window chrome, capped for very tall screens. */
const BOARD_SIZE = "min(calc(100vh - 9rem), 720px)";

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(target.tagName);
}

interface AnalysisPageProps {
  /** A game to load (standard UCI from the start position). Re-mount with a key per game. */
  initialMoves?: string[];
  initialFen?: string;
  initialOrientation?: Color;
  /** Which ply to show first (0 = the start position). */
  initialPly?: number;
  coachGameId?: number;
  /** Shown above the board, e.g. the game's players and a way back to the library. */
  header?: ReactNode;
  /** Annotations for the move list (by ply), from the game analysis. */
  marks?: Map<number, MoveMark>;
  /** Extra content at the top of the side panel, given the current ply and a way to move. */
  renderSide?: (ctx: { ply: number; goto: (ply: number) => void }) => ReactNode;
}

export function AnalysisPage({
  initialMoves,
  initialFen = INITIAL_FEN,
  initialOrientation = "white",
  initialPly = 0,
  coachGameId,
  header,
  marks,
  renderSide,
}: AnalysisPageProps = {}) {
  const a = useAnalysis(initialFen, initialMoves, initialPly, coachGameId === undefined);
  const [revealedFen, setRevealedFen] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Color>(initialOrientation);
  const [fenInput, setFenInput] = useState("");
  const [fenError, setFenError] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ orig: Key; dest: Key } | null>(null);

  const fen = useMemo(() => makeFen(a.pos.toSetup()), [a.pos]);
  const feedbackVisible = coachGameId === undefined || revealedFen === fen;
  const dests = useMemo(() => legalDests(a.pos) as Map<Key, Key[]>, [a.pos]);
  const turn = a.pos.turn;

  const status = a.pos.isCheckmate() ? "checkmate" : a.pos.isStalemate() ? "stalemate" : null;
  const best = a.engineOn && feedbackVisible ? a.update?.lines[0] : undefined;
  const winWhite =
    status === "checkmate"
      ? turn === "white"
        ? 0
        : 100
      : status === "stalemate"
        ? 50
        : a.engineOn && feedbackVisible
          ? (a.lastUpdate?.lines[0]?.winWhite ?? null)
          : null;
  const label =
    status === "checkmate"
      ? "#"
      : status === "stalemate"
        ? "½"
        : best
          ? formatScore(best.score)
          : "";

  const shapes = useMemo<DrawShape[]>(() => {
    const first = best?.pv[0];
    if (!first) return [];
    return [{ orig: first.slice(0, 2) as Key, dest: first.slice(2, 4) as Key, brush: "paleBlue" }];
  }, [best]);

  const onMove = useCallback(
    (orig: Key, dest: Key) => {
      if (isPromotion(a.pos, orig, dest)) {
        setPromotion({ orig, dest });
        return;
      }
      a.play(standardUci(a.pos, moveFromSquares(orig, dest)));
    },
    [a],
  );

  const [boardRevision, setBoardRevision] = useState(0);
  const choosePromotion = (role: Role | null) => {
    if (promotion && role) {
      a.play(standardUci(a.pos, moveFromSquares(promotion.orig, promotion.dest, role)));
    } else {
      // Cancelled: the pawn is still drawn on the last rank until the board is re-applied.
      setBoardRevision((n) => n + 1);
    }
    setPromotion(null);
  };

  const { goto, ply, moves, setEngineOn } = a;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === "ArrowLeft") goto(ply - 1);
      else if (e.key === "ArrowRight") goto(ply + 1);
      else if (e.key === "Home") goto(0);
      else if (e.key === "End") goto(moves.length);
      else if (e.key === "f" || e.key === "F")
        setOrientation((o) => (o === "white" ? "black" : "white"));
      else if (e.key === " " && feedbackVisible) setEngineOn((on) => !on);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goto, ply, moves.length, setEngineOn, feedbackVisible]);

  useEffect(() => {
    if (!feedbackVisible) setEngineOn(false);
  }, [feedbackVisible, setEngineOn]);

  const loadFen = () => {
    const error = a.setFen(fenInput || INITIAL_FEN);
    setFenError(error);
    if (!error) setFenInput("");
  };

  return (
    <div className="space-y-3">
      {header}
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2" style={{ height: BOARD_SIZE }}>
            <EvalBar winWhite={winWhite} label={label} orientation={orientation} />
            <div className="relative" style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
              <Board
                fen={fen}
                orientation={orientation}
                turnColor={turn}
                dests={promotion ? new Map() : dests}
                lastMove={a.lastMove}
                check={a.pos.isCheck()}
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
                      className="px-2 text-sm text-neutral-400 hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ToolButton onClick={() => goto(0)} label="Start" title="First move (Home)" />
            <ToolButton onClick={() => goto(ply - 1)} label="◀" title="Back (←)" />
            <ToolButton onClick={() => goto(ply + 1)} label="▶" title="Forward (→)" />
            <ToolButton onClick={() => goto(moves.length)} label="End" title="Last move (End)" />
            <ToolButton
              onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
              label="Flip"
              title="Flip board (F)"
            />
            <ToolButton
              onClick={() => a.setFen(INITIAL_FEN)}
              label="New"
              title="Starting position"
            />
          </div>
        </div>

        <aside className="flex w-80 min-w-0 flex-col gap-4">
          {coachGameId !== undefined && (
            <CoachReflection
              key={`${coachGameId}:${fen}`}
              gameId={coachGameId}
              fen={fen}
              revealed={feedbackVisible}
              onReveal={() => {
                setRevealedFen(fen);
                setEngineOn(true);
              }}
            />
          )}
          {feedbackVisible && renderSide?.({ ply, goto })}
          {feedbackVisible && (
            <>
              <EngineLines
                pos={a.pos}
                engineOn={a.engineOn}
                onToggle={() => setEngineOn((on) => !on)}
                engineName={a.engineName}
                notice={a.requestError ?? a.engineNotice}
                update={a.engineOn ? a.update : null}
                status={status}
                onPlay={(uci) => a.play(uci)}
              />
              <MoveList rootFen={a.rootFen} sans={a.sans} ply={ply} onSelect={goto} marks={marks} />
            </>
          )}
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Position
            </h2>
            <p className="break-all font-mono text-xs text-neutral-400" data-testid="current-fen">
              {fen}
            </p>
            <div className="flex gap-2">
              <input
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadFen()}
                placeholder="Paste a FEN to set up a position"
                aria-label="FEN"
                className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs"
              />
              <ToolButton onClick={loadFen} label="Load" title="Set up this position" />
            </div>
            {fenError && (
              <p className="text-xs text-red-400" role="alert">
                {fenError}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ToolButton({
  onClick,
  label,
  title,
}: {
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800"
    >
      {label}
    </button>
  );
}
