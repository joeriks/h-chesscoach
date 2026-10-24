import { useEffect, useMemo, useState } from "react";
import type { Key } from "chessground/types";
import { makeFen } from "chessops/fen";
import { Board } from "../../components/board/Board";
import { INITIAL_FEN, replay } from "../../lib/chess";
import { ipc, type EliteTopGame, type ModelGame } from "../../lib/ipc";
import { BOARD_SIZE } from "../puzzles/PuzzleSolver";
import { useDrillBoard } from "./useDrillBoard";

/** The model games cached for a line, with Replay and Guess-the-move modes. */
export function ModelGames({
  lineKey,
  userColor,
}: {
  lineKey: string;
  userColor: "white" | "black";
}) {
  const [games, setGames] = useState<ModelGame[] | null>(null);
  // The open game is kept per line, so switching lines closes it.
  const [opened, setOpened] = useState<{ key: string; rank: number } | null>(null);
  const open = opened?.key === lineKey ? opened.rank : null;
  const setOpen = (rank: number | null) => setOpened(rank === null ? null : { key: lineKey, rank });
  useEffect(() => {
    ipc
      .modelGames(lineKey)
      .then(setGames)
      .catch(() => setGames([]));
  }, [lineKey]);
  if (!games || games.length === 0) return null;
  const current = open === null ? null : games.find((g) => g.rank === open);
  return (
    <section className="space-y-2" data-testid="model-games">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Model games
      </h3>
      <ul className="space-y-1 text-sm" aria-label="Model games">
        {games.map((g) => (
          <li key={g.rank} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(open === g.rank ? null : g.rank)}
              className="text-left hover:text-white"
            >
              Model game {g.rank} of {games.length}: {g.game.white} ({g.game.whiteElo ?? "?"}) –{" "}
              {g.game.black} ({g.game.blackElo ?? "?"}), Lichess{" "}
              {g.game.playedOn?.slice(0, 4) ?? "?"} · {g.game.result}
            </button>
            <span className="text-xs text-neutral-500">{g.reason}</span>
          </li>
        ))}
      </ul>
      {current && (
        <ModelGameViewer
          key={current.rank}
          game={current.game}
          moves={current.moves}
          notes={current.annotations.notes}
          winWhite={current.annotations.winWhite}
          bestUci={current.annotations.bestUci}
          startPly={current.linePly}
          userColor={userColor}
        />
      )}
    </section>
  );
}

