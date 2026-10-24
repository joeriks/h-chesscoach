import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineEvent } from "../../lib/ipc";
import { INITIAL_FEN } from "../../lib/chess";

const invoke = vi.fn();
let emit: (event: EngineEvent) => void = () => {};
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (_name: string, handler: (e: { payload: EngineEvent }) => void) => {
    emit = (payload) => handler({ payload });
    return Promise.resolve(() => {});
  },
}));

const { AnalysisPage } = await import("./AnalysisPage");

type AnalyzeArgs = { id: number; fen: string; moves: string[]; multipv: number };
const analyzeCalls = () =>
  invoke.mock.calls.filter(([cmd]) => cmd === "analyze_position").map(([, a]) => a as AnalyzeArgs);
const lastAnalyze = () => analyzeCalls().at(-1)!;

function update(id: number, pv: string[], cp: number, extra = {}): EngineEvent {
  return {
    type: "update",
    id,
    status: "ongoing",
    depth: 18,
    nodes: 1_000_000,
    nps: 1_500_000,
    timeMs: 700,
    done: false,
    lines: [
      {
        multipv: 1,
        depth: 18,
        seldepth: 24,
        score: { kind: "cp", value: cp },
        bound: "exact",
        winWhite: 50 + cp / 20,
        wdl: null,
        pv,
      },
    ],
    ...extra,
  };
}

describe("AnalysisPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string, args: AnalyzeArgs) =>
      cmd === "analyze_position"
        ? Promise.resolve({ id: args.id, whiteToMove: true, status: "ongoing" })
        : Promise.resolve(null),
    );
  });

  it("analyses the start position and shows live lines in SAN", async () => {
    render(<AnalysisPage />);
    await waitFor(() => expect(analyzeCalls()).toHaveLength(1));
    expect(lastAnalyze()).toMatchObject({ fen: INITIAL_FEN, moves: [], multipv: 3 });

    act(() => emit(update(lastAnalyze().id, ["e2e4", "e7e5", "g1f3"], 34)));
    expect(await screen.findByText("1.e4 e5 2.Nf3")).toBeInTheDocument();
    expect(within(screen.getByTestId("engine-lines")).getByText("+0.34")).toBeInTheDocument();
    expect(screen.getByTestId("engine-depth")).toHaveTextContent("depth 18 · 1.5 MN/s");
    expect(screen.getByTestId("eval-bar")).toHaveAttribute("aria-valuetext", "+0.34");
  });

  it("re-analyses after a move and ignores output for the old position", async () => {
    render(<AnalysisPage />);
    await waitFor(() => expect(analyzeCalls()).toHaveLength(1));
    const first = lastAnalyze().id;
    act(() => emit(update(first, ["d2d4", "d7d5"], 20)));
    // Clicking a line's score plays its first move (the user exploring it).
    fireEvent.click(within(await screen.findByTestId("engine-lines")).getByText("+0.20"));
    await waitFor(() => expect(analyzeCalls()).toHaveLength(2));
    expect(lastAnalyze().moves).toEqual(["d2d4"]);
    const second = lastAnalyze().id;
    expect(second).toBeGreaterThan(first);

    act(() => emit(update(first, ["c2c4"], 999)));
    expect(screen.queryAllByText("+9.99")).toHaveLength(0);
    act(() => emit(update(second, ["d7d5", "c2c4"], 15)));
    expect(await screen.findByText("1...d5 2.c4")).toBeInTheDocument();

    // ← goes back to the start position and asks the engine again.
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(lastAnalyze().moves).toEqual([]));
  });

  it("sets up a position from a FEN and rejects an invalid one", async () => {
    render(<AnalysisPage />);
    const input = screen.getByLabelText("FEN");
    fireEvent.change(input, { target: { value: "not a fen" } });
    fireEvent.click(screen.getByText("Load"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid FEN");

    const fen = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
    fireEvent.change(input, { target: { value: fen } });
    fireEvent.click(screen.getByText("Load"));
    await waitFor(() => expect(lastAnalyze()).toMatchObject({ fen, moves: [] }));
    expect(screen.getByTestId("current-fen")).toHaveTextContent(fen);
  });

  it("Space turns the engine off and stops the search", async () => {
    render(<AnalysisPage />);
    await waitFor(() => expect(analyzeCalls()).toHaveLength(1));
    fireEvent.keyDown(window, { key: " " });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("stop_analysis"));
    expect(screen.getByText("Engine off.")).toBeInTheDocument();
  });

  it("shows engine restarts", async () => {
    render(<AnalysisPage />);
    act(() => emit({ type: "restarted", reason: "engine process exited" }));
    expect(await screen.findByText("Engine restarted: engine process exited")).toBeInTheDocument();
  });
});
