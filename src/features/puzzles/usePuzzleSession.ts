import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "chessground/types";
import { makeSquare } from "chessops/util";
import { legalMove } from "../../lib/chess";
import { ipc, type AttemptResult, type Puzzle } from "../../lib/ipc";
import { isSolved, judgeMove, positionAt, replyPly } from "./puzzleLogic";
import { resolveLocalReminder, saveLocalAttempt, type LocalAttemptOutcome } from "./localAttempts";

/** Delay before the scripted opponent reply, so the user sees their move land. */
export const REPLY_DELAY_MS = 400;

export type SessionPhase =
  | "solving"
  | "replying" // the opponent's scripted move is about to be played
  | "solved"
  | "failed" // the solution was revealed
  | "skipped"
  | "compared";

export interface SessionState {
  ply: number;
  phase: SessionPhase;
  /** Wrong moves so far; any mistake means the attempt is not a clean solve. */
  mistakes: number;
  hintsUsed: number;
  lastVerdict: "correct" | "mate-alternative" | "wrong" | null;
}

const initial: SessionState = {
  ply: 0,
  phase: "solving",
  mistakes: 0,
  hintsUsed: 0,
  lastVerdict: null,
};

/**
 * Drives one puzzle: the user plays the solver's moves, the opponent's replies are played
 * from the script after a short delay, and the attempt is recorded once when it ends.
 * Mount it with `key={puzzle.id}` so each puzzle gets a fresh session.
 */
