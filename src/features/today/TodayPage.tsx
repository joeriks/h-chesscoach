import { useCallback, useEffect, useState } from "react";
import {
  ipc,
  type DayPlan,
  type PlanTask,
  type QuickAction,
  type ScheduleSettings,
  type Streak,
} from "../../lib/ipc";
import {
  navigate,
  requestEndgame,
  requestGame,
  requestOpenings,
  requestPuzzles,
} from "../../lib/navigation";
import { elapsedLabel, lengthLabel, minutesLeft, stateLabel, streakLine } from "./todayText";

const CASUAL_CHOICES = [5, 15, 30];

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Today: the Dedicated timeline or the Casual chooser, with the mode toggle in the header. */
export function TodayPage() {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    ipc
      .scheduleSettings()
      .then((s) => {
        setSettings(s);
        if (!s.configured) return;
        ipc
          .todayPlan()
          .then(setPlan)
          .catch((e: unknown) => setError(errorText(e)));
        ipc
          .trainingStreak()
          .then(setStreak)
          .catch(() => {});
        if (s.mode === "casual") {
          ipc
            .quickActions()
            .then(setActions)
            .catch(() => {});
        }
      })
      .catch((e: unknown) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    load();
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    ipc
      .onScheduleEvent((e) => {
        if (e.state === "gameFinished") {
          // The plan carries the explanation; the flash only covers a note-less event.
          setFlash(e.note ? null : "Your game arrived; the rest of the day is re-planned.");
          load();
        }
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [load]);

  const choose = (mode: "dedicated" | "casual", minutes: number) => {
    setError(null);
    ipc
      .setScheduleSettings(mode, minutes)
      .then(() => {
        setPlan(null);
        load();
      })
      .catch((e: unknown) => setError(errorText(e)));
  };

  const apply = (p: Promise<DayPlan>) => {
    setError(null);
    p.then((next) => {
      setPlan(next);
      ipc
        .trainingStreak()
        .then(setStreak)
        .catch(() => {});
    }).catch((e: unknown) => setError(errorText(e)));
  };

  if (!settings) return <p className="text-sm text-neutral-400">{error ?? "Loading…"}</p>;

  if (!settings.configured) {
    return <Setup minutes={settings.dailyMinutes} onChoose={choose} error={error} />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Today</h1>
        <div
          className="flex rounded border border-neutral-700 text-sm"
          role="group"
          aria-label="Mode"
        >
          {(["dedicated", "casual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={settings.mode === m}
              onClick={() => settings.mode !== m && choose(m, settings.dailyMinutes)}
              className={`px-3 py-1 ${
                settings.mode === m
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {m === "dedicated" ? "Dedicated" : "Casual"}
            </button>
          ))}
        </div>
        {settings.mode === "dedicated" && (
          <label className="flex items-center gap-1 text-sm text-neutral-400">
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              defaultValue={settings.dailyMinutes}
              aria-label="Daily minutes"
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v >= 5 && v !== settings.dailyMinutes) choose("dedicated", v);
              }}
              className="w-16 rounded border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-right text-neutral-200"
            />
            min/day
          </label>
        )}
        {streak && settings.mode === "dedicated" && (
          <span className="text-sm text-neutral-400" data-testid="streak">
            {streakLine(streak)}
          </span>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {flash && (
        <p className="text-sm text-emerald-300" data-testid="replan-note">
          {flash}
        </p>
      )}

      {settings.mode === "dedicated" ? (
        plan ? (
          <Timeline plan={plan} apply={apply} onReplan={() => apply(ipc.regenerateToday())} />
        ) : (
          <p className="text-sm text-neutral-400">Planning your day…</p>
        )
      ) : (
        <Casual plan={plan} actions={actions} apply={apply} />
      )}
    </div>
  );
}

function Setup({
  minutes,
  onChoose,
  error,
}: {
  minutes: number;
  onChoose: (mode: "dedicated" | "casual", minutes: number) => void;
  error: string | null;
}) {
  const [budget, setBudget] = useState(minutes);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-lg font-semibold">How do you want to train?</h1>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="rounded border border-neutral-800 p-4">
        <h2 className="font-semibold">Dedicated</h2>
        <p className="mt-1 text-sm text-neutral-400">
          A daily plan across tactics, your games and (soon) openings and endgames, with streaks.
          Real games get an elastic slot that re-plans the rest of the day.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="number"
            min={5}
            max={480}
            step={5}
            value={budget}
            aria-label="Daily minutes"
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-20 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-right"
          />
          minutes a day
        </label>
        <button
          type="button"
          onClick={() => onChoose("dedicated", budget)}
          className="mt-3 rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
        >
          Plan my days
        </button>
      </div>
      <div className="rounded border border-neutral-800 p-4">
        <h2 className="font-semibold">Casual</h2>
        <p className="mt-1 text-sm text-neutral-400">
          "What do you have time for?" Pick 5, 15 or 30 minutes and get one focused session on your
          top weaknesses. No streaks, nothing to catch up on; progress still counts.
        </p>
        <button
          type="button"
          onClick={() => onChoose("casual", budget)}
          className="mt-3 rounded border border-neutral-600 px-3 py-1 text-sm hover:bg-neutral-800"
        >
          Keep it casual
        </button>
      </div>
    </div>
  );
}

function Timeline({
  plan,
  apply,
  onReplan,
}: {
  plan: DayPlan;
  apply: (p: Promise<DayPlan>) => void;
  onReplan: () => void;
}) {
  const left = minutesLeft(plan.tasks, plan.budgetMin);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-400">
        <span data-testid="budget">
          {plan.budgetMin} min planned · {left} min left
        </span>
        <button
          type="button"
          onClick={onReplan}
          className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
        >
          Re-plan the rest of the day
        </button>
      </div>
      {plan.note && (
        <p className="text-sm text-emerald-300" data-testid="plan-note">
          {plan.note}
        </p>
      )}
      <ol className="space-y-2" aria-label="Today's plan">
        {plan.tasks.map((t) => (
          <TaskCard key={t.id} task={t} apply={apply} />
        ))}
      </ol>
    </section>
  );
}

function Casual({
  plan,
  actions,
  apply,
}: {
  plan: DayPlan | null;
  actions: QuickAction[];
  apply: (p: Promise<DayPlan>) => void;
}) {
  const [withGame, setWithGame] = useState(false);
  const run = (a: QuickAction) => {
    switch (a.kind) {
      case "puzzles":
        requestPuzzles(a.reference);
        break;
      case "review_game":
        if (a.reference) requestGame(Number(a.reference), 0);
        else navigate("review");
        break;
      case "srs_due":
        requestPuzzles(null, { retry: true });
        break;
      case "play_game":
        apply(ipc.casualSession(a.minutes, true));
        break;
    }
  };
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          What do you have time for?
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {CASUAL_CHOICES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => apply(ipc.casualSession(m, withGame))}
              className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
            >
              {m} min
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={withGame}
              onChange={(e) => setWithGame(e.target.checked)}
            />
            I'm about to play a game
          </label>
        </div>
      </section>
      {actions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Quick actions
          </h2>
          <ul className="flex flex-wrap gap-2" aria-label="Quick actions">
            {actions.map((a) => (
              <li key={a.title}>
                <button
                  type="button"
                  onClick={() => run(a)}
                  className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
                >
                  {a.title}
                  <span className="ml-2 text-xs text-neutral-500">{a.minutes} min</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {plan && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            This session · {plan.budgetMin} min
          </h2>
          <ol className="space-y-2" aria-label="This session">
            {plan.tasks.map((t) => (
              <TaskCard key={t.id} task={t} apply={apply} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function TaskCard({ task, apply }: { task: PlanTask; apply: (p: Promise<DayPlan>) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = task.kind === "play_game" && task.state === "active" && !!task.startedAt;
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  const start = () => {
    switch (task.kind) {
      case "play_game":
        apply(ipc.startGameBlock(task.id));
        return;
      case "puzzles":
        apply(ipc.startTask(task.id));
        requestPuzzles(task.reference, { taskId: task.id });
        return;
      case "srs_due":
        apply(ipc.startTask(task.id));
        requestPuzzles(null, { retry: true, taskId: task.id });
        return;
      case "review_game":
        apply(ipc.startTask(task.id));
        if (task.reference) requestGame(Number(task.reference), 0);
        else navigate("review");
        return;
      case "opening_drill":
        apply(ipc.startTask(task.id));
        requestOpenings({ drill: true, taskId: task.id });
        return;
      case "endgame_lesson":
        apply(ipc.startTask(task.id));
        requestEndgame({ lessonId: task.reference, taskId: task.id });
        return;
      default:
        apply(ipc.startTask(task.id));
    }
  };

  const muted = task.state === "dropped" || task.state === "skipped";
  const label = stateLabel(task);
  return (
    <li
      className={`rounded border p-3 ${
        task.state === "active"
          ? "border-emerald-700"
          : muted
            ? "border-neutral-900 text-neutral-500"
            : "border-neutral-800"
      }`}
      data-testid="task"
      data-state={task.state}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={`font-semibold ${muted ? "line-through" : ""}`}>{task.title}</span>
        <span className="text-sm text-neutral-400">{lengthLabel(task)}</span>
        {label && <span className="text-xs text-neutral-500">{label}</span>}
        <span className="ml-auto flex gap-2">
          {task.state === "pending" && (
            <button
              type="button"
              onClick={start}
              className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
            >
              Start
            </button>
          )}
          {task.state === "active" && task.kind === "play_game" && (
            <button
              type="button"
              onClick={() => apply(ipc.finishGameBlock(task.id))}
              className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
            >
              Game finished
            </button>
          )}
          {task.state === "active" && task.kind !== "play_game" && (
            <button
              type="button"
              onClick={() => apply(ipc.finishTask(task.id))}
              className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
            >
              Done
            </button>
          )}
          {(task.state === "pending" || task.state === "active") && (
            <button
              type="button"
              onClick={() => apply(ipc.skipTask(task.id))}
              className="rounded border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800"
            >
              Skip
            </button>
          )}
        </span>
      </div>
      <p className="mt-1 text-sm text-neutral-400">{task.why}</p>
      {ticking && task.startedAt && (
        <p className="mt-1 text-sm text-emerald-300" data-testid="game-timer">
          Playing for {elapsedLabel(task.startedAt, now)}. I check your accounts every minute and
          end the block when the game arrives.
        </p>
      )}
    </li>
  );
}
