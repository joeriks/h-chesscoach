import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Board } from "./Board";

describe("Board", () => {
  it("renders chessground with the starting position", () => {
    render(<Board />);
    const board = screen.getByTestId("board");
    expect(board.querySelector("cg-board")).not.toBeNull();
    // Pieces on squares only; chessground also keeps a hidden drag "ghost" piece outside cg-board.
    expect(board.querySelectorAll("cg-board piece")).toHaveLength(32);
  });
});