export function usePuzzleSession(puzzle: Puzzle, onRecorded?: (r: AttemptResult) => void) {
  const [state, setState] = useState<SessionState>(initial);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ uci: string; ply: number } | undefined>();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const startedAt = useRef(0);
  const recorded = useRef(false);
  const backendResult = useRef<AttemptResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const pos = useMemo(() => positionAt(puzzle, state.ply), [puzzle, state.ply]);

  const lastMove = useMemo<[Key, Key] | undefined>(() => {
    if (state.ply === 0) return undefined;
    const uci = puzzle.moves[state.ply - 1]!;
    const m = legalMove(positionAt(puzzle, state.ply - 1), uci);
    return m ? [makeSquare(m.from), uci.slice(2, 4) as Key] : undefined;
  }, [puzzle, state.ply]);

  const record = useCallback(
    (success: boolean, hintsUsed: number, outcome: LocalAttemptOutcome) => {
      if (recorded.current) return;
      recorded.current = true;
      setSaveState("saving");
      if (puzzle.id.startsWith("game:")) {
        queueMicrotask(() => {
          try {
            saveLocalAttempt(
              puzzle,
              outcome,
              Date.now() - startedAt.current,
              hintsUsed,
              Date.now(),
              candidate,
            );
            setSaveState("saved");
          } catch (e) {
            recorded.current = false;
            setSaveState("error");
            setRecordError(`Could not save this local attempt: ${String(e)}`);
          }
        });
        return;
      }
      if (outcome === "skipped") {
        try {
          saveLocalAttempt(puzzle, outcome, Date.now() - startedAt.current, hintsUsed);
          setSaveState("saved");
        } catch (e) {
          recorded.current = false;
          setSaveState("error");
          setRecordError(`Could not save this skip: ${String(e)}`);
        }
        return;
      }
      (backendResult.current
        ? Promise.resolve(backendResult.current)
        : ipc.recordPuzzleAttempt(puzzle.id, success, Date.now() - startedAt.current, hintsUsed)
      )
        .then((r) => {
          backendResult.current = r;
          resolveLocalReminder(puzzle.id);
          setResult(r);
          setSaveState("saved");
          onRecorded?.(r);
        })
        .catch((e: unknown) => {
          recorded.current = false;
          setSaveState("error");
          setRecordError(`Could not save this attempt: ${String(e)}`);
        });
    },
    [puzzle, onRecorded, candidate],
  );

  // Recording happens when the puzzle ends, whatever the route there.
  useEffect(() => {
    const save = (success: boolean, outcome: LocalAttemptOutcome) =>
      queueMicrotask(() => record(success, state.hintsUsed, outcome));
    if (state.phase === "solved") {
      save(state.mistakes === 0 && state.hintsUsed === 0, "solved");
    } else if (state.phase === "failed") {
      save(false, "failed");
    } else if (state.phase === "skipped") {
      save(false, "skipped");
    } else if (state.phase === "compared") {
      save(false, "compared");
    }
  }, [state.phase, state.mistakes, state.hintsUsed, record]);

  /** The user moved on the board. Returns the verdict so the page can show it. */
  const playUserMove = useCallback(
    (uci: string) => {
      if (state.phase !== "solving") return "wrong" as const;
      // A game PV is a suggested engine line, not proof that every alternative is bad.
      if (puzzle.id.startsWith("game:") && uci !== puzzle.moves[state.ply]) {
        if (!legalMove(positionAt(puzzle, state.ply), uci)) return "wrong" as const;
        setCandidate({ uci, ply: state.ply });
        // Do not advance through the engine PV after an alternative: its next move may not be
        // legal in the user's branch. The UI explicitly calls this an ungraded comparison.
        setState((s) => ({ ...s, phase: "compared", lastVerdict: "correct" }));
        return "compared" as const;
      }
      const verdict = judgeMove(puzzle, state.ply, uci);
      if (verdict === "wrong") {
        setState((s) => ({ ...s, mistakes: s.mistakes + 1, lastVerdict: "wrong" }));
        return verdict;
      }
      const reply = replyPly(puzzle, state.ply);
      if (reply === null) {
        setState((s) => ({ ...s, ply: s.ply + 1, phase: "solved", lastVerdict: verdict }));
        return verdict;
      }
      setState((s) => ({ ...s, ply: s.ply + 1, phase: "replying", lastVerdict: verdict }));
      timer.current = setTimeout(() => {
        setState((s) => ({ ...s, ply: reply + 1, phase: "solving", lastVerdict: null }));
      }, REPLY_DELAY_MS);
      return verdict;
    },
    [puzzle, state.phase, state.ply],
  );

  /** Shows the piece to move (counts as a hint; the attempt is no longer a clean solve). */
  const hint = useCallback(() => {
    if (state.phase !== "solving") return null;
    setState((s) => ({ ...s, hintsUsed: s.hintsUsed + 1 }));
    return puzzle.moves[state.ply] ?? null;
  }, [puzzle, state.phase, state.ply]);

  /** Reveals the line and marks the attempt failed. */
  const giveUp = useCallback(() => {
    if (state.phase === "solved" || state.phase === "failed") return;
    if (timer.current) clearTimeout(timer.current);
    setState((s) => ({ ...s, phase: "failed", lastVerdict: null }));
  }, [state.phase]);

  const skip = useCallback(() => {
    if (state.phase === "solved" || state.phase === "failed" || state.phase === "skipped") return;
    if (timer.current) clearTimeout(timer.current);
    setState((s) => ({ ...s, phase: "skipped", lastVerdict: null }));
  }, [state.phase]);

  const retrySave = useCallback(() => {
    if (saveState !== "error") return;
    setRecordError(null);
    const outcome: LocalAttemptOutcome =
      state.phase === "solved"
        ? "solved"
        : state.phase === "failed"
          ? "failed"
          : state.phase === "compared"
            ? "compared"
            : "skipped";
    record(
      outcome === "solved" && state.mistakes === 0 && state.hintsUsed === 0,
      state.hintsUsed,
      outcome,
    );
  }, [record, saveState, state]);

  /** Steps through the revealed solution one ply at a time. */
  const stepSolution = useCallback(() => {
    setState((s) =>
      s.phase === "failed" ? { ...s, ply: Math.min(s.ply + 1, puzzle.moves.length) } : s,
    );
  }, [puzzle]);

  const expectedMove = !isSolved(puzzle, state.ply) ? puzzle.moves[state.ply] : undefined;

  return {
    state,
    pos,
    lastMove,
    result,
    recordError,
    candidate,
    saveState,
    retrySave,
    playUserMove,
    hint,
    giveUp,
    skip,
    stepSolution,
    expectedMove,
  };
}
