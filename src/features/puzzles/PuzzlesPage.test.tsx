import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Puzzle, PuzzleImportState, PuzzleImportStatus } from "../../lib/ipc";
import { saveLocalAttempt } from "./localAttempts";

const invoke = vi.fn();
let emitProgress: (state: PuzzleImportState) => void = () => {};
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (_name: string, handler: (e: { payload: PuzzleImportState }) => void) => {
    emitProgress = (payload) => handler({ payload });
    return Promise.resolve(() => {});
  },
}));

const { PuzzlesPage } = await import("./PuzzlesPage");
const { onNavigate, requestPuzzles } = await import("../../lib/navigation");

let autoNextSetting: string | null = null;

/** A number as the UI formats it, with the locale's group separator made a plain space. */
const n = (x: number) => x.toLocaleString().replace(/\s/g, " ");

// 46. Nxe7+ Kf7 47. Nxg6 (PLAN.md 0.2 sample), White to move.
const fork: Puzzle = {
  id: "xsX2JM7h#90",
  fen: "6k1/B3p1b1/KpN3r1/1P5p/8/8/8/8 w - - 0 46",
  moves: ["c6e7", "g8f7", "e7g6"],
  rating: 1282,
  eco: "D99",
  ecoFamily: "D",
  opening: "Grünfeld Defense",
  themes: ["endgame", "equality", "fork", "short"],
  solverColor: "white",
};

const emptyStatus: PuzzleImportStatus = {
  folder: "C:\\Chess Coach\\Lichess puzzles by ECO",
  files: 495,
  totalBytes: 550_000_000,
  importedFiles: 0,
  puzzlesInDb: 0,
  pendingFiles: 495,
  job: { state: "idle" },
  lastReport: null,
};

const importedStatus: PuzzleImportStatus = {
  ...emptyStatus,
  importedFiles: 495,
  puzzlesInDb: 1_500_000,
  pendingFiles: 0,
};

function setup(status: PuzzleImportStatus) {
  invoke.mockReset();
  invoke.mockImplementation((cmd: string, args: Record<string, unknown>) => {
    switch (cmd) {
      case "puzzle_import_status":
        return Promise.resolve(status);
      case "start_puzzle_import":
        return Promise.resolve();
      case "puzzle_themes":
        return Promise.resolve([
          { theme: "short", count: 700_000 },
          { theme: "fork", count: 120_000 },
        ]);
      case "theme_ratings":
        return Promise.resolve([]);
      case "recent_puzzle_attempts":
        return Promise.resolve([]);
      case "count_puzzles":
        return Promise.resolve(4321);
      case "pick_puzzles":
      case "training_set":
        return Promise.resolve([fork]);
      case "get_setting":
        return Promise.resolve(autoNextSetting);
      case "set_setting":
      case "finish_task":
        return Promise.resolve();
      case "record_puzzle_attempt":
        return Promise.resolve({
          attemptId: 1,
          overall: { theme: "overall", rating: args.success ? 1612 : 1430, rd: 290, attempts: 1 },
          themes: [{ theme: "fork", rating: 1612, rd: 290, attempts: 1 }],
        });
      default:
        return Promise.reject(new Error(`unexpected command ${cmd}`));
    }
  });
}

/** Pixel position of a square's centre on the 640px board whose bounds are stubbed below. */
function boardSquare(sq: string): { clientX: number; clientY: number } {
  const size = 640;
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]);
  return { clientX: (file + 0.5) * (size / 8), clientY: (8 - rank + 0.5) * (size / 8) };
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/** Plays a move with two clicks; chessground wants an animation frame between events. */
async function playMove(from: string, to: string) {
  await waitFor(() => expect(document.querySelector("cg-board piece")).not.toBeNull());
  const board = document.querySelector("cg-board") as HTMLElement;
  for (const sq of [from, to]) {
    const at = boardSquare(sq);
    fireEvent.mouseDown(board, { ...at, button: 0 });
    await frame();
    fireEvent.mouseUp(document, { ...at, button: 0 });
    await frame();
  }
}

