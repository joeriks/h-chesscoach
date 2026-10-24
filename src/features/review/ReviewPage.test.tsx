import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameDetail, GameSummary } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: () => Promise.resolve(() => {}),
}));

const { ReviewPage } = await import("./ReviewPage");
const { describeGame, outcomeFor } = await import("../library/gamesText");

const games: GameSummary[] = [
  {
    id: 1,
    source: "lichess",
    sourceGameId: "HqjDTU4A",
    playedAt: "2026-10-14T18:04:06Z",
    timeControl: "180+0",
    timeClass: "blitz",
    white: "Hugo",
    black: "Night-King96",
    whiteRating: 1777,
    blackRating: 1848,
    userColor: "w",
    result: "1-0",
    termination: "resign",
    eco: "A50",
    openingName: "Queen's Indian Accelerated",
    plyCount: 6,
    wallClockSec: 356,
  },
  {
    id: 2,
    source: "manual",
    sourceGameId: "abc",
    playedAt: null,
    timeControl: "-",
    timeClass: "unknown",
    white: "Someone",
    black: "Else",
    whiteRating: null,
    blackRating: null,
    userColor: null,
    result: "0-1",
    termination: null,
    eco: null,
    openingName: null,
    plyCount: 2,
    wallClockSec: null,
  },
];

const detail: GameDetail = {
  ...games[0]!,
  pgn: '[White "Hugo"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0\n',
  plies: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"].map((uci, i) => ({
    ply: i + 1,
    san: "x",
    uci,
    clockMs: null,
    timeSpentMs: null,
    evalCp: null,
    evalMate: null,
    bestUci: null,
    bestPv: null,
    winBefore: null,
    winAfter: null,
    classification: null,
  })),
  initialSec: 180,
  analysis: null,
  findings: [],
};

describe("ReviewPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string, args: Record<string, unknown>) => {
      switch (cmd) {
        case "list_games":
          return Promise.resolve({ total: games.length, games });
        case "get_game":
          return Promise.resolve(args.id === 1 ? detail : null);
        case "set_game_user_color":
        case "delete_game":
          return Promise.resolve(true);
        case "import_pgn_text":
          return Promise.resolve({
            games: 2,
            inserted: 1,
            duplicates: 1,
            unassigned: 1,
            rejected: [],
          });
        case "analysis_status":
          return Promise.resolve({ current: null, queued: [] });
        case "analyze_position":
          return Promise.resolve({ id: args.id, whiteToMove: true, status: "ongoing" });
        default:
          return Promise.resolve(null);
      }
    });
  });

  it("lists games with the user's outcome and filters", async () => {
    render(<ReviewPage />);
    const list = await screen.findByRole("list", { name: "Games" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("W");
    expect(items[0]).toHaveTextContent("2026-10-14 · Hugo (1777) vs Night-King96 (1848)");
    expect(items[0]).toHaveTextContent("Queen's Indian Accelerated");
    expect(items[1]).toHaveTextContent("I was White");
    expect(screen.getByTestId("games-total")).toHaveTextContent("2 games");

    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "loss" } });
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "list_games",
        expect.objectContaining({ filter: expect.objectContaining({ outcome: "loss" }) }),
      ),
    );

    fireEvent.click(within(items[1]!).getByText("I was Black"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_game_user_color", {
        id: 2,
        color: "b",
        rememberAlias: true,
      }),
    );
  });

  it("opens a game on the analysis board from the user's side and goes back", async () => {
    render(<ReviewPage />);
    const list = await screen.findByRole("list", { name: "Games" });
    fireEvent.click(within(list).getByText(/Hugo \(1777\) vs Night-King96/));
    expect(await screen.findByTestId("game-header")).toHaveTextContent(
      "Hugo (1777) vs Night-King96 (1848) · 1-0",
    );
    // The game's moves are on the move list, and the board asks the engine about the start.
    expect(screen.queryByRole("list", { name: "Moves" })).toBeNull();
    expect(invoke.mock.calls.some(([cmd]) => cmd === "analyze_position")).toBe(false);
    fireEvent.click(screen.getByText("Explore with engine without recording a reflection"));
    const moves = await screen.findByRole("list", { name: "Moves" });
    expect(within(moves).getAllByRole("button")).toHaveLength(6);
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "analyze_position",
        expect.objectContaining({ moves: [] }),
      ),
    );
    fireEvent.click(screen.getByText("← Games"));
    expect(await screen.findByRole("list", { name: "Games" })).toBeInTheDocument();
  });

  it("imports pasted PGN and reports the summary", async () => {
    render(<ReviewPage />);
    await screen.findByRole("list", { name: "Games" });
    fireEvent.change(screen.getByLabelText("PGN text"), {
      target: { value: '[White "a"]\n\n1. e4 *' },
    });
    fireEvent.click(screen.getByText("Import text"));
    expect(await screen.findByTestId("import-message")).toHaveTextContent(
      "1 game imported, 1 already in the library, 1 without your side yet.",
    );
    expect(invoke).toHaveBeenCalledWith("import_pgn_text", { text: '[White "a"]\n\n1. e4 *' });
  });

  it("helpers describe outcomes from the user's side", () => {
    expect(outcomeFor(games[0]!)).toEqual({ label: "W", tone: "win" });
    expect(outcomeFor({ ...games[0]!, userColor: "b" })).toEqual({ label: "L", tone: "loss" });
    expect(outcomeFor({ ...games[0]!, result: "1/2-1/2" })).toEqual({ label: "D", tone: "draw" });
    expect(outcomeFor(games[1]!)).toEqual({ label: "0-1", tone: "none" });
    expect(describeGame(games[1]!)).toBe("unknown date · Someone vs Else");
  });
});
