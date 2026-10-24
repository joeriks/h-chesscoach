import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EndgameCurriculum } from "../../lib/ipc";

const invoke = vi.fn();
let rejectAttempt = false;
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));
vi.mock("../../lib/navigation", () => ({
  navigate: vi.fn(),
  requestPuzzles: vi.fn(),
  takeEndgameRequest: () => ({ lessonId: null, taskId: 42 }),
}));
vi.mock("./EndgameDrill", () => ({
  EndgameDrill: (props: {
    onResult: (success: boolean) => void;
    onNext: () => void;
    saveError?: string | null;
    onRetrySave?: () => void;
  }) => (
    <div>
      <button onClick={() => props.onResult(true)}>Pass</button>
      <button onClick={() => props.onResult(false)}>Fail</button>
      <button onClick={props.onNext}>Next</button>
      {props.saveError && <button onClick={props.onRetrySave}>Retry save</button>}
    </div>
  ),
}));
const { EndgamePage } = await import("./EndgamePage");

const curriculum: EndgameCurriculum = {
  units: [
    {
      id: 1,
      title: "Unit",
      lessons: [
        {
          id: "two",
          title: "Two positions",
          concept: "",
          positions: [
            {
              fen: "8/8/8/8/8/8/P7/K7 w - - 0 1",
              side: "white",
              goal: "win",
              success: "promote",
              holdMoves: 1,
              note: "one",
            },
            {
              fen: "8/8/8/8/8/8/1P6/K7 w - - 0 1",
              side: "white",
              goal: "win",
              success: "promote",
              holdMoves: 1,
              note: "two",
            },
          ],
        },
      ],
    },
  ],
  progress: [],
};

describe("EndgamePage position aggregation", () => {
  beforeEach(() => {
    localStorage.clear();
    rejectAttempt = false;
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "endgame_curriculum") return Promise.resolve(curriculum);
      if (cmd === "endgame_attempt") {
        if (rejectAttempt) {
          rejectAttempt = false;
          return Promise.reject(new Error("offline"));
        }
        return Promise.resolve([]);
      }
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
  });

  it("records only the completed set, not a partial success", async () => {
    render(<EndgamePage />);
    fireEvent.click(await screen.findByText("Two positions"));
    fireEvent.click(screen.getAllByText("Start drill")[0]!);
    fireEvent.click(screen.getByText("Pass"));
    expect(invoke).not.toHaveBeenCalledWith(
      "endgame_attempt",
      expect.objectContaining({ success: true }),
    );
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Pass"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("endgame_attempt", { lessonId: "two", success: true }),
    );
  });

  it("clears a previously passed position after a failed retry", async () => {
    render(<EndgamePage />);
    fireEvent.click(await screen.findByText("Two positions"));
    fireEvent.click(screen.getAllByText("Start drill")[0]!);
    fireEvent.click(screen.getByText("Pass"));
    fireEvent.click(screen.getByText("Fail"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Pass"));
    await waitFor(() =>
      expect(invoke).toHaveBeenLastCalledWith("endgame_attempt", {
        lessonId: "two",
        success: false,
      }),
    );
  });

  it("does not finish a task when saving is rejected, and retries the save", async () => {
    rejectAttempt = true;
    render(<EndgamePage />);
    fireEvent.click(await screen.findByText("Two positions"));
    fireEvent.click(screen.getAllByText("Start drill")[0]!);
    fireEvent.click(screen.getByText("Pass"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Pass"));
    await waitFor(() => expect(screen.getByText("Retry save")).toBeInTheDocument());
    expect(invoke).not.toHaveBeenCalledWith("finish_task", expect.anything());
    fireEvent.click(screen.getByText("Retry save"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("finish_task", { id: 42, actualMin: null }),
    );
  });
});
