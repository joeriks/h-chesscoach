import type { ThemeWeakness } from "../../lib/ipc";
import type { LocalPuzzleAttempt } from "../puzzles/localAttempts";
import { rankStrategy, type StrategyAttempt } from "../strategy/progress";
export interface PriorityItem {
  id: string;
  title: string;
  why: string;
  minutes: number;
  score: number;
  target:
    | { kind: "strategy"; id: string }
    | { kind: "puzzle"; theme: string | null; retry?: boolean }
    | { kind: "review"; gameId: number; ply: number };
}
/** Transparent heuristic, not a prediction of rating gain. Keep evidence sources separate. */
export function trainingPriorities(
  history: StrategyAttempt[],
  retries: LocalPuzzleAttempt[],
  weaknesses: ThemeWeakness[],
  budget: number,
  now = Date.now(),
): PriorityItem[] {
  const options: PriorityItem[] = [];
  const due = retries.filter((a) => a.dueAt !== null && a.dueAt <= now);
  if (due.length)
    options.push({
      id: "recall",
      title: "Review due positions",
      why: `${due.length} saved positions are due. Test recall before introducing more material.`,
      minutes: 5,
      score: 100,
      target: { kind: "puzzle", theme: null, retry: true },
    });
  for (const t of weaknesses) {
    if (
      !Number.isFinite(t.opportunities) ||
      !Number.isFinite(t.misses) ||
      t.opportunities <= 0 ||
      t.misses <= 0 ||
      t.misses > t.opportunities
    )
      continue;
    const reliable = t.opportunities >= 20 && t.evidenceGames >= 5;
    // Shrink small samples toward a neutral prior; never promote a 1/1 miss above a repeated pattern.
    const rate = (t.misses + 2) / (t.opportunities + 8);
    if (reliable)
      options.push({
        id: `theme:${t.theme}`,
        title: `Practise ${t.theme}`,
        why: `${t.misses}/${t.opportunities} opportunities missed across ${t.evidenceGames} games. A repeated pattern, not proof of its cause.`,
        minutes: 5,
        score: 65 + 25 * rate,
        target: { kind: "puzzle", theme: t.theme },
      });
    else if (t.evidence[0])
      options.push({
        id: `review:${t.theme}`,
        title: `Investigate ${t.theme}`,
        why: `Only ${t.opportunities} opportunities in ${t.evidenceGames} games. Review an example before treating this as a weakness.`,
        minutes: 5,
        score: 35 + 10 * rate,
        target: { kind: "review", gameId: t.evidence[0].gameId, ply: t.evidence[0].ply },
      });
  }
  const strategy = rankStrategy(history, now)[0];
  if (strategy)
    options.push({
      id: "strategy",
      title: history.length
        ? `Practise ${strategy.exercise.theme.replaceAll("-", " ")}`
        : "Establish a middlegame baseline",
      why: strategy.why,
      minutes: 5,
      score: strategy.priority,
      target: { kind: "strategy", id: strategy.exercise.id },
    });
  const result: PriorityItem[] = [];
  let remaining = Math.max(0, Number.isFinite(budget) ? budget : 0);
  for (const item of options.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    if (item.minutes > remaining || result.length >= 3) continue;
    result.push(item);
    remaining -= item.minutes;
  }
  return result;
}
