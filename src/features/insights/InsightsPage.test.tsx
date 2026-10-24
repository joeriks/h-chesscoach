import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WeaknessProfile } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));

const { InsightsPage } = await import("./InsightsPage");
const { weaknessLine } = await import("./insightsText");
const { takePuzzleRequest, takeGameRequest } = await import("../../lib/navigation");

const profile: WeaknessProfile = {
  windowDays: 60,
  analysedGames: 12,
  unanalysedGames: 30,
  themes: [
    {
      theme: "fork",
      opportunities: 9,
      misses: 6,
      missRate: 0.66,
      puzzleRating: 1350,
      puzzleGap: 150,
      score: 1.4,
      evidenceGames: 5,
      evidence: [
        {
          gameId: 42,
          ply: 31,
          summary: "Missed a knight fork of the king and rook: Nxe7+ wins.",
          white: "Hugo",
          black: "Rival",
          playedAt: "2026-10-10T18:00:00Z",
          result: "0-1",
          userColor: "w",
        },
      ],
    },
    {
      theme: "pin",
      opportunities: 5,
      misses: 2,
      missRate: 0.4,
      puzzleRating: null,
      puzzleGap: null,
      score: 0.2,
      evidenceGames: 3,
      evidence: [],
    },
    {
      theme: "skewer",
      opportunities: 4,
      misses: 1,
      missRate: 0.25,
      puzzleRating: 1600,
      puzzleGap: -100,
      score: -0.8,
      evidenceGames: 2,
      evidence: [],
    },
    {
      theme: "mateIn2",
      opportunities: 3,
      misses: 0,
      missRate: 0,
      puzzleRating: null,
      puzzleGap: null,
      score: -1.2,
      evidenceGames: 3,
      evidence: [],
    },
  ],
};

describe("InsightsPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "weakness_profile":
          return Promise.resolve(profile);
        case "analysis_status":
          return Promise.resolve({ current: null, queued: [] });
        case "analyze_unreviewed":
          return Promise.resolve(20);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  it("shows the top three weaknesses with evidence and ways to act", async () => {
    render(<InsightsPage />);
    expect(await screen.findByTestId("coverage")).toHaveTextContent(
      "12 games reviewed, 30 waiting",
    );
    const list = screen.getByRole("list", { name: "Weaknesses" });
    const items = [...list.querySelectorAll(":scope > li")] as HTMLElement[];
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("1. Fork");
    expect(items[0]).toHaveTextContent("66% missed");
    expect(items[0]).toHaveTextContent(
      "6 of 9 missed in 5 games; your puzzle rating here is 1350, 150 below your overall.",
    );
    expect(screen.getByTestId("weakness-radar")).toBeInTheDocument();

    fireEvent.click(within(items[0]!).getByText("Train fork"));
    expect(takePuzzleRequest()).toEqual({ theme: "fork" });

    fireEvent.click(within(items[0]!).getByText(/Missed a knight fork/));
    expect(takeGameRequest()).toEqual({ gameId: 42, ply: 31 });

    fireEvent.click(screen.getByText("Review 20 newest games"));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("analyze_unreviewed", { limit: 20 }));
  });

  it("explains an empty profile", async () => {
    invoke.mockImplementation((cmd: string) =>
      cmd === "weakness_profile"
        ? Promise.resolve({ ...profile, themes: [], analysedGames: 0, unanalysedGames: 0 })
        : Promise.resolve({ current: null, queued: [] }),
    );
    render(<InsightsPage />);
    expect(await screen.findByText(/No tactical pattern stands out yet/)).toBeInTheDocument();
    expect(weaknessLine(profile.themes[1]!)).toBe("2 of 5 missed in 3 games.");
  });
});