/** Replay (step through with notes) or Guess the move (predict the master's move). */
export function ModelGameViewer(props: {
  gameId?: number;
  game?: EliteTopGame;
  moves?: string[];
  notes?: { ply: number; text: string }[];
  winWhite?: number[];
  bestUci?: (string | null)[];
  startPly?: number;
  userColor?: "white" | "black";
}) {
  const [loaded, setLoaded] = useState<{ game: EliteTopGame; moves: string[] } | null>(
    props.game && props.moves ? { game: props.game, moves: props.moves } : null,
  );
  useEffect(() => {
    if (props.gameId === undefined) return;
    ipc
      .eliteGame(props.gameId)
      .then((g) => setLoaded(g))
      .catch(() => setLoaded(null));
  }, [props.gameId]);
  const [ply, setPly] = useState(props.startPly ?? 0);
  const [mode, setMode] = useState<"replay" | "guess">("replay");
  const [guessScore, setGuessScore] = useState({ exact: 0, engine: 0, tries: 0 });
  const [feedback, setFeedback] = useState<string | null>(null);

  const moves = useMemo(() => loaded?.moves ?? [], [loaded]);
  const shown = useMemo(() => replay(INITIAL_FEN, moves.slice(0, ply)), [moves, ply]);
  const fen = useMemo(() => makeFen(shown.pos.toSetup()), [shown]);
  const board = useDrillBoard(fen);
  const userColor = props.userColor ?? "white";
  const userToMove = (ply % 2 === 0) === (userColor === "white");
  const guessing = mode === "guess" && userToMove && ply < moves.length;
  const note = props.notes?.find((n) => n.ply === ply)?.text ?? null;

  if (!loaded) return <p className="text-sm text-neutral-400">Loading the game…</p>;

  const onMove = (orig: Key, dest: Key): boolean => {
    if (!guessing) return false;
    const uci = board.uciFor(orig, dest);
    if (!uci) return false;
    const actual = moves[ply]!;
    const engineBest = props.bestUci?.[ply] ?? null;
    const exact = uci === actual;
    const engine = engineBest !== null && uci === engineBest;
    setGuessScore((s) => ({
      exact: s.exact + (exact ? 1 : 0),
      engine: s.engine + (engine ? 1 : 0),
      tries: s.tries + 1,
    }));
    const actualSan = replay(fen, [actual]).sans[0] ?? actual;
    setFeedback(
      exact
        ? `${actualSan}: exactly the master's move.`
        : engine
          ? `The master played ${actualSan}; your move was the engine's first choice, which also counts.`
          : `The master played ${actualSan}.`,
    );
    setPly((p) => Math.min(moves.length, p + 1));
    return exact;
  };

  return (
    <div className="flex flex-wrap gap-6" data-testid="model-game-viewer">
      <div className="flex flex-col gap-3">
        <div style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
          <Board
            fen={board.fen}
            orientation={userColor}
            turnColor={board.turn}
            dests={guessing ? board.dests : new Map()}
            lastMove={shown.lastMove}
            check={board.check}
            onMove={onMove}
            revision={board.revision}
          />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPly(0)}
            className="rounded border border-neutral-700 px-2 py-1"
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => setPly((p) => Math.max(0, p - 1))}
            className="rounded border border-neutral-700 px-2 py-1"
            aria-label="Previous move"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => setPly((p) => Math.min(moves.length, p + 1))}
            className="rounded bg-emerald-700 px-3 py-1 font-medium hover:bg-emerald-600"
            aria-label="Next move"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => setPly(moves.length)}
            className="rounded border border-neutral-700 px-2 py-1"
          >
            End
          </button>
          <div
            className="ml-2 flex rounded border border-neutral-700"
            role="group"
            aria-label="Mode"
          >
            {(["replay", "guess"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setFeedback(null);
                }}
                className={`px-2 py-1 ${mode === m ? "bg-neutral-800 text-white" : "text-neutral-400"}`}
              >
                {m === "replay" ? "Replay" : "Guess the move"}
              </button>
            ))}
          </div>
        </div>
        <p className="min-h-6 max-w-xl text-sm text-emerald-200" data-testid="model-note">
          {feedback ?? note ?? (guessing ? "Your move: what did the master play here?" : "")}
        </p>
        {mode === "guess" && guessScore.tries > 0 && (
          <p className="text-xs text-neutral-400">
            {guessScore.exact} of {guessScore.tries} exact, {guessScore.engine} matched the engine's
            choice.
          </p>
        )}
      </div>
      <aside className="w-72 text-sm">
        <p className="font-semibold">
          {loaded.game.white} ({loaded.game.whiteElo ?? "?"}) – {loaded.game.black} (
          {loaded.game.blackElo ?? "?"})
        </p>
        <p className="text-neutral-400">
          {loaded.game.result} · {loaded.game.playedOn ?? "?"} · {loaded.game.opening ?? ""}
        </p>
        {props.winWhite && props.winWhite.length > 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            Engine view after move {Math.ceil(ply / 2)}:{" "}
            {ply > 0 ? `${Math.round(props.winWhite[ply - 1] ?? 50)}% for White` : "even"}
          </p>
        )}
        <ol className="mt-2 flex flex-wrap gap-x-1 gap-y-0.5" aria-label="Game moves">
          {shown.sans.map((san, i) => (
            <li key={i}>
              {i % 2 === 0 && <span className="text-neutral-500">{i / 2 + 1}. </span>}
              <button
                type="button"
                onClick={() => setPly(i + 1)}
                className={`rounded px-1 ${ply === i + 1 ? "bg-neutral-800 text-white" : props.notes?.some((n) => n.ply === i + 1) ? "text-emerald-300" : ""} hover:bg-neutral-800`}
              >
                {san}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
