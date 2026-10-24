# Chess Coach

Improved React + TypeScript chess-coaching frontend, training content, tests and
handover documentation.

**This repository does not yet include the Rust/Tauri backend (`src-tauri`).**
It is a source-code update, not a complete desktop release or installer. Combine
these changes with a matching complete project before building the desktop app.
The Stockfish binary and large external chess datasets are not included either.

## Start here

- [Build and integration instructions, in Swedish](LAS-MIG-FORST-BYGG-FORBATTRAD-VERSION.txt)
- [Changed source files from the two coaching iterations](ANDRADE-KALLFILER.txt)
- [Source checksums for the USB handover snapshot](KALLFILER-SHA256.csv)
- [Latest coaching assessment and verification](docs/verification/coach-review-iteration-2.md)

The update adds explained training priorities, twelve middlegame positions across
six themes, plan-and-counterplay questions, saved first attempts and delayed
recall. It also improves reflection before engine feedback, own-game exercises,
opening explanations, endgame progress and handling of save failures.

## Frontend preview and checks

Use a Node.js and pnpm version compatible with the locked dependencies:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The browser preview supports local priorities and middlegame training. Imported
games, engine analysis and the desktop schedule require the missing backend.

```bash
pnpm test
pnpm test:content
pnpm lint
pnpm build
```

`pnpm build` builds the frontend only. Frontend checks and browser behavior have
been verified; full Rust, engine/database integration and an installer have not.
The handover instructions use a USB folder layout; in this repository the listed
application paths are relative to the repository root. The checksum list records
the delivered source snapshot, not subsequent documentation-only publication edits.

## Complete desktop project reference

The following describes the original complete Tauri 2 desktop project. Backend
paths below are expected integration locations, not files supplied by this repo.
Keep large asset folders outside the app directory, build watcher and Git.

## Prerequisites (Windows)

- Rust stable, MSVC toolchain, plus Visual Studio Build Tools with the **Desktop development
  with C++** workload (linker and Windows SDK)
- Node.js compatible with the locked dependencies, and pnpm
- WebView2 (preinstalled on Windows 11)

## Commands

```bash
pnpm install
pnpm sidecar       # copy ../stockfish-windows-x86-64-universal/... into src-tauri/binaries
pnpm tauri dev     # run the app
pnpm check         # lint + Vitest + build + fmt + cargo test (incl. real UCI handshake and a 500-change stress test)
pnpm clippy        # cargo clippy (separate: Smart App Control blocks clippy-driver on some machines)
pnpm tauri build   # NSIS installer
```

`STOCKFISH_SRC=<path>` makes `pnpm sidecar` copy a different engine build.

The full puzzle import benchmark (reads all 550 MB, about 6 minutes) is opt-in:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --release --test puzzle_import_full -- --ignored --nocapture
```

## Where things live

| What              | Where                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal database | `%APPDATA%\ChessCoach\coach.sqlite` (WAL; migrations in `src-tauri/src/db/migrations`, version in `PRAGMA user_version`)                                                                                                                           |
| Engine            | bundled sidecar `stockfish.exe` next to the app exe; the `engine.path` setting overrides it                                                                                                                                                        |
| Engine manager    | `src-tauri/src/engine/manager.rs`: one actor per process, request coalescing, watchdog, fake-engine tests                                                                                                                                          |
| Puzzle import     | `src-tauri/src/import/puzzles.rs`: streams the PGN files, validates every record, one transaction per file (resumable)                                                                                                                             |
| Puzzle trainer    | `src-tauri/src/coach/puzzles.rs` (selection, attempts, Glicko-2 per theme) and `src/features/puzzles/`                                                                                                                                             |
| Game import       | `src-tauri/src/import/{pgn,games,lichess,chesscom}.rs`, the sync job in `src-tauri/src/sync.rs`                                                                                                                                                    |
| Games library     | `src-tauri/src/coach/library.rs` and `src/features/library/`, opened on the board from `src/features/review/`                                                                                                                                      |
| Game analysis     | `src-tauri/src/analysis/` (classify, phases, motifs, findings, pipeline) and the queue in `src-tauri/src/analysis_service.rs`                                                                                                                      |
| Game Review UI    | `src/features/review/` (eval graph, key moments, clock chart) on top of the analysis board                                                                                                                                                         |
| Weakness loop     | `src-tauri/src/coach/{weakness,srs}.rs`, training sets in `coach/puzzles.rs`, the Insights screen in `src/features/insights/`                                                                                                                      |
| Openings v1       | `content/repertoires/*.json` (curated lines, SAN with notes), `src-tauri/src/coach/{openings,style,fsrs,drills}.rs`, `src/features/openings/`                                                                                                      |
| Endgame v1        | `content/endgames/lessons.json` (+ `tablebase-cache.json` from `node scripts/endgame-tablebase.mjs`), `src-tauri/src/coach/endgame.rs`, `src/features/endgame/`                                                                                    |
| Soft skills v1    | `content/softskills/tips.json`, `src-tauri/src/coach/softskills.rs`, the "Time and mind" cards on Insights                                                                                                                                         |
| Elite Database    | `src-tauri/src/elite/` (schema in `elite.sqlite` attached as `elite`, Zobrist keys, importer, explorer, plans, model games, master comparison), the job in `src-tauri/src/elite_service.rs`, Settings → Elite Database, Openings → Master Explorer |
| Stats page        | `src-tauri/src/coach/stats.rs` (ratings, area scores against the rating, monthly history), `src/features/stats/`                                                                                                                                   |
| Scheduler         | `src-tauri/src/coach/schedule/` (allocation, game-duration model, fit/re-plan, day plans), the game watcher in `src-tauri/src/schedule_service.rs`, the Today screen in `src/features/today/`                                                      |
| First run         | `src/features/onboarding/` (games, mode and budget, style quiz, puzzle import); shown until the `onboarding.done` setting is set, repeatable from Settings → About                                                                                 |
| Licences          | Settings → About and `THIRD-PARTY-NOTICES.md` (Stockfish GPLv3, Lichess puzzles CC0, Elite Database by nikonoel, chessground/chessops GPLv3)                                                                                                       |
| UI                | `src/` (board wrapper in `src/components/board`, analysis board in `src/features/analysis`)                                                                                                                                                        |

A live sync test against lichess.org and api.chess.com (network, about 15 s) is also opt-in:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --test game_sync_live -- --ignored --nocapture
```

The motif tagger can be checked against the puzzle database's own theme tags (needs the
imported puzzles, release build, about a minute):

```bash
cargo test --manifest-path src-tauri/Cargo.toml --release --test motif_validation -- --ignored --nocapture
```

The puzzle folder defaults to `Lichess puzzles by ECO` next to the repository (or next to the
installed app); the `puzzles.folder` setting overrides it.

## Installer

`pnpm tauri build` produces `src-tauri/target/release/bundle/nsis/Chess Coach_<version>_x64-setup.exe`
(about 76 MB, mostly the Stockfish sidecar). It installs per user, needs no admin rights,
and has no auto-update; a newer installer simply replaces the app. The personal database is
never touched by install or uninstall. On a fresh machine the first-run setup asks for the
puzzle folder (the installed app has no folder next to it) and the Elite Database folder is
chosen in Settings.
