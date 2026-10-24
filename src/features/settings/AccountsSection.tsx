import { useCallback, useEffect, useState } from "react";
import { ipc, type Account, type SyncStatus } from "../../lib/ipc";
import { ALIASES_SETTING, syncLabel } from "./syncLabel";

/** Linked Lichess and Chess.com accounts, sync, and the names the user plays under. */
export function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [status, setStatus] = useState<SyncStatus>({ state: "idle" });
  const [source, setSource] = useState("lichess");
  const [username, setUsername] = useState("");
  const [aliases, setAliases] = useState("");
  const [aliasesSaved, setAliasesSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    ipc
      .listAccounts()
      .then(setAccounts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    ipc
      .syncStatus()
      .then(setStatus)
      .catch(() => {});
    ipc
      .getSetting(ALIASES_SETTING)
      .then((v) => setAliases(v ?? ""))
      .catch(() => {});
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    ipc
      .onSyncEvent((s) => {
        setStatus(s);
        if (s.state === "done" || s.state === "failed") refresh();
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
  }, [refresh]);

  const add = () => {
    setError(null);
    ipc
      .addAccount(source, username)
      .then(() => {
        setUsername("");
        refresh();
      })
      .catch((e: unknown) => setError(String(e)));
  };

  const saveAliases = () => {
    ipc
      .setSetting(ALIASES_SETTING, aliases)
      .then(() => setAliasesSaved(true))
      .catch((e: unknown) => setError(String(e)));
  };

  const running = status.state === "running";
  const line = syncLabel(status, accounts);

  return (
    <section className="space-y-3" aria-label="Accounts">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Accounts</h2>
      {accounts.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Link your Lichess or Chess.com username to fetch your games.
        </p>
      ) : (
        <ul className="space-y-1 text-sm" aria-label="Linked accounts">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-neutral-400">
                {a.source === "lichess" ? "Lichess" : "Chess.com"}
              </span>
              <span className="font-medium">{a.username}</span>
              <span className="text-neutral-500">
                {a.games} game{a.games === 1 ? "" : "s"}
                {a.lastSyncedAt && `, synced ${a.lastSyncedAt.slice(0, 16).replace("T", " ")}`}
              </span>
              <button
                type="button"
                disabled={running}
                onClick={() => ipc.syncAccount(a.id).catch((e: unknown) => setError(String(e)))}
                className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
              >
                Sync
              </button>
              <button
                type="button"
                onClick={() =>
                  ipc
                    .removeAccount(a.id)
                    .then(refresh)
                    .catch((e: unknown) => setError(String(e)))
                }
                className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
                title="Unlink the account; its games stay"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Site"
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        >
          <option value="lichess">Lichess</option>
          <option value="chesscom">Chess.com</option>
        </select>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="username"
          aria-label="Username"
          className="w-48 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
        >
          Add and sync
        </button>
      </div>
      {line && (
        <p
          className={`text-sm ${status.state === "failed" ? "text-red-400" : "text-neutral-300"}`}
          data-testid="sync-status"
          aria-live="polite"
        >
          {line}
        </p>
      )}
      <label className="block text-sm">
        <span className="text-neutral-400">
          Other names you play under (for PGN files), comma-separated
        </span>
        <div className="mt-1 flex gap-2">
          <input
            value={aliases}
            onChange={(e) => {
              setAliases(e.target.value);
              setAliasesSaved(false);
            }}
            aria-label="Aliases"
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          />
          <button
            type="button"
            onClick={saveAliases}
            className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800"
          >
            {aliasesSaved ? "Saved" : "Save"}
          </button>
        </div>
      </label>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
