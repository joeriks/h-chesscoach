import { useCallback, useEffect, useState } from "react";
import { ipc, type GameFilter, type GameSummary } from "../../lib/ipc";
import { describeGame, outcomeFor, sourceLabel } from "./gamesText";
import { ImportPgn } from "./ImportPgn";

const PAGE = 50;

const TIME_CLASSES = ["ultrabullet", "bullet", "blitz", "rapid", "classical", "correspondence"];

interface GamesLibraryProps {
  onOpen: (game: GameSummary) => void;
  /** Bumped by the parent when games changed elsewhere (a sync finished). */
  refreshKey?: number;
}

export function GamesLibrary({ onOpen, refreshKey = 0 }: GamesLibraryProps) {
  const [filter, setFilter] = useState<GameFilter>({});
  const [games, setGames] = useState<GameSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = useCallback(
    (offset: number) => {
      ipc
        .listGames(filter, PAGE, offset)
        .then((page) => {
          setTotal(page.total);
          setGames((prev) => (offset === 0 ? page.games : [...prev, ...page.games]));
        })
        .catch((e: unknown) => setError(String(e)));
    },
    [filter],
  );

  useEffect(() => {
    load(0);
  }, [load, refreshKey]);

  const set = (patch: Partial<GameFilter>) => setFilter((f) => ({ ...f, ...patch }));

  const assign = (game: GameSummary, color: "w" | "b") => {
    ipc
      .setGameUserColor(game.id, color, true)
      .then(() => load(0))
      .catch((e: unknown) => setError(String(e)));
  };

  const remove = (id: number) => {
    ipc
      .deleteGame(id)
      .then(() => {
        setConfirmDelete(null);
        load(0);
      })
      .catch((e: unknown) => setError(String(e)));
  };

  return (
    <div className="flex flex-wrap gap-6">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={filter.source ?? ""}
            onChange={(e) => set({ source: e.target.value || null })}
            aria-label="Source"
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          >
            <option value="">All sources</option>
            <option value="lichess">Lichess</option>
            <option value="chesscom">Chess.com</option>
            <option value="manual">PGN</option>
          </select>
          <select
            value={filter.timeClass ?? ""}
            onChange={(e) => set({ timeClass: e.target.value || null })}
            aria-label="Time class"
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          >
            <option value="">Any speed</option>
            {TIME_CLASSES.map((t) => (
              <option key={t} value={t}>
                {t[0]!.toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={filter.outcome ?? ""}
            onChange={(e) => set({ outcome: e.target.value || null })}
            aria-label="Outcome"
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          >
            <option value="">Any result</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="draw">Draws</option>
          </select>
          <select
            value={filter.userColor ?? ""}
            onChange={(e) => set({ userColor: e.target.value || null })}
            aria-label="Colour"
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          >
            <option value="">Either colour</option>
            <option value="w">As White</option>
            <option value="b">As Black</option>
          </select>
          <input
            value={filter.player ?? ""}
            onChange={(e) => set({ player: e.target.value || null })}
            placeholder="Opponent"
            aria-label="Player"
            className="w-36 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          />
          <span className="text-neutral-500" data-testid="games-total">
            {total === null ? "" : `${total.toLocaleString()} game${total === 1 ? "" : "s"}`}
          </span>
        </div>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {total === 0 && (
          <p className="text-sm text-neutral-400">
            No games yet. Link an account in Settings or import a PGN file.
          </p>
        )}
        <ul className="divide-y divide-neutral-800" aria-label="Games">
          {games.map((g) => {
            const o = outcomeFor(g);
            return (
              <li key={g.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span
                  className={`w-6 shrink-0 text-center font-semibold ${
                    o.tone === "win"
                      ? "text-emerald-400"
                      : o.tone === "loss"
                        ? "text-red-400"
                        : "text-neutral-400"
                  }`}
                >
                  {o.label}
                </span>
                <button
                  type="button"
                  onClick={() => onOpen(g)}
                  className="min-w-0 flex-1 truncate text-left hover:text-white"
                  title="Open on the analysis board"
                >
                  {describeGame(g)}
                  <span className="ml-2 text-neutral-500">
                    {g.timeClass} {g.timeControl !== "-" && g.timeControl} · {sourceLabel(g.source)}
                    {g.openingName && ` · ${g.openingName}`}
                  </span>
                </button>
                {!g.userColor && g.result !== "*" && (
                  <span className="flex shrink-0 gap-1 text-xs" aria-label="Which side were you?">
                    <button
                      type="button"
                      onClick={() => assign(g, "w")}
                      className="rounded border border-neutral-700 px-1.5 py-0.5 hover:bg-neutral-800"
                    >
                      I was White
                    </button>
                    <button
                      type="button"
                      onClick={() => assign(g, "b")}
                      className="rounded border border-neutral-700 px-1.5 py-0.5 hover:bg-neutral-800"
                    >
                      I was Black
                    </button>
                  </span>
                )}
                {confirmDelete === g.id ? (
                  <button
                    type="button"
                    onClick={() => remove(g.id)}
                    className="shrink-0 rounded bg-red-800 px-1.5 py-0.5 text-xs"
                  >
                    Confirm delete
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(g.id)}
                    className="shrink-0 px-1 text-xs text-neutral-600 hover:text-red-400"
                    title="Delete this game"
                    aria-label={`Delete game ${g.id}`}
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {total !== null && games.length < total && (
          <button
            type="button"
            onClick={() => load(games.length)}
            className="rounded border border-neutral-700 px-2.5 py-1 text-sm hover:bg-neutral-800"
          >
            Show more ({total - games.length} left)
          </button>
        )}
      </div>
      <aside className="w-80 shrink-0">
        <ImportPgn onImported={() => load(0)} />
      </aside>
    </div>
  );
}
