import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameDetail } from "../../lib/ipc";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));

const { ReviewPanel } = await import("./ReviewPanel");

const base: GameDetail = {
  id: 7,
  source: "lichess",
  sourceGameId: "x",
  playedAt: "2026-10-14T18:04:06Z",
  timeControl: "180+0",
  timeClass: "blitz",
  white: "Hugo",
  black: "Rival",
  whiteRating: 1700,
  blackRating: 1720,
  userColor: "w",
  result: "0-1",
  termination: null,
  eco: null,
  openingName: null,
  plyCount: 4,
  wallClockSec: 300,
  pgn: "",
  initialSec: 180,
  plies: [
    {
      ply: 1,
      san: "e4",
      uci: "e2e4",
      clockMs: 178000,
      timeSpentMs: 2000,
      evalCp: 30,
      evalMate: null,
      bestUci: "e2e4",
      bestPv: "e2e4",
      winBefore: 52,
      winAfter: 52,
      classification: "best",
    },
    {
      ply: 2,
      san: "e5",
      uci: "e7e5",
      clockMs: 177000,
      timeSpentMs: 3000,
      evalCp: 30,
      evalMate: null,
      bestUci: "e7e5",
      bestPv: "e7e5",
      winBefore: 48,
      winAfter: 48,
      classification: "best",
    },
    {
      ply: 3,
      san: "Ke2",
      uci: "e1e2",
      clockMs: 170000,
      timeSpentMs: 8000,
      evalCp: -150,
      evalMate: null,
      bestUci: "g1f3",
      bestPv: "g1f3 b8c6",
      winBefore: 52,
      winAfter: 25,
      classification: "blunder",
    },
    {
      ply: 4,
      san: "Qh4",
      uci: "d8h4",
      clockMs: 176000,
      timeSpentMs: 1000,
      evalCp: -160,
      evalMate: null,
      bestUci: "d8h4",
      bestPv: "d8h4",
      winBefore: 75,
      winAfter: 76,
      classification: "best",
    },
  ],
  analysis: { analyzedAt: "2026-10-17T13:00:00Z", preset: "quick", nodes: 300000 },
  findings: [
    {
      id: 1,
      ply: 3,
      kind: "allowed_tactic",
      motifs: ["fork"],
      severity: 27,
      phase: "opening",
      summary: "Ke2 allowed Qh4+ with a fork.",
      bestUci: "g1f3",
      bestSan: "Nf3",
    },
    {
      id: 2,
      ply: 3,
      kind: "opening_deviation",
      motifs: [],
      severity: 27,
      phase: "opening",
      summary: "First slip in the opening: Ke2.",
      bestUci: "g1f3",
      bestSan: "Nf3",
    },
  ],
};

describe("ReviewPanel", () => {
  it("offers analysis and shows the result with key moments", () => {
    const onAnalyze = vi.fn();
    const onGoto = vi.fn();
    render(
      <ReviewPanel
        game={base}
        ply={0}
        onGoto={onGoto}
        progress={null}
        queuedAhead={0}
        onAnalyze={onAnalyze}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Re-analyse (Quick)"));
    expect(onAnalyze).toHaveBeenCalledWith("quick");
    expect(screen.getByTestId("analysis-info")).toHaveTextContent("quick · 2026-10-17 13:00");
    expect(screen.getByTestId("eval-graph")).toBeInTheDocument();
    expect(screen.getByTestId("clock-chart")).toBeInTheDocument();
    const moments = within(screen.getByRole("list", { name: "Key moments" })).getAllByRole(
      "listitem",
    );
    expect(moments).toHaveLength(1); // one per ply, the most severe
    expect(moments[0]).toHaveTextContent("2. Ke2 allowed Qh4+ with a fork.");
    fireEvent.click(within(moments[0]!).getByText(/allowed Qh4\+/));
    expect(onGoto).toHaveBeenCalledWith(3);
    expect(within(moments[0]!).getByText("Train fork")).toBeInTheDocument();
  });

  it("shows progress while running and the buttons before analysis", () => {
    const raw: GameDetail = { ...base, analysis: null, findings: [] };
    const { rerender } = render(
      <ReviewPanel
        game={raw}
        ply={0}
        onGoto={() => {}}
        progress={null}
        queuedAhead={0}
        onAnalyze={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Quick review")).toBeInTheDocument();
    expect(screen.queryByTestId("eval-graph")).not.toBeInTheDocument();
    rerender(
      <ReviewPanel
        game={raw}
        ply={0}
        onGoto={() => {}}
        progress={{ state: "running", gameId: 7, preset: "quick", done: 12, total: 41 }}
        queuedAhead={0}
        onAnalyze={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId("analysis-progress")).toHaveTextContent("12 / 41");
    rerender(
      <ReviewPanel
        game={raw}
        ply={0}
        onGoto={() => {}}
        progress={null}
        queuedAhead={2}
        onAnalyze={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId("analysis-progress")).toHaveTextContent("Queued (2 ahead)");
  });
});
