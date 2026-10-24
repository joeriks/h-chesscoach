import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PriorityCoach } from "./PriorityCoach";
import { requestStrategy } from "../../lib/navigation";
vi.mock("../../lib/navigation", () => ({
  requestStrategy: vi.fn(),
  requestGame: vi.fn(),
  requestPuzzles: vi.fn(),
}));
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
it("explains missing backend evidence and launches the specific recommended position", () => {
  render(<PriorityCoach />);
  expect(screen.getByText(/Game evidence unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/not a known weakness/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Time available"), { target: { value: "5" } });
  fireEvent.click(screen.getByText("Start this practice"));
  expect(requestStrategy).toHaveBeenCalledWith(expect.any(String));
});
