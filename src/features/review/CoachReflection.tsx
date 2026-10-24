import { useState } from "react";

interface Reflection {
  threat: string;
  candidates: string;
  reply: string;
  takeaway: string;
}
const EMPTY: Reflection = { threat: "", candidates: "", reply: "", takeaway: "" };

/** Position-specific notes; completing a reflection is not scored as chess mastery. */
export function CoachReflection({
  gameId,
  fen,
  revealed,
  onReveal,
}: {
  gameId: number;
  fen: string;
  revealed: boolean;
  onReveal: () => void;
}) {
  const key = `chesscoach.reflection.v1:${gameId}:${fen}`;
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { note: EMPTY, error: null };
      const parsed: unknown = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Object.keys(EMPTY).every((k) => typeof (parsed as Record<string, unknown>)[k] === "string")
      ) {
        throw new Error("Invalid notes");
      }
      return { note: parsed as Reflection, error: null };
    } catch {
      return { note: EMPTY, error: "Saved notes could not be read. They have not been replaced." };
    }
  });
  const [note, setNote] = useState(initial.note);
  const [error, setError] = useState<string | null>(initial.error);
  const [saved, setSaved] = useState(false);
  const save = () => {
    if (initial.error) return false;
    try {
      localStorage.setItem(key, JSON.stringify(note));
      setSaved(true);
      setError(null);
      return true;
    } catch {
      setError("Your notes could not be saved. Keep this screen open and try again.");
      return false;
    }
  };
  const ready = [note.threat, note.candidates, note.reply].every((s) => s.trim().length > 0);
  const field = (name: keyof Reflection, label: string) => (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <textarea
        aria-label={label}
        value={note[name]}
        rows={2}
        maxLength={2000}
        onChange={(e) => {
          setNote({ ...note, [name]: e.target.value });
          setSaved(false);
        }}
        className="w-full rounded border border-neutral-700 bg-neutral-950 p-2"
      />
    </label>
  );
  return (
    <section
      className="space-y-3 rounded border border-emerald-900 p-3"
      aria-label="Think before checking"
    >
      <h2 className="font-semibold">Think before checking</h2>
      <p className="text-sm text-neutral-400">
        Evaluate for the side to move. Look for checks, captures and threats for both sides, then
        compare two candidate moves.
      </p>
      {field("threat", "What is the opponent threatening?")}
      {field("candidates", "Your candidate moves and chosen plan")}
      {field("reply", "The strongest reply you expect")}
      {!revealed ? (
        <>
          <button
            type="button"
            disabled={!ready || !!initial.error}
            onClick={() => {
              if (save()) onReveal();
            }}
            className="rounded bg-emerald-700 px-3 py-1 text-sm disabled:opacity-40"
          >
            Save and compare with engine
          </button>
          <button
            type="button"
            onClick={onReveal}
            className="block text-xs text-neutral-400 underline"
          >
            Explore with engine without recording a reflection
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-400">
            Compare the engine line with your prediction. Was the issue an unseen threat, a
            calculation error, or the plan? A different move is not automatically a mistake.
          </p>
          {field("takeaway", "One decision rule to try in your next game")}
          <button
            type="button"
            onClick={save}
            disabled={!!initial.error}
            className="rounded bg-emerald-700 px-3 py-1 text-sm disabled:opacity-40"
          >
            Save reflection
          </button>
        </>
      )}
      {saved && (
        <p role="status" className="text-xs text-emerald-300">
          Notes saved on this device. Reflection is not a scored test.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
