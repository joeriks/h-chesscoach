import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TransferCheck } from "./TransferCheck";
import { ipc, type GameDetail } from "../../lib/ipc";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it("saves an immutable baseline and excludes old games from a later comparison", async () => {
  const games = Array.from(
    { length: 10 },
    (_, i) =>
      ({
        id: i + 1,
        source: "lichess",
        timeClass: "rapid",
        userColor: "w",
        pgn: "",
        playedAt: "2020-01-01T12:00:00Z",
        analysis: { preset: "quick", nodes: 1, analyzedAt: "2020-01-01" },
        plies: [
          { ply: 1, classification: "good" },
          { ply: 2, classification: "blunder" },
          { ply: 3, classification: "mistake" },
        ],
      }) as GameDetail,
  );
  vi.spyOn(ipc, "listGames").mockResolvedValue({ games, total: games.length });
  vi.spyOn(ipc, "getGame").mockImplementation(async (id) => games.find((g) => g.id === id)!);
  render(<TransferCheck />);
  fireEvent.click(screen.getByText("Save baseline"));
  await screen.findByText(/Baseline saved: 10 games, 20 classified moves, 50.0/);
  const saved = localStorage.getItem("chesscoach.play-baseline.v1:lichess:rapid");
  fireEvent.click(screen.getByText("Save baseline"));
  await screen.findByText(/baseline already exists/);
  expect(localStorage.getItem("chesscoach.play-baseline.v1:lichess:rapid")).toBe(saved);
  fireEvent.click(screen.getByText("Check new games"));
  await screen.findByText(/New games: – errors per 100 moves in 0 games/);
  expect(screen.getByText(/Too few new games/)).toBeInTheDocument();
});
it("does not save a baseline after incomplete data loading", async () => {
  vi.spyOn(ipc, "listGames").mockRejectedValue(new Error("database unavailable"));
  render(<TransferCheck />);
  fireEvent.click(screen.getByText("Save baseline"));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("database unavailable"));
  expect(localStorage.getItem("chesscoach.play-baseline.v1:lichess:rapid")).toBeNull();
});
