// Smoke test: boot the patched SWF in Ruffle, play a few legal moves, save screenshots.
import { mkdirSync, writeFileSync } from "node:fs";
import { RuffleGame } from "../src/game/RuffleGame";
import { colorName, type GameState, specialName } from "../src/game/types";

function render(s: GameState): string {
  const glyph = { none: ".", blue: "B", green: "G", orange: "O", purple: "P", red: "R", yellow: "Y" };
  return s.board
    .map((row) =>
      row
        .map((c) => {
          if (!c) return " _ ";
          const col = glyph[colorName(c[0])];
          const sp = specialName(c[1]);
          const mark =
            sp === "none" ? " " : sp === "colorbomb" ? "*" : sp === "wrapped" ? "w" : sp === "striped-h" ? "-" : "|";
          return ` ${col}${mark}`;
        })
        .join(""),
    )
    .join("\n");
}

const seed = Number(process.argv[2] ?? 42);
mkdirSync("out", { recursive: true });
const t0 = Date.now();
const game = await RuffleGame.launch({ seed, headless: true });
console.log("ping:", await game.ping(), `(boot ${Date.now() - t0}ms)`);

let s = await game.state();
console.log(`phase=${s.phase} ready=${s.ready} level=${s.level} score=${s.score} ticksLeft=${s.ticksLeft}`);
console.log(render(s));
writeFileSync(`out/seed${seed}-0.png`, await game.screenshot());

for (let i = 1; i <= 5; i++) {
  const moves = await game.legalMoves();
  if (!moves.length) {
    console.log("no legal moves");
    break;
  }
  const m = moves[0];
  const t = Date.now();
  const r = await game.swap(m);
  console.log(
    `move ${i}: swap(${m}) legal=${r.legal} accepted=${r.accepted} +${r.scoreDelta} score=${r.state.score} level=${r.state.level} ticks=${r.ticks} ticksLeft=${r.state.ticksLeft} (${Date.now() - t}ms, ${moves.length} legal)`,
  );
  writeFileSync(`out/seed${seed}-${i}.png`, await game.screenshot());
}
// try an illegal move to see the swap-back path
s = await game.state();
let illegal: [number, number, number, number] | null = null;
outer: for (let y = 0; y < s.height; y++)
  for (let x = 0; x + 1 < s.width; x++)
    if (!(await game.isLegal([x, y, x + 1, y]))) {
      illegal = [x, y, x + 1, y];
      break outer;
    }
if (illegal) {
  const r = await game.swap(illegal);
  console.log(`illegal swap(${illegal}) legal=${r.legal} accepted=${r.accepted} +${r.scoreDelta} ticks=${r.ticks}`);
}
console.log(render(await game.state()));
await game.close();
