import type { Classification, GameFinding, GamePly } from "../../lib/ipc";

/** The marker shown next to a move in the list: "?!", "?", "??" (and nothing otherwise). */
export function classificationMark(
  c: Classification | null,
): { text: string; tone: string } | null {
  switch (c) {
    case "inaccuracy":
      return { text: "?!", tone: "text-amber-400" };
    case "mistake":
      return { text: "?", tone: "text-orange-400" };
    case "blunder":
      return { text: "??", tone: "text-red-400" };
    default:
      return null;
  }
}

/** White's win-% after `ply` moves, from the stored mover-relative numbers. */
export function whiteWinAfter(plies: GamePly[], ply: number): number | null {
  const p = plies[ply - 1];
  if (!p || p.winAfter === null) return null;
  const moverWhite = (ply - 1) % 2 === 0;
  return moverWhite ? p.winAfter : 100 - p.winAfter;
}

export function findingTitle(f: GameFinding): string {
  switch (f.kind) {
    case "missed_tactic":
      return "Missed tactic";
    case "allowed_tactic":
      return "Allowed tactic";
    case "time_trouble":
      return "Time trouble";
    case "opening_deviation":
      return "Opening slip";
    case "conversion_fail":
      return "Not converted";
  }
}

export function moveLabel(ply: number): string {
  const n = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${n}.` : `${n}…`;
}

/** The three to five most important findings, in game order. */
export function keyMoments(
  findings: GameFinding[],
  max = 5,
  /** A ply whose finding is always listed (the moment the user came here to see). */
  includePly: number | null = null,
): GameFinding[] {
  const byPly = new Map<number, GameFinding>();
  const sorted = [...findings].sort((a, b) => b.severity - a.severity);
  const pinned = includePly === null ? undefined : sorted.find((f) => f.ply === includePly);
  if (pinned) byPly.set(pinned.ply, pinned);
  for (const f of sorted) {
    if (byPly.size === max) break;
    if (!byPly.has(f.ply)) byPly.set(f.ply, f);
  }
  return [...byPly.values()].sort((a, b) => a.ply - b.ply);
}

/** Themes in the order the tagger is most reliable about them (same order as the Rust side). */
const THEME_PREFERENCE = [
  "mateIn1",
  "mateIn2",
  "hangingPiece",
  "backRankMate",
  "skewer",
  "discoveredAttack",
  "fork",
  "pin",
  "deflection",
  "trappedPiece",
];

/** The motif the user should train on for this finding, if it has one. */
export function trainableTheme(f: GameFinding): string | null {
  return THEME_PREFERENCE.find((t) => f.motifs.includes(t)) ?? f.motifs[0] ?? null;
}
