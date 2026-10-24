import { useState } from "react";
import { ipc, type PgnImportSummary } from "../../lib/ipc";
import { importSummaryText } from "./importSummary";

interface ImportPgnProps {
  onImported: (summary: PgnImportSummary) => void;
}

/** Paste PGN text or choose .pgn files; one or many games per import. */
export function ImportPgn({ onImported }: ImportPgnProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const submit = (pgn: string) => {
    if (!pgn.trim()) return;
    setBusy(true);
    setMessage(null);
    ipc
      .importPgnText(pgn)
      .then((s) => {
        setMessage(importSummaryText(s));
        setProblems(s.rejected);
        setText("");
        onImported(s);
      })
      .catch((e: unknown) => setMessage(String(e)))
      .finally(() => setBusy(false));
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const texts = await Promise.all([...files].map((f) => f.text()));
    submit(texts.join("\n\n"));
  };

  return (
    <section className="space-y-2" aria-label="Import PGN">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Import PGN</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste one or more games in PGN…"
        aria-label="PGN text"
        rows={4}
        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => submit(text)}
          className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600 disabled:opacity-50"
        >
          Import text
        </button>
        <label className="cursor-pointer rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800">
          Choose .pgn files
          <input
            type="file"
            accept=".pgn,text/plain"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            aria-label="PGN files"
            className="hidden"
          />
        </label>
      </div>
      {message && (
        <p className="text-sm text-neutral-300" data-testid="import-message">
          {message}
        </p>
      )}
      {problems.length > 0 && (
        <ul className="text-xs text-amber-400">
          {problems.slice(0, 10).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
