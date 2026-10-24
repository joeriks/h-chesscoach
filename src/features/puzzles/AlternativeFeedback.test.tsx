import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { INITIAL_FEN } from "../../lib/chess";
import { AlternativeFeedback } from "./AlternativeFeedback";
import { judgeAlternative } from "./alternativeJudge";

vi.mock("./alternativeJudge", () => ({ judgeAlternative: vi.fn(), candidateFen: () => null }));
beforeEach(() => vi.clearAllMocks());
it("shows a playable engine alternative without claiming exercise completion", async () => {
  vi.mocked(judgeAlternative).mockResolvedValue({
    status: "accepted",
    message: "Within 20 cp.",
    candidateUci: "e2e4",
    referencePv: [],
    replyPv: [],
    depth: 16,
  });
  render(<AlternativeFeedback fen={INITIAL_FEN} uci="e2e4" />);
  fireEvent.click(screen.getByText("Check candidate with engine"));
  expect(await screen.findByText(/Playable alternative/)).toBeInTheDocument();
  expect(screen.getByText(/does not complete the full exercise/)).toBeInTheDocument();
});
it("keeps unavailable-engine comparisons ungraded", async () => {
  vi.mocked(judgeAlternative).mockRejectedValue(new Error("missing backend"));
  render(<AlternativeFeedback fen={INITIAL_FEN} uci="e2e4" />);
  fireEvent.click(screen.getByText("Check candidate with engine"));
  expect(await screen.findByText(/Your move remains ungraded/)).toBeInTheDocument();
});
