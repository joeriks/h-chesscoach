import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Puzzle } from "../../lib/ipc";
import { LOCAL_ATTEMPTS_KEY, localAttemptSummary } from "./localAttempts";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const { usePuzzleSession } = await import("./usePuzzleSession");

const gamePuzzle: Puzzle = {
  id: "game:42#1",
  fen: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  moves: ["a1a2"],
  rating: 0,
  eco: "",
  ecoFamily: "",
  opening: "",
  themes: ["fork"],
  solverColor: "white",
};
const dbPuzzle = { ...gamePuzzle, id: "db#1" };

beforeEach(() => {
  invoke.mockReset();
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe("usePuzzleSession persistence", () => {
  it("records an exact own-game PV as a clean recalled line and schedules delayed practice", async () => {
    const { result } = renderHook(() => usePuzzleSession(gamePuzzle));
    act(() => expect(result.current.playUserMove("a1a2")).toBe("correct"));
    await waitFor(() => expect(result.current.state.phase).toBe("solved"));
    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(localAttemptSummary()).toMatchObject({ total: 1, delayedCleanSolves: 0 });
    expect(JSON.parse(localStorage.getItem(LOCAL_ATTEMPTS_KEY) ?? "[]")[0].dueAt).toBeGreaterThan(
      Date.now(),
    );
  });

  it("keeps a legal own-game alternative ungraded instead of calling it wrong", async () => {
    const { result } = renderHook(() => usePuzzleSession(gamePuzzle));
    act(() => expect(result.current.playUserMove("a1b1")).toBe("compared"));
    await waitFor(() => expect(result.current.state.phase).toBe("compared"));
    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(result.current.state.mistakes).toBe(0);
  });

  it("stores database skips locally without rating them", async () => {
    const { result } = renderHook(() => usePuzzleSession(dbPuzzle));
    act(() => result.current.skip());
    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(invoke).not.toHaveBeenCalledWith("record_puzzle_attempt", expect.anything());
    expect(localAttemptSummary().total).toBe(1);
  });

  it("surfaces a rejected DB save and retries it once", async () => {
    invoke.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      attemptId: 1,
      overall: { theme: "overall", rating: 1500, rd: 1, attempts: 1 },
      themes: [],
    });
    const { result } = renderHook(() => usePuzzleSession(dbPuzzle));
    act(() => result.current.giveUp());
    await waitFor(() => expect(result.current.saveState).toBe("error"));
    act(() => result.current.retrySave());
    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(
      invoke.mock.calls.filter(([command]) => command === "record_puzzle_attempt"),
    ).toHaveLength(2);
  });

  it("does not overwrite stale corrupted local history when saving fails", async () => {
    localStorage.setItem(LOCAL_ATTEMPTS_KEY, "not-json");
    const { result } = renderHook(() => usePuzzleSession(gamePuzzle));
    act(() => result.current.giveUp());
    await waitFor(() => expect(result.current.saveState).toBe("error"));
    expect(localStorage.getItem(LOCAL_ATTEMPTS_KEY)).toBe("not-json");
  });
});
