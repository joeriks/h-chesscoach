import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CoachReflection } from "./CoachReflection";
import { INITIAL_FEN } from "../../lib/chess";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it("requires a prediction, saves it before reveal, and restores the same position's notes", () => {
  const reveal = vi.fn();
  const view = render(
    <CoachReflection gameId={1} fen={INITIAL_FEN} revealed={false} onReveal={reveal} />,
  );
  expect(screen.getByText("Save and compare with engine")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("What is the opponent threatening?"), {
    target: { value: "No immediate threat" },
  });
  fireEvent.change(screen.getByLabelText("Your candidate moves and chosen plan"), {
    target: { value: "e4 or d4: occupy the centre" },
  });
  fireEvent.change(screen.getByLabelText("The strongest reply you expect"), {
    target: { value: "...e5" },
  });
  fireEvent.click(screen.getByText("Save and compare with engine"));
  expect(reveal).toHaveBeenCalledOnce();
  view.unmount();
  render(<CoachReflection gameId={1} fen={INITIAL_FEN} revealed onReveal={reveal} />);
  expect(screen.getByLabelText("The strongest reply you expect")).toHaveValue("...e5");
});
it("does not silently replace corrupted notes or claim they were saved", () => {
  localStorage.setItem(`chesscoach.reflection.v1:1:${INITIAL_FEN}`, "broken");
  render(<CoachReflection gameId={1} fen={INITIAL_FEN} revealed onReveal={() => {}} />);
  expect(screen.getByRole("alert")).toHaveTextContent("not been replaced");
  expect(screen.getByText("Save reflection")).toBeDisabled();
  expect(localStorage.getItem(`chesscoach.reflection.v1:1:${INITIAL_FEN}`)).toBe("broken");
});
