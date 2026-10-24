import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EndgameCurriculum } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));

const { EndgamePage } = await import("./EndgamePage");

const curriculum: EndgameCurriculum = {
  units: [
    {
      id: 1,
      title: "Foundations",
      lessons: [
        {
          id: "kq-mate",
          title: "Queen and king against king",
          concept: "Box the king, bring your own, mate on the edge.",
          positions: [
            {
              fen: "8/8/8/4k3/8/8/8/4K2Q w - - 0 1",
              side: "white",
              goal: "win",
              success: "mate",
              holdMoves: 10,
              note: "Box first.",
            },
          ],
        },
        {
          id: "kr-mate",
          title: "Rook and king against king",
          concept: "Cut the board.",
          positions: [],
        },
      ],
    },
  ],
  progress: [{ lessonId: "kq-mate", attempts: 2, successes: 1, status: "done", completedAt: null }],
};

describe("EndgamePage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) =>
      cmd === "endgame_curriculum"
        ? Promise.resolve(curriculum)
        : Promise.reject(new Error(`unexpected ${cmd}`)),
    );
  });

  it("shows the curriculum with progress, a lesson and its drill", async () => {
    render(<EndgamePage />);
    expect(await screen.findByTestId("curriculum-progress")).toHaveTextContent(
      "1 of 2 lessons done",
    );
    const unit = within(screen.getByRole("list", { name: "Unit 1" }));
    expect(unit.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(unit.getByText("Queen and king against king"));
    expect(await screen.findByTestId("lesson-concept")).toHaveTextContent("Box the king");
    expect(screen.getByTestId("lesson-progress")).toHaveTextContent("Done · 1 of 2 attempts");
    fireEvent.click(screen.getByText("Start drill"));
    expect(await screen.findByTestId("drill-status")).toHaveTextContent("Box first.");
    expect(screen.getByText(/White to move\./)).toBeInTheDocument();
    expect(screen.getByText("Mate the king.")).toBeInTheDocument();
    expect(document.querySelector("cg-board")).not.toBeNull();
  });
});
