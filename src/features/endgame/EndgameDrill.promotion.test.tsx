import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DrillPosition } from "../../lib/ipc";

const invoke = vi.fn().mockResolvedValue({
  ok: true,
  message: "Promoted.",
  fenAfter: "N7/8/8/8/8/8/8/K7 b - - 0 1",
  replyUci: null,
  replySan: null,
  fenNext: null,
  done: true,
  category: "promote",
});
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));
const onMove = vi.fn();
vi.mock("../../components/board/Board", () => ({
  Board: (props: { onMove: (from: string, to: string) => boolean }) => {
    onMove.mockImplementation(props.onMove);
    return <div data-testid="board" />;
  },
}));
vi.mock("../openings/useDrillBoard", () => ({
  squaresOf: () => undefined,
  useDrillBoard: () => ({
    fen: "8/4P3/8/8/8/8/8/K7 w - - 0 1",
    turn: "white",
    check: false,
    dests: new Map(),
    revision: 0,
    snapBack: vi.fn(),
    isPromotionMove: () => true,
    uciFor: (_from: string, _to: string, promotion?: string) =>
      `e7e8${promotion === "knight" ? "n" : "q"}`,
  }),
}));
const { EndgameDrill } = await import("./EndgameDrill");

const position: DrillPosition = {
  fen: "8/4P3/8/8/8/8/8/K7 w - - 0 1",
  side: "white",
  goal: "win",
  success: "promote",
  holdMoves: 1,
  note: "Promote.",
};

describe("EndgameDrill promotions", () => {
  it("sends a knight promotion UCI after the choice dialog", async () => {
    render(
      <EndgameDrill
        lessonId="promotion"
        index={0}
        position={position}
        onResult={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    await act(async () => {
      onMove("e7", "e8");
    });
    fireEvent.click(screen.getByRole("button", { name: "knight" }));
    expect(invoke).toHaveBeenCalledWith("endgame_judge", expect.objectContaining({ uci: "e7e8n" }));
  });
});
