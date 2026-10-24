import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repertoire, StyleProfile } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));

const { OpeningsPage } = await import("./OpeningsPage");

const profile: StyleProfile = {
  fromGames: { sharpness: 62, initiative: 41, label: "tactical", games: 16 },
  fromQuiz: null,
  source: "games",
  effective: { sharpness: 62, initiative: 41, label: "tactical", games: 16 },
  quiz: [
    {
      id: "q1",
      text: "A pawn sacrifice gives you an attack. You…",
      options: [
        { text: "Sacrifice", sharpness: 85, initiative: 80 },
        { text: "Calculate", sharpness: 60, initiative: 55 },
        { text: "Keep it", sharpness: 20, initiative: 25 },
      ],
    },
  ],
  answers: null,
};

const italian: Repertoire = {
  key: "italian",
  name: "Italian Game (Giuoco Pianissimo)",
  color: "white",
  against: null,
  style: "mixed",
  sharpness: 40,
  initiative: 50,
  theoryLoad: 2,
  minRating: 0,
  ecoPrefixes: ["C50"],
  summary: "Slow build-up.",
  lines: [
    {
      key: "italian/main",
      name: "Main line",
      repertoire: "italian",
      color: "white",
      moves: [
        {
          ply: 1,
          san: "e4",
          uci: "e2e4",
          fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          note: null,
        },
        {
          ply: 2,
          san: "e5",
          uci: "e7e5",
          fenBefore: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          note: null,
        },
        {
          ply: 3,
          san: "Nf3",
          uci: "g1f3",
          fenBefore: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
          note: "Develop with a threat.",
        },
      ],
    },
  ],
};

describe("OpeningsPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    let chosen: string | null = null;
    invoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      switch (cmd) {
        case "style_profile":
          return Promise.resolve(profile);
        case "list_repertoires":
          return Promise.resolve([italian]);
        case "repertoire_choices":
          return Promise.resolve({ white: chosen, blackE4: null, blackD4: null });
        case "repertoire_recommendations":
          return Promise.resolve([
            {
              slot: "white",
              repertoire: "italian",
              name: italian.name,
              fit: 0.71,
              reasons: ["Close fit for your tactical style"],
            },
          ]);
        case "opening_drill_stats":
          return Promise.resolve({ due: 0, learned: 0, totalMoves: chosen ? 2 : 0 });
        case "choose_repertoire":
          chosen = (args?.key as string | null) ?? null;
          return Promise.resolve({ white: chosen, blackE4: null, blackD4: null });
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  it("shows the style, recommends a repertoire and lets the user choose it", async () => {
    render(<OpeningsPage />);
    expect(await screen.findByText("Tactical")).toBeInTheDocument();
    const slot = within(await screen.findByTestId("slot-white"));
    expect(slot.getByText("nothing chosen yet")).toBeInTheDocument();
    expect(slot.getByText(/Recommended: Italian Game/)).toBeInTheDocument();
    fireEvent.click(slot.getByText("Choose"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("choose_repertoire", { slot: "white", key: "italian" }),
    );
    expect(await slot.findByText("Italian Game (Giuoco Pianissimo)")).toBeInTheDocument();
  });

  it("plays a lesson line with its notes", async () => {
    render(<OpeningsPage />);
    await screen.findByText("Tactical");
    fireEvent.click(screen.getByText("Lessons"));
    expect(await screen.findByRole("list", { name: "Line moves" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Nf3"));
    expect(screen.getByTestId("lesson-note")).toHaveTextContent("Develop with a threat.");
  });
});