describe("PuzzlesPage", () => {
  beforeEach(() => {
    localStorage.clear();
    // chessground needs real bounds to turn a click into a square.
    Element.prototype.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 640,
        height: 640,
        right: 640,
        bottom: 640,
        toJSON() {},
      }) as DOMRect;
  });

  it("offers the import when there are no puzzles and shows progress", async () => {
    setup(emptyStatus);
    render(<PuzzlesPage />);
    expect(await screen.findByText("Import puzzles")).toBeInTheDocument();
    expect(screen.getByText(/495 PGN files, 550 MB/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Import puzzles"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("start_puzzle_import", { folder: null }),
    );

    act(() =>
      emitProgress({
        state: "running",
        filesDone: 12,
        filesTotal: 495,
        currentFile: "puzzles_A12.pgn",
        imported: 48_000,
        duplicates: 0,
        rejected: 3,
        totalInDb: 48_000,
        elapsedMs: 9000,
      }),
    );
    expect(await screen.findByTestId("import-progress")).toHaveTextContent(
      `Importing puzzles_A12.pgn: file 13 of 495, ${n(48_000)} puzzles so far, 3 rejected`,
    );
  });

  it("solves a puzzle: scripted reply, mistake, then success recorded as failed", async () => {
    setup(importedStatus);
    render(<PuzzlesPage />);
    expect(await screen.findByTestId("import-summary")).toHaveTextContent(
      `${n(1_500_000)} puzzles from 495 files.`,
    );
    await waitFor(() =>
      expect(screen.getByTestId("matching-count")).toHaveTextContent(`${n(4321)} puzzles match`),
    );
    expect(await screen.findByRole("option", { name: /^Fork \(/ })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Next puzzle"));
    expect(await screen.findByTestId("puzzle-status")).toHaveTextContent(
      "White to move. Find the best move.",
    );
    expect(invoke).toHaveBeenCalledWith("pick_puzzles", {
      filter: {
        theme: null,
        minRating: 1350,
        maxRating: 1650,
        ecoFamily: null,
        excludeSolved: true,
      },
      limit: 10,
    });

    // A wrong move is refused and counted.
    await playMove("a7", "b8");
    expect(await screen.findByTestId("puzzle-status")).toHaveTextContent(
      "That's not it. Try again.",
    );

    // The right move is played, then the scripted reply after the delay.
    await playMove("c6", "e7");
    expect(await screen.findByTestId("puzzle-status")).toHaveTextContent("Good move.");
    await waitFor(() =>
      expect(screen.getByTestId("puzzle-status")).toHaveTextContent(
        "White to move. Find the best move.",
      ),
    );

    await playMove("e7", "g6");
    expect(await screen.findByTestId("puzzle-status")).toHaveTextContent("Solved, with help.");
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "record_puzzle_attempt",
        expect.objectContaining({ puzzleId: "xsX2JM7h#90", success: false, hintsUsed: 0 }),
      ),
    );
    expect(await screen.findByTestId("rating-change")).toHaveTextContent("Your rating: 1430");
    const info = screen.getByTestId("puzzle-info");
    expect(within(info).getByText(/Puzzle rating 1282/)).toBeInTheDocument();
    expect(within(info).getByText("Endgame, Equality, Fork, Short")).toBeInTheDocument();
    expect(screen.getByTestId("overall-rating")).toHaveTextContent(
      "Overall: 1430 ± 290 (1 puzzles)",
    );
  });

  it("a clean solve is recorded as a success and the hint costs it", async () => {
    setup(importedStatus);
    render(<PuzzlesPage />);
    fireEvent.click(await screen.findByText("Next puzzle"));
    await screen.findByTestId("puzzle-status");
    fireEvent.click(screen.getByText("Hint"));
    await playMove("c6", "e7");
    await waitFor(() =>
      expect(screen.getByTestId("puzzle-status")).toHaveTextContent(
        "White to move. Find the best move.",
      ),
    );
    await playMove("e7", "g6");
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "record_puzzle_attempt",
        expect.objectContaining({ success: false, hintsUsed: 1 }),
      ),
    );
  });

  it("auto-next loads the next puzzle after a clean solve, and the toggle is saved", async () => {
    autoNextSetting = "1";
    setup(importedStatus);
    render(<PuzzlesPage />);
    fireEvent.click(await screen.findByText("Next puzzle"));
    await screen.findByTestId("puzzle-status");
    await playMove("c6", "e7");
    await waitFor(() =>
      expect(screen.getByTestId("puzzle-status")).toHaveTextContent(
        "White to move. Find the best move.",
      ),
    );
    await playMove("e7", "g6");
    expect(await screen.findByTestId("puzzle-status")).toHaveTextContent("Solved!");
    // The next puzzle is fetched by itself after the pause.
    await waitFor(
      () => expect(invoke.mock.calls.filter(([c]) => c === "pick_puzzles")).toHaveLength(2),
      { timeout: 3000 },
    );
    const toggle = screen.getByLabelText("Auto-next after a clean solve") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(invoke).toHaveBeenCalledWith("set_setting", { key: "puzzles.autoNext", value: "0" });
    autoNextSetting = null;
  });

  it("a skipped set leaves its plan task open", async () => {
    setup(importedStatus);
    const sections: string[] = [];
    const off = onNavigate((s) => sections.push(s));
    requestPuzzles("fork", { taskId: 7 });
    render(<PuzzlesPage />);
    expect(await screen.findByTestId("training-banner")).toHaveTextContent(
      "Training fork (0 more in this set).",
    );
    expect(invoke).toHaveBeenCalledWith("training_set", {
      theme: "fork",
      ecoFamily: null,
      size: 10,
    });
    fireEvent.click(screen.getByText("Skip for now"));
    await screen.findByText("Skipped. It will return later for review.");
    fireEvent.click(screen.getByText("Next puzzle"));
    await screen.findByText("Skipped and saved for later. This plan task remains open.");
    expect(invoke).not.toHaveBeenCalledWith("finish_task", { id: 7, actualMin: null });
    expect(sections).toEqual(["puzzles"]);
    off();
  });

  it("local retries load without the database and skipping them cannot complete a plan", async () => {
    setup(emptyStatus);
    saveLocalAttempt({ ...fork, id: "game:9#1" }, "failed", 100, 0, 1000);
    requestPuzzles(null, { retry: true, taskId: 9 });
    render(<PuzzlesPage />);
    await screen.findByTestId("puzzle-status");
    fireEvent.click(screen.getByText("Skip for now"));
    await waitFor(() => expect(screen.getByText("Next puzzle")).toBeEnabled());
    fireEvent.click(screen.getByText("Next puzzle"));
    await screen.findByText("Skipped and saved for later. This plan task remains open.");
    expect(invoke.mock.calls.some(([cmd]) => cmd === "finish_task")).toBe(false);
  });

  it("show solution reveals the line and records a failure", async () => {
    setup(importedStatus);
    render(<PuzzlesPage />);
    fireEvent.click(await screen.findByText("Next puzzle"));
    await screen.findByTestId("puzzle-status");
    fireEvent.click(screen.getByText("Show solution"));
    expect(await screen.findByTestId("puzzle-status")).toHaveTextContent(
      "The solution, move by move.",
    );
    fireEvent.click(screen.getByText("Play next move"));
    fireEvent.click(screen.getByText("Play next move"));
    fireEvent.click(screen.getByText("Play next move"));
    expect(screen.getByTestId("puzzle-status")).toHaveTextContent("That was the line.");
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "record_puzzle_attempt",
        expect.objectContaining({ success: false }),
      ),
    );
    expect(invoke.mock.calls.filter(([c]) => c === "record_puzzle_attempt")).toHaveLength(1);
  });
});
