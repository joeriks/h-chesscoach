import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { StrategyPage } from "./StrategyPage";
import { rankStrategy, readStrategyHistory } from "./progress";
vi.mock("../../components/board/Board", () => ({ Board: () => <div>Board</div> }));
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
function answer() {
  const e = rankStrategy([])[0]!.exercise;
  fireEvent.change(screen.getByLabelText("Your reasoning"), {
    target: { value: "Compare the central break with the opponent's threat" },
  });
  fireEvent.click(screen.getByLabelText(e.options.find((o) => o.preferred)!.text));
  fireEvent.click(screen.getByLabelText(e.counterplay.options.find((o) => o.preferred)!.text));
  fireEvent.click(screen.getByText("Commit both answers"));
}
it("requires two answers before feedback and persists first results across remount", () => {
  const view = render(<StrategyPage />);
  expect(screen.getByText("Commit both answers")).toBeDisabled();
  expect(screen.queryByText(/Opponent's resources:/)).toBeNull();
  answer();
  expect(screen.getByText("Both objectives matched.")).toBeInTheDocument();
  expect(readStrategyHistory()).toHaveLength(1);
  expect(screen.getByLabelText("Your reasoning")).toBeDisabled();
  view.unmount();
  render(<StrategyPage />);
  expect(screen.getByText(/Saved: 1 distinct/)).toBeInTheDocument();
  expect(screen.getByText(/Apply a practised idea/)).toBeInTheDocument();
});
it("blocks progression after storage failure and retry saves exactly once", () => {
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
    throw new Error("quota");
  });
  render(<StrategyPage />);
  answer();
  expect(screen.getByText("Next position")).toBeDisabled();
  fireEvent.click(screen.getByText("Retry saving"));
  expect(screen.getByText("Next position")).toBeEnabled();
  expect(readStrategyHistory()).toHaveLength(1);
  expect(set).toHaveBeenCalledTimes(2);
});
it("ends after three distinct positions without looping through memorised answers", () => {
  render(<StrategyPage />);
  for (let i = 0; i < 3; i++) {
    fireEvent.change(screen.getByLabelText("Your reasoning"), {
      target: { value: "Compare activity, structure and the opponent's reply" },
    });
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]!);
    fireEvent.click(radios[3]!);
    fireEvent.click(screen.getByText("Commit both answers"));
    fireEvent.click(screen.getByText(i === 2 ? "Finish session" : "Next position"));
  }
  expect(screen.getByText("Session complete")).toBeInTheDocument();
  expect(new Set(readStrategyHistory().map((a) => a.exerciseId)).size).toBe(3);
});
