import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";
import { makeFen } from "chessops/fen";
import { Board } from "../../components/board/Board";
import { replay } from "../../lib/chess";
import { ipc, type DrillCard, type DrillStats } from "../../lib/ipc";
import { navigate } from "../../lib/navigation";
import { BOARD_SIZE } from "../puzzles/PuzzleSolver";
import { squaresOf, useDrillBoard } from "./useDrillBoard";

export const REPLY_DELAY_MS = 500;
export const NEXT_DELAY_MS = 700;
const NEW_PER_SESSION = 6;

type Phase = "idle" | "ask" | "correct" | "wrong" | "done";

function fenAfter(fen: string, uci: string): string {
  return makeFen(replay(fen, [uci]).pos.toSetup());
}

/** Spaced-repetition drill of the chosen repertoire: play the move, see the reply. */
export function DrillRunner({
  stats,
  hasRepertoire,
  taskId,
  onFinished,
}: {
  stats: DrillStats | null;
  hasRepertoire: boolean;
  taskId?: number;
  onFinished: () => void;
}) {
  const [cards, setCards] = useState<DrillCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fen, setFen] = useState<string>("");
  const [lastMove, setLastMove] = useState<[Key, Key] | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<{ refId: string; correct: boolean } | null>(
    null,
  );
  const [tally, setTally] = useState({ correct: 0, wrong: 0 });
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const card = cards?.[index];
  const board = useDrillBoard(fen || card?.fen || "8/8/8/8/8/8/8/8 w - - 0 1");

  const start = useCallback(() => {
    setMessage(null);
    ipc
      .openingDrillSession(NEW_PER_SESSION)
      .then((list) => {
        setCards(list);
        setIndex(0);
        setTally({ correct: 0, wrong: 0 });
        if (list.length === 0) {
          setPhase("done");
          setMessage(
            "Nothing is due and every move of your repertoire is known. Come back tomorrow.",
          );
          return;
        }
        setFen(list[0]!.fen);
        setLastMove(undefined);
        setPhase("ask");
      })
      .catch((e: unknown) => setMessage(String(e)));
  }, []);

  // A task from Today starts at once.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (taskId !== undefined && hasRepertoire && !autoStarted.current) {
      autoStarted.current = true;
      start();
    }
  }, [taskId, hasRepertoire, start]);

  const advance = useCallback(
    (list: DrillCard[], next: number) => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      if (next >= list.length) {
        setPhase("done");
        setMessage(null);
        onFinished();
        if (taskId !== undefined) {
          ipc
            .finishTask(taskId)
            .then(() => navigate("today"))
            .catch((e: unknown) =>
              setMessage(
                `Session results saved, but the plan task could not be completed: ${String(e)}`,
              ),
            );
        }
        return;
      }
      setIndex(next);
      setFen(list[next]!.fen);
      setLastMove(undefined);
      setMessage(null);
      setPhase("ask");
    },
    [onFinished, taskId],
  );

  const saveAnswer = (answer: { refId: string; correct: boolean }) => {
    setPendingAnswer(answer);
    setSaving(true);
    setSaveError(null);
    ipc
      .answerOpeningDrill(answer.refId, answer.correct)
      .then(() => setPendingAnswer(null))
      .catch((e: unknown) => setSaveError(`The repetition result was not saved: ${String(e)}`))
      .finally(() => setSaving(false));
  };

  const onMove = (orig: Key, dest: Key): boolean => {
    if (!card || !cards || phase !== "ask") return false;
    const uci = board.uciFor(orig, dest);
    if (!uci) return false;
    if (uci === card.expectedUci) {
      setTally((t) => ({ ...t, correct: t.correct + 1 }));
      saveAnswer({ refId: card.refId, correct: true });
      const after = fenAfter(card.fen, uci);
      setFen(after);
      setLastMove(squaresOf(card.fen, uci));
      setPhase("correct");
      setMessage(card.note ?? `${card.expectedSan}: that is the line.`);
      if (card.replyUci) {
        later(() => {
          setFen(fenAfter(after, card.replyUci!));
          setLastMove(squaresOf(after, card.replyUci!));
        }, REPLY_DELAY_MS);
      }
      return true;
    }
    setTally((t) => ({ ...t, wrong: t.wrong + 1 }));
    saveAnswer({ refId: card.refId, correct: false });
    setPhase("wrong");
    setMessage(
      `${card.expectedSan} is your repertoire move here.${card.note ? ` ${card.note}` : ""} Your move may also be playable; this exercise checks recall of your chosen line, not the quality of every alternative.`,
    );
    return false;
  };

  const shapes: DrawShape[] =
    phase === "wrong" && card
      ? [
          {
            orig: card.expectedUci.slice(0, 2) as Key,
            dest: card.expectedUci.slice(2, 4) as Key,
            brush: "red",
          },
        ]
      : [];

  if (!hasRepertoire) {
    return (
      <p className="max-w-2xl text-sm text-neutral-400">
        Choose a repertoire on the Style &amp; repertoire tab first; the drill serves its moves.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-6">
      <div className="flex flex-col gap-3">
        {card && phase !== "done" && (
          <p className="text-sm text-emerald-300" data-testid="drill-banner">
            {card.lineName} · move {Math.ceil(card.ply / 2)} · {index + 1} of {cards?.length}
            {card.isNew ? " · new" : " · review"}
          </p>
        )}
        <div style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
          <Board
            fen={board.fen}
            orientation={card?.side ?? "white"}
            turnColor={board.turn}
            dests={phase === "ask" ? board.dests : new Map()}
            lastMove={lastMove}
            check={board.check}
            shapes={shapes}
            onMove={onMove}
            revision={board.revision}
          />
        </div>
        <p className="min-h-6 max-w-xl text-sm" data-testid="drill-status" aria-live="polite">
          {phase === "idle" && "Start a session: due moves first, then a few new ones."}
          {phase === "ask" &&
            `${card?.side === "white" ? "White" : "Black"} to move: play your repertoire move.`}
          {(phase === "correct" || phase === "wrong" || phase === "done") && message}
          {phase === "done" &&
            !message &&
            `Session done: ${tally.correct} right, ${tally.wrong} to review.`}
        </p>
        <div className="flex gap-2 text-sm">
          {(phase === "idle" || phase === "done") && (
            <button
              type="button"
              onClick={start}
              className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600"
            >
              {phase === "done" ? "Another session" : "Start drilling"}
            </button>
          )}
          {(phase === "wrong" || phase === "correct") && cards && (
            <button
              type="button"
              disabled={saving || pendingAnswer !== null}
              onClick={() => advance(cards, index + 1)}
              className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600"
            >
              {phase === "correct" ? "Understood, next" : "Got it, next"}
            </button>
          )}
        </div>
        {saving && (
          <p role="status" className="text-sm">
            Saving repetition…
          </p>
        )}
        {saveError && (
          <div role="alert" className="text-sm text-red-400">
            {saveError}
            <button
              type="button"
              disabled={saving}
              onClick={() => pendingAnswer && saveAnswer(pendingAnswer)}
              className="ml-2 underline"
            >
              Retry save
            </button>
          </div>
        )}
      </div>
      <aside className="w-80 text-sm text-neutral-400">
        {stats && (
          <p data-testid="drill-stats">
            {stats.due} due · {stats.learned} of {stats.totalMoves} repertoire moves learned
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          This is a repertoire-memory drill. A different legal move is not automatically bad chess.
          Explain the move's purpose and the opponent's reply before continuing. Recall results
          determine the next repetition; they do not establish opening mastery.
        </p>
      </aside>
    </div>
  );
}
