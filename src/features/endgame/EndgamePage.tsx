import { useCallback, useEffect, useState } from "react";
import { ipc, type EndgameCurriculum, type EndgameLesson } from "../../lib/ipc";
import { navigate, requestPuzzles, takeEndgameRequest } from "../../lib/navigation";
import { EndgameDrill } from "./EndgameDrill";

const PUZZLE_THEMES: [string, string][] = [
  ["pawnEndgame", "Pawn endgames"],
  ["rookEndgame", "Rook endgames"],
  ["bishopEndgame", "Bishop endgames"],
  ["knightEndgame", "Knight endgames"],
  ["queenEndgame", "Queen endgames"],
  ["zugzwang", "Zugzwang"],
];

const POSITION_PROGRESS_VERSION = 1;
const lessonFingerprint = (lesson: EndgameLesson) => {
  let hash = 2166136261;
  for (const char of lesson.positions.map((position) => position.fen).join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};
const positionProgressKey = (lesson: EndgameLesson) =>
  `chesscoach:endgame-progress:v${POSITION_PROGRESS_VERSION}:${lesson.id}:${lessonFingerprint(lesson)}`;
const readPositionProgress = (lesson: EndgameLesson): boolean[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(positionProgressKey(lesson)) ?? "null");
    return Array.from(
      { length: lesson.positions.length },
      (_, index) => Array.isArray(value) && value[index] === true,
    );
  } catch {
    return Array.from({ length: lesson.positions.length }, () => false);
  }
};

/** The Endgame Academy v1: curriculum map, lesson, drill. */
export function EndgamePage() {
  const [request] = useState(() => takeEndgameRequest());
  const [curriculum, setCurriculum] = useState<EndgameCurriculum | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(request?.lessonId ?? null);
  const [drill, setDrill] = useState<number | null>(null);
  const [passedByLesson, setPassedByLesson] = useState<Record<string, boolean[]>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    ipc
      .endgameCurriculum()
      .then(setCurriculum)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(load, [load]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!curriculum) return <p className="text-sm text-neutral-400">Loading…</p>;
  const lesson: EndgameLesson | undefined = curriculum.units
    .flatMap((u) => u.lessons)
    .find((l) => l.id === lessonId);
  const passedPositions = lesson ? (passedByLesson[lesson.id] ?? readPositionProgress(lesson)) : [];
  const progressOf = (id: string) => curriculum.progress.find((p) => p.lessonId === id);

  const onResult = (success: boolean, index: number) => {
    if (!lesson) return;
    const nextPassed = passedPositions.map((passed, position) =>
      position === index ? success : passed,
    );
    setPassedByLesson((current) => ({ ...current, [lesson.id]: nextPassed }));
    const complete = nextPassed.length === lesson.positions.length && nextPassed.every(Boolean);
    let backendSaved = false;
    const record = () => {
      setSaving(true);
      setSaveError(null);
      Promise.resolve()
        .then(async () => {
          localStorage.setItem(positionProgressKey(lesson), JSON.stringify(nextPassed));
          if ((!success || complete) && !backendSaved) {
            const p = await ipc.endgameAttempt(lesson.id, complete);
            backendSaved = true;
            setCurriculum((c) => (c ? { ...c, progress: p } : c));
          }
          if (complete && request?.taskId !== undefined) {
            await ipc.finishTask(request.taskId);
            navigate("today");
          }
          setSaveError(null);
          setPendingSave(null);
        })
        .catch((e: unknown) => {
          setSaveError(`Progress could not be fully saved: ${String(e)}`);
          setPendingSave(() => record);
        })
        .finally(() => setSaving(false));
    };
    record();
  };

  if (lesson && drill !== null && lesson.positions[drill]) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setDrill(null)}
            className="rounded border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800"
          >
            ← {lesson.title}
          </button>
          <span className="text-sm text-neutral-400">
            Drill {drill + 1} of {lesson.positions.length}
          </span>
        </div>
        <EndgameDrill
          key={`${lesson.id}-${drill}`}
          lessonId={lesson.id}
          index={drill}
          position={lesson.positions[drill]}
          onResult={(success) => onResult(success, drill)}
          saveError={saveError}
          saving={saving}
          onRetrySave={pendingSave ?? undefined}
          onNext={
            drill + 1 < lesson.positions.length ? () => setDrill(drill + 1) : () => setDrill(null)
          }
        />
      </div>
    );
  }

  if (lesson) {
    const p = progressOf(lesson.id);
    return (
      <div className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setLessonId(null)}
            className="rounded border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800"
          >
            ← Curriculum
          </button>
          <h1 className="text-lg font-semibold">{lesson.title}</h1>
          {p && (
            <span className="text-sm text-neutral-400" data-testid="lesson-progress">
              {p.status === "done" ? "Done" : "Started"} · {p.successes} of {p.attempts} attempts
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-neutral-200" data-testid="lesson-concept">
          {lesson.concept}
        </p>
        <ol className="space-y-2" aria-label="Drills">
          {lesson.positions.map((pos, i) => (
            <li
              key={pos.fen}
              className="flex flex-wrap items-center gap-3 rounded border border-neutral-800 p-3"
            >
              <span className="text-sm">
                <span className="font-semibold">
                  {pos.side === "white" ? "White" : "Black"} to{" "}
                  {pos.goal === "win" ? "win" : "hold the draw"}
                </span>
                <span className="ml-2 text-neutral-400">{pos.note}</span>
              </span>
              <button
                type="button"
                onClick={() => setDrill(i)}
                className="ml-auto rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
              >
                Start drill
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const done = curriculum.progress.filter((p) => p.status === "done").length;
  const total = curriculum.units.reduce((n, u) => n + u.lessons.length, 0);
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Endgame</h1>
        <span className="text-sm text-neutral-400" data-testid="curriculum-progress">
          {done} of {total} lessons done
        </span>
      </div>
      {curriculum.units.map((u) => (
        <section key={u.id} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Unit {u.id} · {u.title}
          </h2>
          <ul className="space-y-1.5" aria-label={`Unit ${u.id}`}>
            {u.lessons.map((l) => {
              const p = progressOf(l.id);
              return (
                <li
                  key={l.id}
                  className="flex items-center gap-3 rounded border border-neutral-800 px-3 py-2 text-sm"
                >
                  <span className={p?.status === "done" ? "text-emerald-400" : "text-neutral-500"}>
                    {p?.status === "done" ? "✓" : "○"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLessonId(l.id)}
                    className="text-left hover:text-white"
                  >
                    {l.title}
                  </button>
                  <span className="ml-auto text-xs text-neutral-500">
                    {l.positions.length} drill{l.positions.length === 1 ? "" : "s"}
                    {p && p.status !== "done" ? ` · ${p.attempts} tried` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Practical endgame puzzles
        </h2>
        <div className="flex flex-wrap gap-2">
          {PUZZLE_THEMES.map(([theme, label]) => (
            <button
              key={theme}
              type="button"
              onClick={() => requestPuzzles(theme)}
              className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
