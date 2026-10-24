import { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Config } from "chessground/config";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";

export type Color = "white" | "black";

interface BoardProps {
  /** FEN to display. Defaults to the starting position. */
  fen?: string;
  orientation?: Color;
  /** Side to move. With `dests`, the board lets that side move. */
  turnColor?: Color;
  /** Legal destinations per origin square; omit for a view-only board. */
  dests?: Map<Key, Key[]>;
  lastMove?: [Key, Key];
  check?: boolean;
  shapes?: DrawShape[];
  /**
   * Called after the user moves a piece. Return `false` to refuse the move: the board snaps
   * back to the props. Otherwise the caller is expected to update the props.
   */
  onMove?: (orig: Key, dest: Key) => boolean | void;
  /** Bump to re-apply the props even when none of them changed (e.g. a cancelled promotion). */
  revision?: number;
}

/** React wrapper around the Lichess chessground board. Move legality comes from the caller. */
export function Board({
  fen,
  orientation = "white",
  turnColor,
  dests,
  lastMove,
  check,
  shapes,
  onMove,
  revision = 0,
}: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  // Keep the latest callback and config without re-creating chessground.
  const onMoveRef = useRef(onMove);
  const configRef = useRef<Config>({});
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      coordinates: true,
      // Under Vitest (jsdom) events are never "trusted" and animation frames have no real
      // clock, so chessground would ignore clicks and animate forever.
      trustAllEvents: import.meta.env.MODE === "test",
      animation: { enabled: import.meta.env.MODE !== "test", duration: 150 },
      premovable: { enabled: false },
      draggable: { showGhost: true },
      movable: {
        free: false,
        showDests: true,
        events: {
          after: (orig, dest) => {
            // chessground has already moved the piece and flipped the turn; a refused move
            // must be undone here, since the props will not change.
            if (onMoveRef.current?.(orig, dest) === false) api.current?.set(configRef.current);
          },
        },
      },
    });
    return () => {
      api.current?.destroy();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    const config: Config = {
      orientation,
      turnColor,
      lastMove,
      check: check ? turnColor : false,
      viewOnly: !dests,
      movable: { color: dests ? turnColor : undefined, dests: dests ?? new Map() },
      drawable: { autoShapes: shapes ?? [] },
    };
    if (fen) config.fen = fen;
    configRef.current = config;
    api.current?.set(config);
  }, [fen, orientation, turnColor, dests, lastMove, check, shapes, revision]);

  return (
    <div className="aspect-square w-full">
      <div ref={el} className="h-full w-full" data-testid="board" />
    </div>
  );
}
