// Copies the local Stockfish build into src-tauri/binaries with the target-triple suffix
// Tauri requires for `bundle.externalBin`. The engine itself lives outside the app folder
// (and outside git); set STOCKFISH_SRC to use a different binary.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSrc = join(
  appRoot,
  "..",
  "stockfish-windows-x86-64-universal",
  "stockfish",
  "stockfish-windows-x86-64-universal.exe",
);
const src = process.env.STOCKFISH_SRC ? resolve(process.env.STOCKFISH_SRC) : defaultSrc;
const destDir = join(appRoot, "src-tauri", "binaries");
const dest = join(destDir, "stockfish-x86_64-pc-windows-msvc.exe");

if (!existsSync(src)) {
  console.error(`Stockfish not found at ${src}. Set STOCKFISH_SRC to the engine executable.`);
  process.exit(1);
}

const srcStat = statSync(src);
if (existsSync(dest)) {
  const destStat = statSync(dest);
  if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
    console.log(`Stockfish sidecar up to date (${dest})`);
    process.exit(0);
  }
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`Copied Stockfish sidecar (${(srcStat.size / 1e6).toFixed(1)} MB) to ${dest}`);
