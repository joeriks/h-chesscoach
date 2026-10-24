import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, SyncStatus } from "../../lib/ipc";

const invoke = vi.fn();
let emit: (s: SyncStatus) => void = () => {};
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (_name: string, handler: (e: { payload: SyncStatus }) => void) => {
    emit = (payload) => handler({ payload });
    return Promise.resolve(() => {});
  },
}));

const { AccountsSection } = await import("./AccountsSection");
const { syncLabel } = await import("./syncLabel");

const accounts: Account[] = [
  { id: 1, source: "lichess", username: "hugo", lastSyncedAt: "2026-10-17T11:00:00Z", games: 212 },
];

describe("AccountsSection", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_accounts":
          return Promise.resolve(accounts);
        case "sync_status":
          return Promise.resolve({ state: "idle" });
        case "get_setting":
          return Promise.resolve("hugo_otb");
        case "add_account":
          return Promise.resolve(2);
        case "sync_account":
        case "set_setting":
          return Promise.resolve();
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  it("shows linked accounts, adds one, and follows sync progress", async () => {
    render(<AccountsSection />);
    expect(await screen.findByText("hugo")).toBeInTheDocument();
    expect(screen.getByText(/212 games, synced 2026-10-17 11:00/)).toBeInTheDocument();
    expect(screen.getByLabelText("Aliases")).toHaveValue("hugo_otb");

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "chesscom" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "  HugoCC " } });
    fireEvent.click(screen.getByText("Add and sync"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("add_account", {
        source: "chesscom",
        username: "  HugoCC ",
      }),
    );

    act(() =>
      emit({ state: "running", accountId: 1, phase: "fetching from Lichess", fetched: 50 }),
    );
    expect(screen.getByTestId("sync-status")).toHaveTextContent(
      "Syncing hugo: fetching from Lichess (50 games)…",
    );
    act(() =>
      emit({ state: "done", accountId: 1, fetched: 60, inserted: 7, duplicates: 53, skipped: 0 }),
    );
    expect(screen.getByTestId("sync-status")).toHaveTextContent(
      "hugo: 7 new games, 53 already known.",
    );

    fireEvent.click(screen.getByText("Sync"));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("sync_account", { id: 1 }));
  });

  it("formats failures", () => {
    expect(syncLabel({ state: "failed", accountId: 1, error: "user not found" }, accounts)).toBe(
      "hugo: sync failed, user not found",
    );
    expect(syncLabel({ state: "idle" }, accounts)).toBeNull();
  });
});
