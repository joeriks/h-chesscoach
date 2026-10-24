// A tiny cross-screen request channel: "open Puzzles with this theme", "open this game".
// Screens stay decoupled; App listens and switches the section, the target screen takes
// the pending request when it mounts.

import type { Puzzle } from "./ipc";

export interface PuzzleRequest {
  theme: string | null;
  /** Prefer puzzles from this opening family (A–E). */
  ecoFamily?: string | null;
  /** The position from the user's own game to start with ("the one you missed"). */
  first?: Puzzle | null;
  /** Open the due retries instead of a theme. */
  retry?: boolean;
  /** The plan task this run belongs to; finished when the set runs out. */
  taskId?: number;
}

export interface GameRequest {
  gameId: number;
  ply: number;
}

export interface OpeningsRequest {
  /** Open the drill tab straight away. */
  drill?: boolean;
  /** A line to show in the lesson viewer. */
  lineKey?: string;
  taskId?: number;
}

export interface EndgameRequest {
  lessonId: string | null;
  taskId?: number;
}

const EVENT = "chesscoach:navigate";
let pendingStrategyRequest: string | null = null;
export function requestStrategy(exerciseId: string): void {
  pendingStrategyRequest = exerciseId;
  navigate("strategy");
}
export function takeStrategyRequest(): string | null {
  const id = pendingStrategyRequest;
  pendingStrategyRequest = null;
  return id;
}
let pendingPuzzleRequest: PuzzleRequest | null = null;
let pendingGameRequest: GameRequest | null = null;
let pendingOpeningsRequest: OpeningsRequest | null = null;
let pendingEndgameRequest: EndgameRequest | null = null;

export function requestOpenings(req: OpeningsRequest): void {
  pendingOpeningsRequest = req;
  navigate("openings");
}

export function requestEndgame(req: EndgameRequest): void {
  pendingEndgameRequest = req;
  navigate("endgame");
}

export function takeOpeningsRequest(): OpeningsRequest | null {
  const r = pendingOpeningsRequest;
  pendingOpeningsRequest = null;
  return r;
}

export function takeEndgameRequest(): EndgameRequest | null {
  const r = pendingEndgameRequest;
  pendingEndgameRequest = null;
  return r;
}

/** Switch to a section with no pending request (e.g. the games list). */
export function navigate(section: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { section } }));
}

export function requestPuzzles(
  theme: string | null,
  extra: Omit<PuzzleRequest, "theme"> = {},
): void {
  pendingPuzzleRequest = { theme, ...extra };
  navigate("puzzles");
}

export function requestGame(gameId: number, ply: number): void {
  pendingGameRequest = { gameId, ply };
  navigate("review");
}

/** The puzzle request made before the Puzzles screen mounted, consumed once. */
export function takePuzzleRequest(): PuzzleRequest | null {
  const r = pendingPuzzleRequest;
  pendingPuzzleRequest = null;
  return r;
}

export function takeGameRequest(): GameRequest | null {
  const r = pendingGameRequest;
  pendingGameRequest = null;
  return r;
}

export function onNavigate(handler: (section: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<{ section: string }>).detail.section);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
