import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineStatus } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

const { SettingsPage } = await import("./SettingsPage");
const { engineLabel } = await import("./engineLabel");

const readyStatus: EngineStatus = {
  ready: true,
  name: "Stockfish 19",
  author: "the Stockfish developers (see AUTHORS file)",
  path: "C:\\app\\stockfish.exe",
  source: "bundled",
  optionCount: 21,
  elapsedMs: 42,
  error: null,
};

describe("engineLabel", () => {
  it("names the engine when the handshake succeeded", () => {
    expect(engineLabel(readyStatus)).toBe("Stockfish 19 ready");
  });

  it("shows the error when it did not", () => {
    expect(engineLabel({ ...readyStatus, ready: false, name: null, error: "file not found" })).toBe(
      "Engine not ready: file not found",
    );
  });
});

describe("SettingsPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "engine_status") return Promise.resolve(readyStatus);
      if (cmd === "app_info")
        return Promise.resolve({
          version: "0.1.0",
          dataDir: "C:\\Users\\me\\AppData\\Roaming\\ChessCoach",
          dbPath: "C:\\Users\\me\\AppData\\Roaming\\ChessCoach\\coach.sqlite",
          schemaVersion: 1,
        });
      return Promise.reject(new Error(`unexpected command ${cmd}`));
    });
  });

  it("shows the engine status from the UCI handshake", async () => {
    render(<SettingsPage />);
    expect(await screen.findByTestId("engine-status")).toHaveTextContent("Stockfish 19 ready");
    expect(await screen.findByText(/coach\.sqlite$/)).toBeInTheDocument();
  });
});
