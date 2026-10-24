import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: () => Promise.resolve(() => {}),
}));

const { Onboarding } = await import("./Onboarding");

describe("Onboarding", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_accounts":
          return Promise.resolve([]);
        case "list_games":
          return Promise.resolve({ total: 3, games: [] });
        case "sync_status":
          return Promise.resolve({ state: "idle" });
        case "get_setting":
          return Promise.resolve(null);
        case "set_setting":
        case "set_schedule_settings":
        case "start_puzzle_import":
          return Promise.resolve();
        case "style_profile":
          return Promise.resolve({
            fromGames: null,
            fromQuiz: null,
            source: "quiz",
            effective: null,
            quiz: [{ text: "Open or closed?", options: ["Open", "Closed"] }],
            answers: null,
          });
        case "puzzle_import_status":
          return Promise.resolve({
            folder: "C:\\puzzles",
            files: 495,
            totalBytes: 1000,
            importedFiles: 0,
            puzzlesInDb: 0,
            pendingFiles: 495,
            job: { state: "idle" },
            lastReport: null,
          });
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  it("walks the four steps, saves the mode and budget, and marks setup done", async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    expect(await screen.findByText(/3 games in the library/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Casual"));
    fireEvent.change(screen.getByLabelText("Daily minutes"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("Continue"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_schedule_settings", {
        mode: "casual",
        dailyMinutes: 20,
      }),
    );

    // No answers yet, so the quiz is open straight away.
    expect(await screen.findByLabelText("Style quiz")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Continue"));
    expect(await screen.findByText("Open the app")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Open the app"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_setting", { key: "onboarding.done", value: "1" }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("can be skipped from the first step", async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    fireEvent.click(await screen.findByText("Skip setup"));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(invoke).not.toHaveBeenCalledWith("set_schedule_settings", expect.anything());
  });
});
