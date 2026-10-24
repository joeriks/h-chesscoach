import type { Puzzle } from "../../lib/ipc";

/** Browser-owned history for positions made from a player's games. Keep this separate from
 * database puzzle attempts: these ids deliberately have no backend row. */
export const LOCAL_ATTEMPTS_KEY = "chess-coach.puzzle-attempts.v1";
const FAILURE_DELAY_MS = 10 * 60_000;
const CLEAN_DELAYS_MS = [24 * 60 * 60_000, 3 * 24 * 60 * 60_000, 7 * 24 * 60 * 60_000];

export type LocalAttemptOutcome = "solved" | "failed" | "skipped" | "compared";
export interface LocalPuzzleAttempt {
  id: string;
  puzzle: Puzzle;
  outcome: LocalAttemptOutcome;
  attemptedAt: number;
  timeMs: number;
  hintsUsed: number;
  dueAt: number | null;
  retryCount: number;
  candidate?: { uci: string; ply: number };
}

function read(): LocalPuzzleAttempt[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_ATTEMPTS_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Local puzzle history is unreadable; it was left unchanged.");
  }
  if (!Array.isArray(parsed) || !parsed.every(isAttempt)) {
    throw new Error("Local puzzle history has an unsupported format; it was left unchanged.");
  }
  return parsed;
}

function isAttempt(value: unknown): value is LocalPuzzleAttempt {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LocalPuzzleAttempt>;
  return (
    typeof item.id === "string" &&
    typeof item.attemptedAt === "number" &&
    typeof item.timeMs === "number" &&
    typeof item.hintsUsed === "number" &&
    (item.outcome === "solved" ||
      item.outcome === "failed" ||
      item.outcome === "skipped" ||
      item.outcome === "compared") &&
    item.puzzle !== undefined &&
    typeof item.puzzle.id === "string" &&
    typeof item.puzzle.fen === "string" &&
    Array.isArray(item.puzzle.moves) &&
    item.puzzle.moves.every((move) => typeof move === "string") &&
    Array.isArray(item.puzzle.themes) &&
    item.puzzle.themes.every((theme) => typeof theme === "string") &&
    (item.dueAt === null || typeof item.dueAt === "number") &&
    typeof item.retryCount === "number"
  );
}

function write(items: LocalPuzzleAttempt[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(items));
}

export function saveLocalAttempt(
  puzzle: Puzzle,
  outcome: LocalAttemptOutcome,
  timeMs: number,
  hintsUsed: number,
  now = Date.now(),
  candidate?: { uci: string; ply: number },
): LocalPuzzleAttempt {
  const history = read();
  let previous: LocalPuzzleAttempt | undefined;
  for (const item of history)
    if (item.puzzle.id === puzzle.id && item.outcome !== "skipped") previous = item;
  const clean = outcome === "solved" && hintsUsed === 0;
  const retryCount = clean
    ? Math.max(
        1,
        (previous?.retryCount ?? 0) +
          (!previous || now - previous.attemptedAt >= 24 * 60 * 60_000 ? 1 : 0),
      )
    : outcome === "skipped"
      ? (previous?.retryCount ?? 0)
      : 0;
  const delay = clean
    ? CLEAN_DELAYS_MS[Math.min(retryCount - 1, CLEAN_DELAYS_MS.length - 1)]
    : FAILURE_DELAY_MS;
  // A compare is not mastery and a skip is not a retained attempt, but both keep the card due.
  const dueAt = now + delay!;
  const attempt: LocalPuzzleAttempt = {
    id: `${puzzle.id}:${now}`,
    puzzle,
    outcome,
    attemptedAt: now,
    timeMs,
    hintsUsed,
    dueAt,
    retryCount,
    ...(candidate ? { candidate } : {}),
  };
  write([...history, attempt]);
  return attempt;
}

/** One current retry per source position, rather than a growing list of old failures. */
export function dueLocalRetries(now = Date.now()): LocalPuzzleAttempt[] {
  const latest = new Map<string, LocalPuzzleAttempt>();
  for (const item of read()) latest.set(item.puzzle.id, item);
  return [...latest.values()].filter((item) => item.dueAt !== null && item.dueAt <= now);
}

/** Once a database puzzle is attempted, its backend scheduler owns subsequent reviews. */
export function resolveLocalReminder(puzzleId: string): void {
  const items = read();
  let latest = -1;
  for (let i = 0; i < items.length; i++) if (items[i]!.puzzle.id === puzzleId) latest = i;
  if (latest < 0 || items[latest]!.dueAt === null) return;
  items[latest] = { ...items[latest]!, dueAt: null };
  write(items);
}

export interface LocalAttemptSummary {
  total: number;
  /** Attempts whose immediately previous attempt at that position was at least a day earlier. */
  delayedAttempts: number;
  /** Delayed attempts completed cleanly, without hints or a comparison-only outcome. */
  delayedCleanSolves: number;
  /** Positions currently waiting to be retried; this is a queue size, not an outcome count. */
  dueRetries: number;
  sameDayPractice: number;
}

/** Stable, presentation-ready aggregate for Stats without exposing storage details. */
export function localAttemptSummary(now = Date.now()): LocalAttemptSummary {
  const items = read();
  const oneDay = 24 * 60 * 60_000;
  const previousByPuzzle = new Map<string, LocalPuzzleAttempt>();
  let delayedAttempts = 0;
  let delayedCleanSolves = 0;
  for (const item of items) {
    if (item.outcome === "skipped") continue;
    const previous = previousByPuzzle.get(item.puzzle.id);
    if (previous && item.attemptedAt - previous.attemptedAt >= oneDay) {
      delayedAttempts += 1;
      if (item.outcome === "solved" && item.hintsUsed === 0) delayedCleanSolves += 1;
    }
    previousByPuzzle.set(item.puzzle.id, item);
  }
  return {
    total: items.length,
    delayedAttempts,
    delayedCleanSolves,
    dueRetries: dueLocalRetries(now).length,
    sameDayPractice: (() => {
      let count = 0;
      const previous = new Map<string, LocalPuzzleAttempt>();
      for (const item of items) {
        if (item.outcome === "skipped") continue;
        const prior = previous.get(item.puzzle.id);
        if (prior && item.attemptedAt - prior.attemptedAt < oneDay) count += 1;
        previous.set(item.puzzle.id, item);
      }
      return count;
    })(),
  };
}
