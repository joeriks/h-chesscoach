import type { ThemeWeakness } from "../../lib/ipc";

/** One line of evidence for a weakness: misses in games, and the puzzle-rating gap. */
export function weaknessLine(t: ThemeWeakness): string {
  const miss = `${t.misses} of ${t.opportunities} missed in ${t.evidenceGames} game${
    t.evidenceGames === 1 ? "" : "s"
  }`;
  if (t.puzzleGap === null || t.puzzleRating === null) return `${miss}.`;
  const gap = Math.round(t.puzzleGap);
  const vs = gap > 0 ? `${gap} below` : `${-gap} above`;
  return `${miss}; your puzzle rating here is ${Math.round(t.puzzleRating)}, ${vs} your overall.`;
}
