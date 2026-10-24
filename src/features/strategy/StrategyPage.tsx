import { useState } from "react";
import { Board } from "../../components/board/Board";
import { parseFenSafe } from "../../lib/chess";
import { navigate, takeStrategyRequest } from "../../lib/navigation";
import { exerciseFen, PLAN_EXERCISES } from "./positions";
import {
  rankStrategy,
  readStrategyHistory,
  saveStrategyAttempt,
  strategyEvidence,
  type StrategyAttempt,
} from "./progress";

export function StrategyPage() {
  const [initial] = useState(() => {
    try {
      return { history: readStrategyHistory(), error: "", requested: takeStrategyRequest() };
    } catch {
      return {
        history: [] as StrategyAttempt[],
        error:
          "Saved training history is unreadable and has been preserved. Saving is blocked until it can be read.",
        requested: takeStrategyRequest(),
      };
    }
  });
  const [history, setHistory] = useState(initial.history);
  const [error, setError] = useState(initial.error);
  const [choice, setChoice] = useState(() => {
    const ranked = rankStrategy(initial.history);
    return ranked.find((c) => c.exercise.id === initial.requested) ?? ranked[0]!;
  });
  const [visited, setVisited] = useState<string[]>([]);
  const [plan, setPlan] = useState<number | null>(null);
  const [counter, setCounter] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [confidence, setConfidence] = useState<StrategyAttempt["confidence"]>("unsure");
  const [attempt, setAttempt] = useState<StrategyAttempt | null>(null);
  const [saved, setSaved] = useState(false);
  const [finished, setFinished] = useState(false);
  const exercise = choice.exercise;
  const fen = exerciseFen(exercise);
  const parsed = parseFenSafe(fen);
  const turn = parsed.ok ? parsed.pos.turn : "white";
  const evidence = strategyEvidence(history);
  const persist = (record: StrategyAttempt) => {
    try {
      saveStrategyAttempt(record);
      setHistory(readStrategyHistory());
      setSaved(true);
      setError("");
    } catch {
      setError(
        "Could not save this answer. Your choices are kept here; retry saving before continuing.",
      );
    }
  };
  const submit = () => {
    if (attempt || plan === null || counter === null || !reason.trim()) return;
    const record: StrategyAttempt = {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      at: Date.now(),
      planCorrect: exercise.options[plan]!.preferred,
      counterCorrect: exercise.counterplay.options[counter]!.preferred,
      confidence,
      reason: reason.trim(),
    };
    setAttempt(record);
    persist(record);
  };
  const next = () => {
    const done = [...visited, exercise.id];
    setVisited(done);
    if (done.length >= 3) {
      setFinished(true);
      return;
    }
    const nextChoice = rankStrategy(history, Date.now(), done)[0];
    if (!nextChoice) {
      setFinished(true);
      return;
    }
    setChoice(nextChoice);
    setPlan(null);
    setCounter(null);
    setReason("");
    setAttempt(null);
    setSaved(false);
    setConfidence("unsure");
  };
  if (finished)
    return (
      <section className="max-w-2xl space-y-4">
        <h1 className="text-lg font-semibold">Session complete</h1>
        <p>
          You worked through {visited.length} different positions. Return later for delayed recall;
          use the idea in your next game.
        </p>
        <p>
          First attempts on transfer positions: {evidence.transferPassed}/{evidence.transferTotal}{" "}
          matched both objectives. This is not a rating or proof of stronger match play.
        </p>
        <button onClick={() => navigate("today")} className="rounded bg-emerald-700 p-2">
          Review training priorities
        </button>
        <button onClick={() => navigate("review")} className="ml-2 rounded border p-2">
          Apply it to your own game
        </button>
      </section>
    );
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-lg font-semibold">Middlegame plans</h1>
      <p className="text-sm text-neutral-400">
        A three-position session adapts to your saved first answers. Choose both a plan and the
        opponent's resource before seeing feedback. These are strategic objectives, not unique
        engine-best moves.
      </p>
      <p className="rounded border border-neutral-700 p-3 text-sm">
        <strong>Why this position:</strong> {choice.why}
      </p>
      <div className="flex flex-wrap gap-6">
        <div className="w-full max-w-lg">
          <Board fen={fen} orientation={turn} turnColor={turn} dests={new Map()} />
        </div>
        <section className="min-w-0 flex-1 space-y-4" style={{ minWidth: "min(100%, 280px)" }}>
          <p className="text-xs text-neutral-400">
            Position {visited.length + 1} of 3 · {turn} to move ·{" "}
            {exercise.kind === "transfer" ? "Transfer check" : "Guided practice"} · Level{" "}
            {exercise.level}
          </p>
          <h2 className="font-semibold">{exercise.question}</h2>
          <label className="block space-y-1 text-sm">
            <span>What feature supports your plan, and what could the opponent do?</span>
            <textarea
              aria-label="Your reasoning"
              rows={3}
              maxLength={2000}
              value={reason}
              disabled={!!attempt}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 p-2"
            />
          </label>
          <fieldset disabled={!!attempt} className="space-y-2">
            <legend className="text-sm">Your plan</legend>
            {exercise.options.map((o, i) => (
              <label key={o.text} className="block rounded border border-neutral-700 p-2 text-sm">
                <input type="radio" name="plan" checked={plan === i} onChange={() => setPlan(i)} />{" "}
                {o.text}
              </label>
            ))}
          </fieldset>
          <fieldset disabled={!!attempt} className="space-y-2">
            <legend className="text-sm">{exercise.counterplay.question}</legend>
            {exercise.counterplay.options.map((o, i) => (
              <label key={o.text} className="block rounded border border-neutral-700 p-2 text-sm">
                <input
                  type="radio"
                  name="counter"
                  checked={counter === i}
                  onChange={() => setCounter(i)}
                />{" "}
                {o.text}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            Confidence{" "}
            <select
              aria-label="Confidence"
              value={confidence}
              disabled={!!attempt}
              onChange={(e) => setConfidence(e.target.value as StrategyAttempt["confidence"])}
              className="rounded bg-neutral-800 p-1"
            >
              <option value="unsure">Unsure</option>
              <option value="fairly">Fairly confident</option>
              <option value="certain">Certain</option>
            </select>
          </label>
          {!attempt && (
            <button
              onClick={submit}
              disabled={!reason.trim() || plan === null || counter === null}
              className="rounded bg-emerald-700 px-3 py-2 disabled:opacity-40"
            >
              Commit both answers
            </button>
          )}
          {attempt && (
            <div role="status" className="space-y-2 rounded border border-emerald-900 p-3">
              <p className="font-semibold">
                {attempt.planCorrect && attempt.counterCorrect
                  ? "Both objectives matched."
                  : "Reconsider the plan or counterplay."}
              </p>
              <p>{exercise.options[plan!]!.reason}</p>
              {!attempt.planCorrect && <p>{exercise.options.find((o) => o.preferred)!.reason}</p>}
              <p>
                <strong>Opponent's resources:</strong>{" "}
                {exercise.counterplay.options[counter!]!.reason}
              </p>
              {!attempt.counterCorrect && (
                <p>{exercise.counterplay.options.find((o) => o.preferred)!.reason}</p>
              )}
              <p>{exercise.opponent}</p>
              <p>
                <strong>Take into your next game:</strong> {exercise.principle}
              </p>
              {confidence === "certain" && (!attempt.planCorrect || !attempt.counterCorrect) && (
                <p>
                  A confident error is a useful warning: identify the resource you overlooked before
                  moving on.
                </p>
              )}
              <p className="text-xs text-neutral-400">
                Your written reasoning is retained, but has not been automatically assessed.
              </p>
              <button
                onClick={next}
                disabled={!saved}
                className="rounded bg-emerald-700 px-3 py-1 disabled:opacity-40"
              >
                {visited.length === 2 ? "Finish session" : "Next position"}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-red-300">
              {error}
            </p>
          )}
          {attempt && !saved && (
            <button onClick={() => persist(attempt)} className="rounded border border-red-500 p-2">
              Retry saving
            </button>
          )}
        </section>
      </div>
      <p className="text-sm text-neutral-400">
        Saved: {evidence.distinct} distinct positions out of {PLAN_EXERCISES.length}. First transfer
        checks: {evidence.transferPassed}/{evidence.transferTotal} matched both objectives.
        Same-position repeats do not increase this count.
      </p>
    </div>
  );
}
