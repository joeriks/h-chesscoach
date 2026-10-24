import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerStats } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));

const { StatsPage } = await import("./StatsPage");

const stats: PlayerStats = {
  ratings: [
    {
      source: "chesscom",
      timeClass: "blitz",
      rating: 1412,
      asOf: "2026-10-17T10:00:00Z",
      games: 189,
      threeMonthsAgo: 1380,
    },
    {
      source: "lichess",
      timeClass: "rapid",
      rating: 1389,
      asOf: "2026-08-21T10:00:00Z",
      games: 9,
      threeMonthsAgo: null,
    },
  ],
  referenceRating: 1412,
  areas: [
    {
      area: "opening",
      score: 61,
      measure: 74,
      expected: 70,
      sample: 120,
      label: "average",
      note: "74% accuracy over 120 moves; 70% is typical at your rating.",
    },
    {
      area: "middlegame",
      score: 78,
      measure: 81,
      expected: 70,
      sample: 300,
      label: "strength",
      note: "81% accuracy over 300 moves; 70% is typical at your rating.",
    },
    {
      area: "endgame",
      score: 32,
      measure: 63,
      expected: 70,
      sample: 90,
      label: "weakness",
      note: "63% accuracy over 90 moves; 70% is typical at your rating.",
    },
    {
      area: "tactics",
      score: null,
      measure: null,
      expected: null,
      sample: 3,
      label: "average",
      note: "Needs 8 tactical chances in reviewed games or 10 rated puzzles.",
    },
  ],
  history: Array.from({ length: 12 }, (_, i) => {
    const n = 11 + i; // 2025-11 … 2026-10
    const ratings: Record<string, number> = i > 6 ? { chesscom: 1380 + i * 4 } : {};
    const areas: Record<string, number> = i > 8 ? { opening: 55 + i, middlegame: 70 } : {};
    return {
      month:
        n <= 12 ? `2025-${String(n).padStart(2, "0")}` : `2026-${String(n - 12).padStart(2, "0")}`,
      games: i,
      analysed: i > 8 ? 2 : 0,
      ratings,
      areas,
    };
  }),
  analysedGames: 16,
  totalGames: 214,
};

describe("StatsPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) =>
      cmd === "player_stats"
        ? Promise.resolve(stats)
        : Promise.reject(new Error(`unexpected ${cmd}`)),
    );
  });

  it("shows ratings, labelled areas and the progress charts", async () => {
    render(<StatsPage />);
    expect(await screen.findByTestId("stats-coverage")).toHaveTextContent(
      "16 of 214 games reviewed · model reference rating: 1412",
    );
    const ratings = within(screen.getByRole("list", { name: "Ratings" }));
    expect(ratings.getByText("1412")).toBeInTheDocument();
    expect(ratings.getByText("+32 in 3 months · 189 games")).toBeInTheDocument();
    expect(screen.getByTestId("area-middlegame")).toHaveTextContent("strength");
    expect(screen.getByTestId("area-middlegame")).toHaveTextContent("78");
    expect(screen.getByTestId("area-endgame")).toHaveTextContent("weakness");
    expect(screen.getByTestId("area-endgame")).toHaveTextContent("lower estimated score");
    expect(screen.getByTestId("area-tactics")).toHaveTextContent("Needs 8 tactical chances");
    expect(screen.getByRole("img", { name: "Area scores" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Chess.com rating" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Lichess rating" })).toBeNull();
    expect(
      within(screen.getByRole("table", { name: "Monthly stats" })).getAllByRole("row"),
    ).toHaveLength(13);
  });
});
