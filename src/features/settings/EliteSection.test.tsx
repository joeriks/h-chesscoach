import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EliteOverview } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));

const { EliteSection } = await import("./EliteSection");
const { jobLine } = await import("./eliteText");

/** A number as the UI formats it, with the locale's group separator made a plain space. */
const n = (x: number) => x.toLocaleString().replace(/\s/g, " ");

const overview: EliteOverview = {
  folder: "C:\\Chess Coach\\Lichess Elite Database",
  months: [
    {
      month: "2020-04",
      fileName: "lichess_elite_2020-04.pgn",
      path: "x/2020-04.pgn",
      bytes: 348 * 1024 * 1024,
      state: "available",
      gamesImported: 0,
      gamesSkipped: 0,
      elapsedMs: null,
      importedAt: null,
      explorerRows: 0,
    },
    {
      month: "2020-05",
      fileName: "lichess_elite_2020-05.pgn",
      path: "x/2020-05.pgn",
      bytes: 306 * 1024 * 1024,
      state: "done",
      gamesImported: 350000,
      gamesSkipped: 12,
      elapsedMs: 90000,
      importedAt: "2026-10-17T20:00:00Z",
      explorerRows: 1200000,
    },
  ],
  totals: {
    monthsDone: 1,
    games: 350000,
    explorerRows: 1200000,
    dbBytes: 400 * 1024 * 1024,
    newestMonth: "2020-05",
    oldestMonth: "2020-05",
  },
  available: true,
  job: { state: "idle" },
  plyCap: 30,
  dbPath: "C:\\data\\elite.sqlite",
};

describe("EliteSection", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "elite_status":
          return Promise.resolve(overview);
        case "elite_import":
        case "elite_remove_month":
          return Promise.resolve();
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  it("lists the months, selects a preset and starts the import", async () => {
    render(<EliteSection />);
    expect(await screen.findByTestId("elite-totals")).toHaveTextContent(
      `1 months, ${n(350000)} games, ${n(1200000)} explorer rows, 400 MB on disk (2020-05 to 2020-05).`,
    );
    fireEvent.click(screen.getByText("Last 12 months"));
    expect(screen.getByTestId("elite-selection")).toHaveTextContent(
      "2 months selected · 654 MB of PGN",
    );
    fireEvent.click(screen.getByText("Import selected"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("elite_import", { months: ["2020-04", "2020-05"] }),
    );
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("elite_remove_month", { month: "2020-05" }),
    );
  });

  it("describes the job", () => {
    expect(
      jobLine({
        state: "running",
        phase: "importing",
        month: "2020-05",
        monthsDone: 2,
        monthsTotal: 12,
        games: 12345,
        skipped: 3,
        bytesDone: 50,
        bytesTotal: 100,
        elapsedMs: 61000,
      }),
    ).toBe(
      `Importing 2020-05 (3 of 12): 50% of the file, ${(12345).toLocaleString()} games so far, 61 s`,
    );
    expect(
      jobLine({ state: "done", months: 12, games: 2000000, modelLines: 15, elapsedMs: 600000 }),
    ).toBe(
      `Done: 12 months, ${(2000000).toLocaleString()} games, model games for 15 lines, 600 s.`,
    );
    expect(jobLine({ state: "idle" })).toBeNull();
  });
});
