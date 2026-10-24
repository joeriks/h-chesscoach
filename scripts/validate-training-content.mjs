import { readFile, readdir } from "node:fs/promises";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { parseSan } from "chessops/san";

const root = new URL("../content/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root), "utf8"));
const curriculum = await read("endgames/lessons.json");
const cache = await read("endgames/tablebase-cache.json");
let positions = 0;
let lines = 0;
let moves = 0;
const errors = [];
for (const unit of curriculum.units) {
  for (const lesson of unit.lessons) {
    for (const position of lesson.positions) {
      positions++;
      const setup = parseFen(position.fen);
      const parsed = setup.isOk ? Chess.fromSetup(setup.value) : setup;
      if (parsed.isErr) {
        errors.push(`${lesson.id}: invalid FEN`);
        continue;
      }
      const pos = parsed.value;
      if (pos.turn !== position.side) errors.push(`${lesson.id}: wrong solver side`);
      const evidence = cache[position.fen];
      if (!evidence) errors.push(`${lesson.id}: missing cached root verdict`);
      else if (evidence.category !== position.goal)
        errors.push(`${lesson.id}: goal ${position.goal}, cached verdict ${evidence.category}`);
      // A concrete regression for the corrected starting-position hints.
      if (lesson.id === "kq-mate") {
        for (const san of ["Qh4", "Qf3"]) {
          if (!parseSan(pos, san)) errors.push(`${lesson.id}: illegal suggested move ${san}`);
          if (!evidence?.moves.some((m) => m.san === san && m.category === "loss"))
            errors.push(`${lesson.id}: suggested ${san} does not preserve a cached win`);
        }
      }
    }
  }
}
for (const file of await readdir(new URL("repertoires/", root))) {
  if (!file.endsWith(".json")) continue;
  const repertoire = await read(`repertoires/${file}`);
  for (const line of repertoire.lines) {
    lines++;
    const pos = Chess.default();
    for (const san of line.moves) {
      const move = parseSan(pos, san);
      if (!move) {
        errors.push(`${file}/${line.key}: illegal ${san} after ${moves} total validated moves`);
        break;
      }
      pos.play(move);
      moves++;
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Validated ${positions} endgame roots against cached verdicts, 2 corrected queen hints, and ${moves} legal moves in ${lines} repertoire lines. Cached verdicts are not a live tablebase integration test.`,
  );
