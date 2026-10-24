import { useState } from "react";
import { ipc, type StyleProfile, type StyleScores } from "../../lib/ipc";

const LABELS: Record<StyleScores["label"], string> = {
  aggressive: "Aggressive",
  tactical: "Tactical",
  defensive: "Defensive / solid",
  mixed: "Mixed / universal",
};

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-neutral-400">{label}</span>
      <div className="h-2 w-40 overflow-hidden rounded bg-neutral-800">
        <div className="h-full bg-emerald-600" style={{ width: `${Math.round(value)}%` }} />
      </div>
      <span className="text-neutral-400">{Math.round(value)}</span>
    </div>
  );
}

function Scores({
  title,
  scores,
  empty,
}: {
  title: string;
  scores: StyleScores | null;
  empty: string;
}) {
  return (
    <div className="rounded border border-neutral-800 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</div>
      {scores ? (
        <>
          <div className="mt-1 font-semibold">
            {LABELS[scores.label]}
            {scores.games > 0 && (
              <span className="ml-2 text-xs font-normal text-neutral-500">
                {scores.games} games
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1">
            <Bar label="Sharpness" value={scores.sharpness} />
            <Bar label="Initiative" value={scores.initiative} />
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-neutral-400">{empty}</p>
      )}
    </div>
  );
}

/** "Your games say" and "you said", the quiz, and which one to optimise for. */
export function StylePanel({
  profile,
  onChange,
}: {
  profile: StyleProfile;
  onChange: (p: StyleProfile) => void;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => profile.answers ?? profile.quiz.map(() => null),
  );
  const [quizOpen, setQuizOpen] = useState(profile.answers === null);
  const complete = answers.every((a) => a !== null);

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Your style</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Scores
          title="Your games say"
          scores={profile.fromGames}
          empty="Needs at least five reviewed games. Review some games on Today or Insights."
        />
        <Scores
          title="You said"
          scores={profile.fromQuiz}
          empty="Answer the five questions below."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-neutral-400">Recommend openings for</span>
        <div
          className="flex rounded border border-neutral-700"
          role="group"
          aria-label="Style source"
        >
          {(["games", "quiz"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={profile.source === s}
              onClick={() =>
                ipc
                  .setStyleSource(s)
                  .then(onChange)
                  .catch(() => {})
              }
              className={`px-3 py-1 ${profile.source === s ? "bg-neutral-800 text-white" : "text-neutral-400"}`}
            >
              {s === "games" ? "how I play" : "how I see myself"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setQuizOpen((o) => !o)}
          className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
        >
          {quizOpen ? "Hide the quiz" : profile.answers ? "Retake the quiz" : "Take the quiz"}
        </button>
      </div>
      {quizOpen && (
        <form
          className="space-y-3 rounded border border-neutral-800 p-3"
          aria-label="Style quiz"
          onSubmit={(e) => {
            e.preventDefault();
            if (!complete) return;
            ipc
              .saveStyleQuiz(answers as number[])
              .then((p) => {
                onChange(p);
                setQuizOpen(false);
              })
              .catch(() => {});
          }}
        >
          {profile.quiz.map((q, qi) => (
            <fieldset key={q.id} className="space-y-1">
              <legend className="text-sm font-semibold">
                {qi + 1}. {q.text}
              </legend>
              {q.options.map((o, oi) => (
                <label key={o.text} className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[qi] === oi}
                    onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                  />
                  {o.text}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            type="submit"
            disabled={!complete}
            className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            Save my answers
          </button>
        </form>
      )}
    </section>
  );
}
