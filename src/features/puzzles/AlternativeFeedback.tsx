import { useEffect, useRef, useState } from "react";
import { pvToSan, replay } from "../../lib/chess";
import { candidateFen, judgeAlternative, type AlternativeJudgment } from "./alternativeJudge";

export function AlternativeFeedback({ fen, uci }: { fen: string; uci: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AlternativeJudgment | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const check = async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      const judgment = await judgeAlternative(fen, uci, request.signal);
      if (!request.signal.aborted) setResult(judgment);
    } catch {
      if (!request.signal.aborted)
        setResult({
          status: "ungraded",
          message: "Engine unavailable. Your move remains ungraded.",
          candidateUci: uci,
          referencePv: [],
          replyPv: [],
        });
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  const after = candidateFen(fen, uci);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void check()}
        className="rounded border border-neutral-600 px-2 py-1 disabled:opacity-50"
      >
        {busy ? "Checking both positions…" : "Check candidate with engine"}
      </button>
      {result && (
        <div aria-live="polite">
          <p>
            {result.status === "accepted"
              ? "Playable alternative. "
              : result.status === "rejected"
                ? "Reconsider this candidate. "
                : "Ungraded. "}
            {result.message}
          </p>
          {result.depth && (
            <p>Search depth: {result.depth}. This is an estimate, not proof of mastery.</p>
          )}
          {after && result.replyPv.length > 0 && (
            <p>Opponent continuation: {pvToSan(replay(after, []).pos, result.replyPv).join(" ")}</p>
          )}
          <p>
            The comparison remains scheduled for review; checking one move does not complete the
            full exercise.
          </p>
        </div>
      )}
    </div>
  );
}
