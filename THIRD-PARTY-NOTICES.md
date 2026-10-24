# Third-party notices

Chess Coach is licensed under the GNU General Public License v3.0.

| Component                    | Licence             | Notes                                                                                                                |
| ---------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Stockfish 19                 | GPLv3               | Bundled as a separate executable (`stockfish.exe`) next to the app; talks UCI over pipes. Source: stockfishchess.org |
| Lichess puzzle database      | CC0 (public domain) | Imported from the local folder; not redistributed with the installer.                                                |
| Lichess Elite Database       | Public domain       | Compiled by nikonoel from Lichess games; optional, imported from local files.                                        |
| Lichess tablebase API        | Service             | Online lookups for endgame drills; answers are cached locally.                                                       |
| chessground, chessops        | GPLv3               | Board and move generation in the UI.                                                                                 |
| shakmaty, pgn-reader         | GPLv3               | Chess logic and PGN parsing in the Rust core.                                                                        |
| Tauri, React, Vite, Tailwind | MIT / Apache-2.0    | Application framework and UI toolchain.                                                                              |
| rusqlite / SQLite            | MIT / public domain | Local databases.                                                                                                     |
