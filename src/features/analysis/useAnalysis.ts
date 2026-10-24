import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { INITIAL_FEN, parseFenSafe, replay } from "../../lib/chess";
import { ipc, type AnalysisUpdate } from "../../lib/ipc";

export const MULTIPV = 3;

interface LineState {
  rootFen: string;
  /** Moves from the root in standard UCI. Playing a move before the end replaces the rest. */
  moves: string[];
  /** How many of `moves` are on the board. */
  ply: number;
}

type Action =
  { type: "setFen"; fen: string } | { type: "play"; uci: string } | { type: "goto"; ply: number };

function reducer(state: LineState, action: Action): LineState {
  switch (action.type) {
    case "setFen":
      return { rootFen: action.fen, moves: [], ply: 0 };
    case "play": {
      const moves = [...state.moves.slice(0, state.ply), action.uci];
      return { ...state, moves, ply: moves.length };
    }
    case "goto":
      return { ...state, ply: Math.max(0, Math.min(action.ply, state.moves.length)) };
  }
}

/**
 * Board state plus the live interactive engine for the current position. `initialMoves`
 * (standard UCI from `initialFen`) loads a game; re-mount with a new `key` to load another.
 */
export function useAnalysis(
  initialFen: string = INITIAL_FEN,
  initialMoves: string[] = [],
  initialPly = 0,
  initialEngineOn = true,
) {
  const [line, dispatch] = useReducer(reducer, {
    rootFen: initialFen,
    moves: initialMoves,
    ply: Math.max(0, Math.min(initialPly, initialMoves.length)),
  });
  const [engineOn, setEngineOn] = useState(initialEngineOn);
  const [update, setUpdate] = useState<AnalysisUpdate | null>(null);
  const [engineName, setEngineName] = useState<string | null>(null);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState(0);
  const nextId = useRef(0);
  const currentIdRef = useRef(0);

  const full = useMemo(() => replay(line.rootFen, line.moves), [line.rootFen, line.moves]);
  const current = useMemo(
    () => replay(line.rootFen, line.moves.slice(0, line.ply)),
    [line.rootFen, line.moves, line.ply],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    ipc
      .onEngineEvent((event) => {
        switch (event.type) {
          case "update":
            // Updates for an older position may still arrive; ignore them.
            if (event.id === currentIdRef.current) setUpdate(event);
            break;
          case "ready":
            setEngineName(event.name);
            setEngineNotice(null);
            break;
          case "restarted":
            setEngineNotice(`Engine restarted: ${event.reason}`);
            break;
          case "failed":
            setEngineNotice(`Engine stopped working: ${event.reason}`);
            break;
        }
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
  }, []);

  const analysedMoves = useMemo(() => line.moves.slice(0, line.ply), [line.moves, line.ply]);

  useEffect(() => {
    if (!engineOn) {
      currentIdRef.current = 0;
      ipc.stopAnalysis().catch(() => {});
      return;
    }
    const id = ++nextId.current;
    currentIdRef.current = id;
    ipc
      .analyzePosition(id, line.rootFen, analysedMoves, MULTIPV)
      .then(() => {
        setRequestError(null);
        setCurrentId(id);
      })
      .catch((e: unknown) => setRequestError(String(e)));
  }, [engineOn, line.rootFen, analysedMoves]);

  const setFen = useCallback((fen: string): string | null => {
    const parsed = parseFenSafe(fen);
    if (!parsed.ok) return parsed.error;
    dispatch({ type: "setFen", fen: parsed.fen });
    return null;
  }, []);

  const play = useCallback((uci: string) => dispatch({ type: "play", uci }), []);
  const goto = useCallback((ply: number) => dispatch({ type: "goto", ply }), []);

  const fresh = update && update.id === currentId ? update : null;

  return {
    rootFen: line.rootFen,
    moves: line.moves,
    ply: line.ply,
    sans: full.sans,
    pos: current.pos,
    lastMove: current.lastMove,
    engineOn,
    setEngineOn,
    engineName,
    engineNotice,
    requestError,
    /** The latest engine output for the position on the board, if any yet. */
    update: fresh,
    /** The latest output for any position, used to keep the eval bar steady while moving. */
    lastUpdate: update,
    setFen,
    play,
    goto,
  };
}
