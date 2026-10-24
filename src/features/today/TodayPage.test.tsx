import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DayPlan, PlanTask } from "../../lib/ipc";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => Promise.resolve(() => {}) }));

const { TodayPage } = await import("./TodayPage");
const { lengthLabel, streakLine, minutesLeft } = await import("./todayText");
const { takePuzzleRequest, takeGameRequest } = await import("../../lib/navigation");

function task(over: Partial<PlanTask> & Pick<PlanTask, "id" | "kind" | "title">): PlanTask {
  return {
    reference: null,
    why: "Because.",
    priority: 50,
    minMin: 5,
    targetMin: 10,
    maxMin: 15,
    plannedMin: 10,
    actualMin: null,
    state: "pending",
    orderIdx: over.id,
    startedAt: null,
    carried: false,
    estimate: null,
    ...over,
  };
}

const plan: DayPlan = {
  id: 1,
  date: "2026-10-17",
  mode: "dedicated",
  budgetMin: 60,
  status: "open",
  note: null,
  tasks: [
    task({ id: 1, kind: "srs_due", title: "Retry 3 due puzzles", state: "done", actualMin: 6 }),
    task({ id: 2, kind: "puzzles", reference: "fork", title: "Fork puzzles", plannedMin: 23 }),
    task({
      id: 3,
      kind: "review_game",
      reference: "42",
      title: "Review your loss against Rival",
      plannedMin: 8,
    }),
    task({
      id: 4,
      kind: "play_game",
      reference: "900+0",
      title: "Play a 15+0 game",
      plannedMin: 18,
      minMin: 15,
      maxMin: 22,
      estimate: {
        initialSec: 900,
        incrementSec: 0,
        p20Sec: 720,
        p50Sec: 900,
        p80Sec: 1140,
        maxSec: 1800,
        source: "learned",
        games: 12,
      },
    }),
  ],
};

describe("TodayPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "schedule_settings":
          return Promise.resolve({ mode: "dedicated", dailyMinutes: 60, configured: true });
        case "today_plan":
          return Promise.resolve(plan);
        case "training_streak":
          return Promise.resolve({ days: 3, minutesToday: 6, minutesThisWeek: 120 });
        case "start_task":
        case "start_game_block":
        case "skip_task":
        case "finish_task":
          return Promise.resolve(plan);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  it("shows the dedicated timeline and starts tasks on the right screen", async () => {
    render(<TodayPage />);
    expect(await screen.findByTestId("streak")).toHaveTextContent(
      "3-day streak · 6 min today · 120 min this week",
    );
    expect(screen.getByTestId("budget")).toHaveTextContent("60 min planned · 54 min left");
    const items = within(screen.getByRole("list", { name: "Today's plan" })).getAllByTestId("task");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Done · 6 min");
    expect(items[3]).toHaveTextContent("18 min reserved · usually 12–19 min for you");

    fireEvent.click(within(items[1]!).getByText("Start"));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("start_task", { id: 2 }));
    expect(takePuzzleRequest()).toEqual({ theme: "fork", taskId: 2 });

    fireEvent.click(within(items[2]!).getByText("Start"));
    expect(takeGameRequest()).toEqual({ gameId: 42, ply: 0 });

    fireEvent.click(within(items[3]!).getByText("Start"));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("start_game_block", { id: 4 }));
  });

  it("shows the timer and the finish button for an active game block", async () => {
    const active: DayPlan = {
      ...plan,
      note: "Game took 6 min (−12). I grew fork puzzles to 25 min.",
      tasks: plan.tasks.map((t) =>
        t.id === 4
          ? { ...t, state: "active", startedAt: new Date(Date.now() - 125_000).toISOString() }
          : t,
      ),
    };
    invoke.mockImplementation((cmd: string) =>
      cmd === "today_plan"
        ? Promise.resolve(active)
        : cmd === "schedule_settings"
          ? Promise.resolve({ mode: "dedicated", dailyMinutes: 60, configured: true })
          : cmd === "finish_game_block"
            ? Promise.resolve(plan)
            : Promise.resolve({ days: 0, minutesToday: 0, minutesThisWeek: 0 }),
    );
    render(<TodayPage />);
    expect(await screen.findByTestId("game-timer")).toHaveTextContent(/Playing for 2:0\d/);
    expect(screen.getByTestId("plan-note")).toHaveTextContent("Game took 6 min (−12)");
    fireEvent.click(screen.getByText("Game finished"));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("finish_game_block", { id: 4 }));
  });

  it("asks for a mode first, then offers the casual chooser and quick actions", async () => {
    let configured = false;
    invoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      switch (cmd) {
        case "schedule_settings":
          return Promise.resolve({ mode: "casual", dailyMinutes: 60, configured });
        case "set_schedule_settings":
          configured = true;
          expect(args).toEqual({ mode: "casual", dailyMinutes: 60 });
          return Promise.resolve({ mode: "casual", dailyMinutes: 60, configured });
        case "today_plan":
          return Promise.resolve(null);
        case "training_streak":
          return Promise.resolve({ days: 0, minutesToday: 0, minutesThisWeek: 0 });
        case "quick_actions":
          return Promise.resolve([
            { kind: "puzzles", reference: "fork", title: "10 fork puzzles", minutes: 10 },
            {
              kind: "review_game",
              reference: "42",
              title: "Review your loss against Rival",
              minutes: 8,
            },
            { kind: "srs_due", reference: null, title: "Retry 1 due puzzle", minutes: 3 },
          ]);
        case "casual_session":
          expect(args).toEqual({ minutes: 15, withGame: false });
          return Promise.resolve({ ...plan, mode: "casual", budgetMin: 15 });
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
    render(<TodayPage />);
    fireEvent.click(await screen.findByText("Keep it casual"));
    const actions = within(await screen.findByRole("list", { name: "Quick actions" }));
    expect(actions.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(actions.getByText("10 fork puzzles"));
    expect(takePuzzleRequest()).toEqual({ theme: "fork" });
    fireEvent.click(actions.getByText("Retry 1 due puzzle"));
    expect(takePuzzleRequest()).toEqual({ theme: null, retry: true });

    fireEvent.click(screen.getByText("15 min"));
    expect(await screen.findByRole("list", { name: "This session" })).toBeInTheDocument();
  });

  it("formats lengths, streaks and what is left", () => {
    expect(lengthLabel(plan.tasks[1]!)).toBe("23 min (5–15)");
    expect(lengthLabel(plan.tasks[3]!)).toBe("18 min reserved · usually 12–19 min for you");
    expect(streakLine({ days: 0, minutesToday: 0, minutesThisWeek: 30 })).toBe(
      "No streak yet · 0 min today · 30 min this week",
    );
    expect(minutesLeft(plan.tasks, 60)).toBe(54);
  });
});
