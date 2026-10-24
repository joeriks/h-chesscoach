import { makeFen } from "chessops/fen";
import { legalMove, replay } from "../../lib/chess";
import { ipc, type EngineEvent, type PvLine, type Score } from "../../lib/ipc";

export type AlternativeVerdict = "accepted" | "rejected" | "ungraded";
export interface AlternativeJudgment {
  status: AlternativeVerdict;
  message: string;
  candidateUci: string;
  referencePv: string[];
  replyPv: string[];
  cpLoss?: number;
  depth?: number;
}

const TIMEOUT_MS = 12_000;
let nextRequestId = 10_000;
let active: { token: symbol } | null = null;

const ungraded = (candidateUci: string, message: string): AlternativeJudgment => ({
  status: "ungraded",
  message,
  candidateUci,
  referencePv: [],
  replyPv: [],
});

function moverScore(score: Score, whiteToMove: boolean): Score {
  return whiteToMove ? score : { ...score, value: -score.value };
}

function topLine(lines: PvLine[]): PvLine | undefined {
  return lines.find((line) => line.multipv === 1) ?? lines[0];
}

async function analyse(
  id: number,
  fen: string,
  moves: string[],
  signal: AbortSignal | undefined,
  token: symbol,
): Promise<PvLine | null> {
  let unlisten: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const stopIfCurrent = () => {
    if (active?.token === token) void ipc.stopAnalysis().catch(() => {});
  };
  try {
    return await new Promise<PvLine | null>((resolve) => {
      const finish = (line: PvLine | null) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        unlisten?.();
        signal?.removeEventListener("abort", abort);
        resolve(line);
      };
      const abort = () => {
        stopIfCurrent();
        finish(null);
      };
      timer = setTimeout(() => {
        stopIfCurrent();
        finish(null);
      }, TIMEOUT_MS);
      if (signal?.aborted) return abort();
      signal?.addEventListener("abort", abort, { once: true });
      ipc
        .onEngineEvent((event: EngineEvent) => {
          if (settled || active?.token !== token) return;
          if (event.type === "failed") return finish(null);
          if (event.type !== "update" || event.id !== id || !event.done || event.depth < 14) return;
          const line = topLine(event.lines);
          finish(line && line.bound === "exact" && line.depth >= 14 ? line : null);
        })
        .then((off) => {
          unlisten = off;
          if (settled || signal?.aborted || active?.token !== token) {
            off();
            return abort();
          }
          ipc.analyzePosition(id, fen, moves, 1).catch(() => finish(null));
        })
        .catch(() => finish(null));
    });
  } finally {
    if (timer) clearTimeout(timer);
    unlisten?.();
  }
}

/** Conservative engine comparison for an own-game alternative. It never claims a move is wrong
 * when the engine cannot provide two complete, position-matched estimates. */
export async function judgeAlternative(
  fen: string,
  candidateUci: string,
  signal?: AbortSignal,
): Promise<AlternativeJudgment> {
  let position;
  try {
    position = replay(fen, []).pos;
  } catch {
    return ungraded(candidateUci, "The position could not be read, so this move is ungraded.");
  }
  const candidate = legalMove(position, candidateUci);
  if (!candidate) return ungraded(candidateUci, "That move is not legal in this position.");
  const after = position.clone();
  after.play(candidate);
  if (after.isCheckmate()) {
    return {
      status: "accepted",
      message: "Checkmate ends the game immediately.",
      candidateUci,
      referencePv: [],
      replyPv: [],
    };
  }

  // Starting a new comparison makes an older request stale. Its cleanup will not stop ours.
  const token = Symbol("alternative-evaluator");
  active = { token };
  const baselineId = ++nextRequestId;
  try {
    const baseline = await analyse(baselineId, fen, [], signal, token);
    if (!baseline || signal?.aborted || active?.token !== token) {
      return ungraded(
        candidateUci,
        "No complete engine estimate was available for the reference move.",
      );
    }
    const candidateLine = await analyse(++nextRequestId, fen, [candidateUci], signal, token);
    if (!candidateLine || signal?.aborted || active?.token !== token) {
      return ungraded(candidateUci, "No complete engine estimate was available for your move.");
    }
    const whiteToMove = position.turn === "white";
    const reference = moverScore(baseline.score, whiteToMove);
    const reply = moverScore(candidateLine.score, whiteToMove);
    const common = {
      candidateUci,
      referencePv: baseline.pv,
      replyPv: candidateLine.pv,
      depth: Math.min(baseline.depth, candidateLine.depth),
    };
    if (reference.kind === "mate" && reference.value < 0)
      return {
        ...common,
        status: "ungraded",
        message: "The reference is already forced loss, so this alternative is ungraded.",
      };
    if (
      reference.kind === "mate" &&
      reply.kind === "mate" &&
      reference.value > 0 &&
      reply.value > 0
    )
      return { ...common, status: "accepted", message: "Engine estimate: both lines force mate." };
    if (reference.kind === "cp" && reply.kind === "mate" && reply.value > 0)
      return { ...common, status: "accepted", message: "Engine estimate: your line forces mate." };
    if (reply.kind === "mate" && reply.value < 0)
      return {
        ...common,
        status: "rejected",
        message: "Engine estimate: this line is forced loss.",
      };
    if (reference.kind !== "cp" || reply.kind !== "cp")
      return {
        ...common,
        status: "ungraded",
        message: "The engine returned incomparable mate and centipawn estimates.",
      };
    const cpLoss = reference.value - reply.value;
    return cpLoss <= 50
      ? {
          ...common,
          status: "accepted",
          cpLoss,
          message: `Engine estimate: within ${Math.max(0, cpLoss)} cp of the reference.`,
        }
      : {
          ...common,
          status: "rejected",
          cpLoss,
          message: `Engine estimate: about ${cpLoss} cp below the reference.`,
        };
  } finally {
    if (active?.token === token) active = null;
  }
}

export function candidateFen(fen: string, candidateUci: string): string | null {
  try {
    const pos = replay(fen, []).pos;
    const move = legalMove(pos, candidateUci);
    if (!move) return null;
    pos.play(move);
    return makeFen(pos.toSetup());
  } catch {
    return null;
  }
}
