import { beforeEach, describe, expect, it, vi } from "vitest";

let handler: ((event: unknown) => void) | undefined;
const invoke = vi.fn();
let off = vi.fn();
let listenImpl: () => Promise<() => void>;
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (_name: string, callback: (event: { payload: unknown }) => void) => {
    handler = (payload) => callback({ payload });
    return listenImpl();
  },
}));

const { judgeAlternative } = await import("./alternativeJudge");
const fen = "7k/8/8/8/8/8/8/K7 w - - 0 1";

function engine(scores: number[]) {
  let index = 0;
  invoke.mockImplementation((command: string, args: { id: number }) => {
    if (command === "analyze_position") {
      const score = scores[index++]!;
      queueMicrotask(() => {
        handler?.({
          type: "update",
          id: args.id + 1,
          done: true,
          depth: 18,
          lines: [
            {
              multipv: 1,
              depth: 18,
              seldepth: null,
              score: { kind: "cp", value: -999 },
              bound: "exact",
              winWhite: 0,
              wdl: null,
              pv: [],
            },
          ],
        });
        handler?.({
          type: "update",
          id: args.id,
          done: true,
          depth: 16,
          lines: [
            {
              multipv: 1,
              depth: 16,
              seldepth: null,
              score: { kind: "cp", value: score },
              bound: "exact",
              winWhite: 50,
              wdl: null,
              pv: ["a1a2"],
            },
          ],
        });
      });
      return Promise.resolve({ id: args.id, whiteToMove: true, status: "ongoing" });
    }
    return Promise.resolve();
  });
}

describe("judgeAlternative", () => {
  beforeEach(() => {
    invoke.mockReset();
    off = vi.fn(() => {
      handler = undefined;
    });
    listenImpl = () => Promise.resolve(off);
  });
  it("accepts a close winning alternative and ignores stale IDs", async () => {
    engine([100, 65]);
    const result = await judgeAlternative(fen, "a1b1");
    expect(result).toMatchObject({ status: "accepted", cpLoss: 35, depth: 16 });
  });

  it("uses the mover perspective for Black and rejects a bad alternative", async () => {
    const blackFen = "k7/8/8/8/8/8/8/7K b - - 0 1";
    engine([-100, -20]);
    const result = await judgeAlternative(blackFen, "a8b8");
    expect(result).toMatchObject({ status: "rejected", cpLoss: 80 });
  });

  it("returns ungraded on engine failure and accepts immediate mate", async () => {
    invoke.mockImplementation((command: string) => {
      if (command === "analyze_position")
        queueMicrotask(() => handler?.({ type: "failed", reason: "missing" }));
      return Promise.resolve();
    });
    await expect(judgeAlternative(fen, "a1b1")).resolves.toMatchObject({ status: "ungraded" });
    await expect(judgeAlternative("7k/8/5KQ1/8/8/8/8/8 w - - 0 1", "g6g7")).resolves.toMatchObject({
      status: "accepted",
    });
  });

  it("returns ungraded when cancelled", async () => {
    invoke.mockResolvedValue({});
    const controller = new AbortController();
    const pending = judgeAlternative(fen, "a1b1", controller.signal);
    controller.abort();
    await expect(pending).resolves.toMatchObject({ status: "ungraded" });
  });

  it("returns ungraded after a twelve-second timeout", async () => {
    vi.useFakeTimers();
    invoke.mockResolvedValue({});
    const pending = judgeAlternative(fen, "a1b1");
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(pending).resolves.toMatchObject({ status: "ungraded" });
    expect(invoke).toHaveBeenCalledWith("stop_analysis");
    vi.useRealTimers();
  });

  it("does not invoke analysis if listener setup finishes after timeout", async () => {
    vi.useFakeTimers();
    invoke.mockResolvedValue({});
    let resolveListener!: (value: () => void) => void;
    listenImpl = () =>
      new Promise((resolve) => {
        resolveListener = resolve;
      });
    const pending = judgeAlternative(fen, "a1b1");
    await vi.advanceTimersByTimeAsync(12_000);
    resolveListener(off);
    await expect(pending).resolves.toMatchObject({ status: "ungraded" });
    expect(invoke.mock.calls.some(([command]) => command === "analyze_position")).toBe(false);
    expect(off).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
