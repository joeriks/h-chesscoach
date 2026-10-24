import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "chessground/types";
import { makeFen } from "chessops/fen";
import { Board } from "../../components/board/Board";
import { INITIAL_FEN, formatScore, replay } from "../../lib/chess";
import {
  ipc,
  type EngineEvent,
  type ExplorerPlan,
  type ExplorerResult,
  type Score,
} from "../../lib/ipc";
import { navigate } from "../../lib/navigation";
import { BOARD_SIZE } from "../puzzles/PuzzleSolver";
import { useDrillBoard } from "./useDrillBoard";
import { ModelGameViewer } from "./ModelGames";

const TC: [number, string][] = [
  [0, "Blitz"],
  [1, "Rapid"],
  [2, "Classical"],
];

/** The Master Explorer: a free board with what elite players played at each position. */
export function ExplorerTab({
  available,
  initialFen,
}: {
  available: boolean;
  /** Start the exploration at this position instead of the initial one. */
  initialFen?: string;
}) {
  const startFen = initialFen ?? INITIAL_FEN;
  const [line, setLine] = useState<string[]>([]);
  const [tc, setTc] = useState<number[]>([]);
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [trend, setTrend] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [evals, setEvals] = useState<Map<string, Score>>(new Map());
  const [result, setResult] = useState<ExplorerResult | null>(null);
  const [plans, setPlans] = useState<ExplorerPlan[]>([]);
  const [gameId, setGameId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const played = useMemo(() => replay(startFen, line), [startFen, line]);
  const fen = useMemo(() => makeFen(played.pos.toSetup()), [played]);
  const board = useDrillBoard(fen);

  useEffect(() => {
    if (!available) return;
    ipc
      .explorerQuery(fen, tc, fromYear ? `${fromYear}-01` : null, toYear ? `${toYear}-12` : null)
      .then((r) => {
        setResult(r);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    ipc
      .explorerPlans(fen)
      .then(setPlans)
      .catch(() => setPlans([]));
  }, [available, fen, tc, fromYear, toYear]);

  // The engine column: the interactive engine on the current position, MultiPV 5.
  const ticket = useRef(0);
  useEffect(() => {
    if (!engineOn) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const id = ++ticket.current;
    ipc
      .onEngineEvent((e: EngineEvent) => {
        if (e.type !== "update" || e.id !== id) return;
        setEvals(
          new Map(e.lines.flatMap((l) => (l.pv[0] ? [[l.pv[0], l.score] as [string, Score]] : []))),
        );
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    ipc.analyzePosition(id, startFen, line, 5).catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
      ipc.stopAnalysis().catch(() => {});
    };
  }, [engineOn, startFen, line]);

  const play = useCallback((uci: string) => setLine((l) => [...l, uci]), []);
  const onMove = (orig: Key, dest: Key): boolean => {
    const uci = board.uciFor(orig, dest);
    if (!uci) return false;
    play(uci);
    return true;
  };

  if (!available) {
    return (
      <div className="max-w-2xl space-y-3 rounded border border-neutral-800 p-4">
        <h2 className="font-semibold">Master games are not installed</h2>
        <p className="text-sm text-neutral-400">
          The Master Explorer shows what strong players chose in every opening position, with their
          results and typical plans, and gives each lesson model games. It needs the optional
          Lichess Elite Database (a few GB of PGN, imported once).
        </p>
        <button
          type="button"
          onClick={() => navigate("settings")}
          className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600"
        >
          Add master games
        </button>
      </div>
    );
  }

  if (gameId !== null) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setGameId(null)}
          className="rounded border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800"
        >
          ← Explorer
        </button>
        <ModelGameViewer gameId={gameId} startPly={initialFen ? 0 : line.length} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-6">
      <div className="flex flex-col gap-3">
        <nav className="flex flex-wrap gap-x-1 text-sm" aria-label="Line">
          <button
            type="button"
            onClick={() => setLine([])}
            className="rounded px-1 text-neutral-400 hover:bg-neutral-800"
          >
            Start
          </button>
          {played.sans.map((san, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLine(line.slice(0, i + 1))}
              className="rounded px-1 hover:bg-neutral-800"
            >
              {i % 2 === 0 ? `${i / 2 + 1}. ` : ""}
              {san}
            </button>
          ))}
        </nav>
        <div style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
          <Board
            fen={board.fen}
            orientation="white"
            turnColor={board.turn}
            dests={board.dests}
            lastMove={played.lastMove}
            check={board.check}
            onMove={onMove}
            revision={board.revision}
          />
        </div>
        <p className="text-xs text-neutral-500">
          Games compiled by nikonoel from Lichess (public domain). Click a move in the table or play
          on the board.
        </p>
      </div>
      <aside className="flex w-[26rem] min-w-0 flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          {TC.map(([v, label]) => (
            <label key={v} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={tc.length === 0 || tc.includes(v)}
                onChange={(e) => {
                  const all = TC.map(([x]) => x);
                  const current = tc.length === 0 ? all : tc;
                  const next = e.target.checked ? [...current, v] : current.filter((x) => x !== v);
                  setTc(next.length === all.length ? [] : next);
                }}
              />
              {label}
            </label>
          ))}
          <input
            value={fromYear}
            onChange={(e) => setFromYear(e.target.value)}
            placeholder="from"
            aria-label="From year"
            className="w-16 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
          />
          <input
            value={toYear}
            onChange={(e) => setToYear(e.target.value)}
            placeholder="to"
            aria-label="To year"
            className="w-16 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
          />
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={trend} onChange={(e) => setTrend(e.target.checked)} />{" "}
            Trend
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={engineOn}
              onChange={(e) => setEngineOn(e.target.checked)}
            />{" "}
            Engine
          </label>
        </div>
        {error && <p className="text-red-400">{error}</p>}
        {result && (
          <>
            <p className="text-neutral-400" data-testid="explorer-total">
              {result.total.toLocaleString()} master games here
              {result.newestMonth ? ` · data to ${result.newestMonth}` : ""}
            </p>
            <table className="w-full" aria-label="Master moves">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th>Move</th>
                  <th>Games</th>
                  <th>W / D / B</th>
                  <th>Score</th>
                  <th>Elo</th>
                  <th>Last</th>
                  {trend && <th>Trend</th>}
                  {engineOn && <th>Eval</th>}
                </tr>
              </thead>
              <tbody>
                {result.moves.map((m) => {
                  const w = (100 * m.whiteWins) / m.games;
                  const d = (100 * m.draws) / m.games;
                  const ev = engineOn ? evals.get(m.uci) : undefined;
                  return (
                    <tr key={m.uci} className="border-t border-neutral-800">
                      <td>
                        <button
                          type="button"
                          onClick={() => play(m.uci)}
                          className="rounded px-1 font-semibold hover:bg-neutral-800"
                        >
                          {m.san}
                        </button>
                      </td>
                      <td>
                        {m.games.toLocaleString()}{" "}
                        <span className="text-neutral-500">({Math.round(m.share)}%)</span>
                      </td>
                      <td>
                        <div
                          className="flex h-3 w-24 overflow-hidden rounded bg-neutral-800"
                          title={`${m.whiteWins} / ${m.draws} / ${m.blackWins}`}
                        >
                          <div className="bg-neutral-200" style={{ width: `${w}%` }} />
                          <div className="bg-neutral-500" style={{ width: `${d}%` }} />
                        </div>
                      </td>
                      <td>{Math.round(m.score)}%</td>
                      <td className="text-neutral-400">{Math.round(m.avgElo)}</td>
                      <td className="text-neutral-400">{m.lastMonth.slice(0, 4)}</td>
                      {trend && (
                        <td
                          className={
                            m.recentShare !== null &&
                            m.olderShare !== null &&
                            m.recentShare < 0.5 * m.olderShare
                              ? "text-amber-300"
                              : "text-neutral-400"
                          }
                        >
                          {m.recentShare === null || m.olderShare === null
                            ? "–"
                            : `${Math.round(m.olderShare)}% → ${Math.round(m.recentShare)}%`}
                        </td>
                      )}
                      {engineOn && (
                        <td className="font-mono text-xs">{ev ? formatScore(ev) : ""}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {plans.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Common plans
                </h3>
                <ul className="space-y-1" aria-label="Common plans">
                  {plans.map((p) => (
                    <li key={`${p.side}-${p.feature}`} className="text-neutral-200">
                      {p.sentence}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {result.topGames.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Top games
                </h3>
                <ul className="space-y-0.5" aria-label="Top games">
                  {result.topGames.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => setGameId(g.id)}
                        className="text-left hover:text-white"
                      >
                        {g.white} ({g.whiteElo ?? "?"}) – {g.black} ({g.blackElo ?? "?"}) {g.result}
                        <span className="ml-1 text-neutral-500">{g.playedOn?.slice(0, 4)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
