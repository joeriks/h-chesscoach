import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExplorerResult } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));

const { ExplorerTab } = await import("./ExplorerTab");
const { onNavigate } = await import("../../lib/navigation");

const start: ExplorerResult = {
  total: 1200,
  newestMonth: "2020-05",
  moves: [
    {
      uci: "e2e4",
      san: "e4",
      games: 800,
      whiteWins: 300,
      draws: 200,
      blackWins: 300,
      score: 50,
      avgElo: 2450,
      lastMonth: "2020-05",
      share: 66.7,
      recentShare: 60,
      olderShare: 70,
    },
    {
      uci: "d2d4",
      san: "d4",
      games: 400,
      whiteWins: 200,
      draws: 100,
      blackWins: 100,
      score: 62.5,
      avgElo: 2470,
      lastMonth: "2020-04",
      share: 33.3,
      recentShare: 40,
      olderShare: 30,
    },
  ],
  topGames: [
    {
      id: 7,
      white: "Alpha",
      black: "Beta",
      whiteElo: 2600,
      blackElo: 2550,
      result: "1-0",
      playedOn: "2020-05-01",
      opening: "Scotch Game",
      plyCount: 60,
    },
  ],
};
const afterE4: ExplorerResult = {
  ...start,
  total: 800,
  moves: [
    {
      uci: "e7e5",
      san: "e5",
      games: 800,
      whiteWins: 300,
      draws: 200,
      blackWins: 300,
      score: 50,
      avgElo: 2450,
      lastMonth: "2020-05",
      share: 100,
      recentShare: null,
      olderShare: null,
    },
  ],
};

describe("ExplorerTab", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      switch (cmd) {
        case "explorer_query":
          return Promise.resolve((args?.fen as string).includes(" w ") ? start : afterE4);
        case "explorer_plans":
          return Promise.resolve([
            {
              side: "White",
              feature: "break:d4",
              sentence:
                "White plays the pawn break d4 within 6 moves in 64% of games and scores 54% when so (47% otherwise).",
              gamesWith: 768,
              gamesTotal: 1200,
              avgPly: 11,
              scoreWith: 0.54,
              scoreWithout: 0.47,
            },
          ]);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  it("shows the move table, plays a move from it and lists plans and top games", async () => {
    render(<ExplorerTab available />);
    expect(await screen.findByTestId("explorer-total")).toHaveTextContent(
      `${(1200).toLocaleString().replace(/\s/g, " ")} master games here · data to 2020-05`,
    );
    const table = within(screen.getByRole("table", { name: "Master moves" }));
    expect(table.getAllByRole("row")).toHaveLength(3);
    expect(table.getByText("e4")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Common plans" })).getAllByRole("listitem"),
    ).toHaveLength(1);
    expect(
      within(screen.getByRole("list", { name: "Top games" })).getByText(/Alpha \(2600\)/),
    ).toBeInTheDocument();
    fireEvent.click(table.getByText("e4"));
    await waitFor(() =>
      expect(screen.getByTestId("explorer-total")).toHaveTextContent("800 master games here"),
    );
    expect(invoke).toHaveBeenLastCalledWith(
      "explorer_plans",
      expect.objectContaining({ fen: expect.stringContaining(" b ") }),
    );
    expect(screen.getByRole("navigation", { name: "Line" })).toHaveTextContent("1. e4");
  });

  it("offers the install prompt without the database", () => {
    const sections: string[] = [];
    const off = onNavigate((s) => sections.push(s));
    render(<ExplorerTab available={false} />);
    fireEvent.click(screen.getByText("Add master games"));
    expect(sections).toEqual(["settings"]);
    off();
  });
});
