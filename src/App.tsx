import { useEffect, useState } from "react";
import { ipc } from "./lib/ipc";
import { onNavigate } from "./lib/navigation";
import { Onboarding, ONBOARDING_SETTING } from "./features/onboarding/Onboarding";
import { InsightsPage } from "./features/insights/InsightsPage";
import { PuzzlesPage } from "./features/puzzles/PuzzlesPage";
import { ReviewPage } from "./features/review/ReviewPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { TodayPage } from "./features/today/TodayPage";
import { OpeningsPage } from "./features/openings/OpeningsPage";
import { EndgamePage } from "./features/endgame/EndgamePage";
import { StatsPage } from "./features/stats/StatsPage";
import { StrategyPage } from "./features/strategy/StrategyPage";
import { PriorityCoach } from "./features/priorities/PriorityCoach";

const SECTIONS = [
  { id: "today", label: "Today" },
  { id: "review", label: "Review" },
  { id: "puzzles", label: "Puzzles" },
  { id: "openings", label: "Openings" },
  { id: "strategy", label: "Middlegame" },
  { id: "endgame", label: "Endgame" },
  { id: "insights", label: "Insights" },
  { id: "stats", label: "Stats" },
  { id: "settings", label: "Settings" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function App() {
  const desktopConnected = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [section, setSection] = useState<SectionId>("today");
  // null = not known yet; false = first run, show the setup flow.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    ipc
      .getSetting(ONBOARDING_SETTING)
      .then(async (v) => {
        if (v) return true;
        // A database from before the setup flow existed counts as set up already.
        const [accounts, games] = await Promise.all([ipc.listAccounts(), ipc.listGames({}, 1, 0)]);
        if (accounts.length === 0 && games.total === 0) return false;
        await ipc.setSetting(ONBOARDING_SETTING, "1");
        return true;
      })
      .then(setOnboarded)
      .catch(() => setOnboarded(true));
  }, []);

  // Other screens can ask to switch section (e.g. "Train this" opens Puzzles).
  useEffect(
    () =>
      onNavigate((s) => {
        if (SECTIONS.some((x) => x.id === s)) setSection(s as SectionId);
      }),
    [],
  );

  if (onboarded === null) return <div className="h-full" />;
  if (!onboarded) {
    return (
      <main className="h-full overflow-auto">
        <Onboarding
          onDone={() => {
            setOnboarded(true);
            setSection("today");
          }}
        />
      </main>
    );
  }

  return (
    <div className="flex h-full">
      <nav className="flex w-40 shrink-0 flex-col gap-1 border-r border-neutral-800 bg-neutral-950 p-3">
        <div className="mb-4 px-2 text-sm font-semibold tracking-wide text-neutral-400">
          Chess Coach
        </div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            aria-current={section === s.id ? "page" : undefined}
            className={`rounded px-2 py-1.5 text-left text-sm ${
              section === s.id
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto p-6">
        {section === "today" && <PriorityCoach />}
        {!desktopConnected && section === "today" ? (
          <p className="text-sm text-neutral-400">
            Local middlegame training works here. Open the desktop app for imported games, puzzle
            reviews and your schedule.
          </p>
        ) : !desktopConnected && section !== "strategy" ? (
          <section className="max-w-xl space-y-3">
            <h1 className="text-lg font-semibold">Open Chess Coach on your desktop</h1>
            <p className="text-sm text-neutral-300">
              Your games, engine and saved training plan need the desktop app. This browser view can
              still show the guided middlegame exercises.
            </p>
            <button
              type="button"
              onClick={() => setSection("strategy")}
              className="rounded bg-emerald-700 px-3 py-1"
            >
              Try middlegame exercises
            </button>
          </section>
        ) : section === "settings" ? (
          <SettingsPage onSetupAgain={() => setOnboarded(false)} />
        ) : section === "today" ? (
          <TodayPage />
        ) : section === "review" ? (
          <ReviewPage />
        ) : section === "puzzles" ? (
          <PuzzlesPage />
        ) : section === "insights" ? (
          <InsightsPage />
        ) : section === "stats" ? (
          <StatsPage />
        ) : section === "openings" ? (
          <OpeningsPage />
        ) : section === "strategy" ? (
          <StrategyPage />
        ) : (
          <EndgamePage />
        )}
      </main>
    </div>
  );
}
