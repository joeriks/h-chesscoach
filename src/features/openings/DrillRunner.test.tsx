import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { DrillCard } from "../../lib/ipc";
import { INITIAL_FEN } from "../../lib/chess";
const invoke = vi.fn();
let move: (a: string, b: string) => boolean;
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("../../components/board/Board", () => ({
  Board: (p: { onMove: typeof move }) => {
    move = p.onMove;
    return <div />;
  },
}));
const { DrillRunner } = await import("./DrillRunner");
const card: DrillCard = {
  refId: "one",
  lineKey: "italian",
  lineName: "Italian",
  repertoire: "italian",
  ply: 1,
  fen: INITIAL_FEN,
  expectedUci: "e2e4",
  expectedSan: "e4",
  note: "Occupy the centre.",
  side: "white",
  replyUci: null,
  replySan: null,
  isNew: true,
  dueAt: null,
};
beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation((cmd) =>
    Promise.resolve(cmd === "opening_drill_session" ? [card] : null),
  );
});
it("keeps the explanation visible and waits for saving before progressing", async () => {
  let resolve!: () => void;
  invoke.mockImplementation((cmd) =>
    cmd === "answer_opening_drill"
      ? new Promise<void>((r) => {
          resolve = r;
        })
      : Promise.resolve([card]),
  );
  render(<DrillRunner stats={null} hasRepertoire onFinished={() => {}} />);
  fireEvent.click(screen.getByText("Start drilling"));
  await screen.findByText(/White to move/);
  act(() => {
    move("e2", "e4");
  });
  expect(screen.getByText("Occupy the centre.")).toBeInTheDocument();
  expect(screen.getByText("Understood, next")).toBeDisabled();
  await act(async () => resolve());
  expect(screen.getByText("Understood, next")).toBeEnabled();
});
it("describes alternatives as a recall difference and offers retry on failed persistence", async () => {
  invoke.mockImplementation((cmd) =>
    cmd === "answer_opening_drill" ? Promise.reject(new Error("offline")) : Promise.resolve([card]),
  );
  render(<DrillRunner stats={null} hasRepertoire onFinished={() => {}} />);
  fireEvent.click(screen.getByText("Start drilling"));
  await screen.findByText(/White to move/);
  act(() => {
    move("d2", "d4");
  });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("not saved"));
  expect(screen.getByText(/Your move may also be playable/)).toBeInTheDocument();
  expect(screen.getByText("Got it, next")).toBeDisabled();
});
