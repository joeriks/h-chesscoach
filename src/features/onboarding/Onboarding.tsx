import { useCallback, useEffect, useState } from "react";
import {
  ipc,
  type Account,
  type PuzzleImportState,
  type PuzzleImportStatus,
  type StyleProfile,
} from "../../lib/ipc";
import { ImportPgn } from "../library/ImportPgn";
import { StylePanel } from "../openings/StylePanel";
import { ImportPanel } from "../puzzles/ImportPanel";
import { AccountsSection } from "../settings/AccountsSection";

export const ONBOARDING_SETTING = "onboarding.done";

const STEPS = ["Your games", "How you train", "Your style", "Puzzles"] as const;

/** First run: games in, a mode and budget, the style quiz, and the puzzle import started. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [games, setGames] = useState(0);
  const [mode, setMode] = useState<"dedicated" | "casual">("dedicated");
  const [minutes, setMinutes] = useState(45);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [puzzles, setPuzzles] = useState<PuzzleImportStatus | null>(null);
  const [job, setJob] = useState<PuzzleImportState>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    ipc
      .listAccounts()
      .then(setAccounts)
      .catch(() => {});
    ipc
      .listGames({}, 1, 0)
      .then((p) => setGames(p.total))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    ipc
      .styleProfile()
      .then(setProfile)
      .catch(() => {});
    ipc
      .puzzleImportStatus()
      .then((s) => {
        setPuzzles(s);
        setJob(s.job);
      })
      .catch(() => {});
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    ipc
      .onPuzzleProgress((s) => {
        setJob(s);
        if (s.state !== "running")
          ipc
            .puzzleImportStatus()
            .then(setPuzzles)
            .catch(() => {});
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    const poll = window.setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      unlisten?.();
      window.clearInterval(poll);
    };
  }, [refresh]);

  const finish = () => {
    setError(null);
    ipc
      .setSetting(ONBOARDING_SETTING, "1")
      .then(onDone)
      .catch((e: unknown) => setError(String(e)));
  };

  const next = () => {
    setError(null);
    if (step === 1) {
      ipc
        .setScheduleSettings(mode, minutes)
        .then(() => setStep(2))
        .catch((e: unknown) => setError(String(e)));
      return;
    }
    if (step === STEPS.length - 1) {
      finish();
      return;
    }
    setStep(step + 1);
  };

  const startImport = (folder: string | null) => {
    setError(null);
    ipc
      .startPuzzleImport(folder)
      .then(() => ipc.puzzleImportStatus().then(setPuzzles))
      .catch((e: unknown) => setError(String(e)));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8" data-testid="onboarding">
      <div>
        <h1 className="text-2xl font-semibold">Welcome to Chess Coach</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Four short steps. Everything stays on this computer; you can change all of it later in
          Settings.
        </p>
      </div>
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Setup steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded px-2 py-1 ${
              i === step
                ? "bg-neutral-800 text-white"
                : i < step
                  ? "text-emerald-400"
                  : "text-neutral-500"
            }`}
            aria-current={i === step ? "step" : undefined}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {step === 0 && (
        <section className="space-y-4">
          <p className="text-sm text-neutral-300">
            Link your Lichess or Chess.com username and the app fetches your games (it keeps syncing
            in the background). No account? Paste or pick a PGN file instead.
          </p>
          <AccountsSection />
          <ImportPgn onImported={refresh} />
          <p className="text-sm text-neutral-400" data-testid="games-so-far">
            {accounts.length} account{accounts.length === 1 ? "" : "s"} linked · {games} game
            {games === 1 ? "" : "s"} in the library so far.
          </p>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                [
                  "dedicated",
                  "Dedicated",
                  "A daily plan with streaks and an elastic slot for your games.",
                ],
                ["casual", "Casual", "Pick 5, 15 or 30 minutes when you have them. No streaks."],
              ] as const
            ).map(([m, title, text]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`rounded border p-3 text-left ${mode === m ? "border-emerald-600" : "border-neutral-800"}`}
              >
                <div className="font-semibold">{title}</div>
                <div className="mt-1 text-sm text-neutral-400">{text}</div>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={minutes}
              aria-label="Daily minutes"
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-20 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-right"
            />
            minutes a day{mode === "casual" ? " (used as a ceiling for sessions)" : ""}
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3">
          <p className="text-sm text-neutral-300">
            Five questions on how you like to play. Your reviewed games will say their own word
            later; the openings recommended to you use both.
          </p>
          {profile ? (
            <StylePanel profile={profile} onChange={setProfile} />
          ) : (
            <p className="text-sm text-neutral-400">Loading…</p>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3">
          <p className="text-sm text-neutral-300">
            The puzzle trainer uses the Lichess puzzle database from the folder next to the app
            (about 1.6 million puzzles, 5–10 minutes to import). The import runs in the background;
            you can finish setup while it works.
          </p>
          {puzzles ? (
            <ImportPanel
              status={puzzles}
              job={job}
              onStart={startImport}
              onCancel={() => ipc.cancelPuzzleImport()}
            />
          ) : (
            <p className="text-sm text-neutral-400">Loading…</p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
        >
          {step === STEPS.length - 1 ? "Open the app" : "Continue"}
        </button>
        <button
          type="button"
          onClick={finish}
          className="ml-auto text-sm text-neutral-500 hover:text-neutral-300"
        >
          Skip setup
        </button>
      </div>
    </div>
  );
}
