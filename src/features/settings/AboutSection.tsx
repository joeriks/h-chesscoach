import { ipc } from "../../lib/ipc";

/** Version, credits and licence notices (PLAN.md 1.8). */
export function AboutSection({
  version,
  onSetupAgain,
}: {
  version: string | null;
  onSetupAgain: () => void;
}) {
  return (
    <section className="space-y-2" aria-label="About">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">About</h2>
      <p className="text-sm">
        Chess Coach {version ?? ""} · a local chess coach that never plays against you. All data
        stays on this computer; nothing is sent anywhere except the sync requests to the sites you
        link and the tablebase lookups for endgame drills.
      </p>
      <ul className="space-y-1 text-xs text-neutral-400" aria-label="Licences">
        <li>
          Engine: Stockfish 19, GPLv3. The engine runs as a separate program next to the app; its
          source is available from stockfishchess.org.
        </li>
        <li>Puzzles: the Lichess puzzle database, CC0 (public domain).</li>
        <li>
          Master games: the Lichess Elite Database compiled by nikonoel from Lichess games, public
          domain.
        </li>
        <li>Endgame drills: the Lichess tablebase API (tablebase.lichess.ovh).</li>
        <li>Board: chessground and chessops by Lichess, GPLv3.</li>
        <li>This app itself is licensed under GPLv3.</li>
      </ul>
      <button
        type="button"
        onClick={() =>
          ipc
            .setSetting("onboarding.done", "")
            .then(onSetupAgain)
            .catch(() => {})
        }
        className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800"
      >
        Run the first-time setup again
      </button>
    </section>
  );
}
