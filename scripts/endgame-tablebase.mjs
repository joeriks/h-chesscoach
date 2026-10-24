// Checks every endgame drill position in content/endgames/lessons.json against the Lichess
// tablebase (goal matches the tablebase verdict) and pre-fetches the main line of each
// drill (best move for both sides) into content/endgames/tablebase-cache.json, so the
// drills work offline out of the box. Run: node scripts/endgame-tablebase.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { Chess } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import { parseUci } from "chessops/util";

const lessons = JSON.parse(
  readFileSync(new URL("../content/endgames/lessons.json", import.meta.url)),
);
const cachePath = new URL("../content/endgames/tablebase-cache.json", import.meta.url);
let cache = {};
try {
  cache = JSON.parse(readFileSync(cachePath));
} catch {
  // No cache yet: every position is fetched.
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

/** Trimmed tablebase answer for a FEN: root category plus the moves, best first. */
async function lookup(fen, attempt = 0) {
  if (cache[fen]) return cache[fen];
  let res;
  try {
    res = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`);
  } catch (e) {
    if (attempt >= 4) throw e;
    await sleep(2000 * (attempt + 1));
    return lookup(fen, attempt + 1);
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`tablebase ${res.status} for ${fen}`);
    await sleep(5000);
    return lookup(fen, attempt + 1);
  }
  if (!res.ok) throw new Error(`tablebase ${res.status} for ${fen}`);
  const body = await res.json();
  requests++;
  cache[fen] = {
    category: body.category,
    dtz: body.dtz,
    dtm: body.dtm ?? null,
    checkmate: body.checkmate,
    stalemate: body.stalemate,
    moves: body.moves.map((m) => ({ uci: m.uci, san: m.san, category: m.category, dtz: m.dtz })),
  };
  await sleep(120);
  return cache[fen];
}

function after(fen, uci) {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  pos.play(parseUci(uci));
  return makeFen(pos.toSetup());
}

let problems = 0;
for (const unit of lessons.units) {
  for (const lesson of unit.lessons) {
    for (const p of lesson.positions) {
      const root = await lookup(p.fen);
      const ok = p.goal === "win" ? root.category === "win" : root.category === "draw";
      console.log(
        `${ok ? "ok  " : "BAD "} ${lesson.id} ${p.fen}  tablebase=${root.category} dtm=${root.dtm} goal=${p.goal}`,
      );
      if (!ok) problems++;
      // Pre-fetch the main line: best move for both sides, up to 100 plies.
      let fen = p.fen;
      for (let ply = 0; ply < 100; ply++) {
        const t = await lookup(fen);
        if (t.checkmate || t.stalemate || t.moves.length === 0) break;
        const best = t.moves[0];
        fen = after(fen, best.uci);
      }
      // Save as we go, so a network hiccup never loses the positions already fetched.
      writeFileSync(cachePath, JSON.stringify(cache));
    }
  }
}
writeFileSync(cachePath, JSON.stringify(cache));
console.log(
  `${Object.keys(cache).length} positions cached (${requests} new requests), ${problems} problems`,
);
process.exit(problems ? 1 : 0);
