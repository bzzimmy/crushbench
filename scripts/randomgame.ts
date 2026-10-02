// Play a whole game with uniformly random legal moves. Useful as a floor baseline and a stress test.
import { RuffleGame } from "../src/game/RuffleGame";

const seed = Number(process.argv[2] ?? 1);
const timeLimitSeconds = Number(process.argv[3] ?? 240);
let rng = seed * 2654435761 >>> 0;
const rand = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const game = await RuffleGame.launch({ seed, timeLimitSeconds });
let s = await game.state();
let moves = 0, illegalTries = 0, lastLevel = s.level;
const t0 = Date.now();
while (!s.done && s.phase === "game") {
  const legal = await game.legalMoves();
  if (!legal.length) {
    // The game handles this itself (reshuffle via level change); just let it run.
    s = (await game.settle()).state;
    if (!legal.length && !s.movesLeft) { await game.advance(60); s = (await game.settle()).state; }
    continue;
  }
  const m = legal[Math.floor(rand() * legal.length)];
  const r = await game.swap(m);
  if (!r.accepted) illegalTries++;
  moves++;
  s = r.state;
  if (s.level !== lastLevel) {
    console.log(`  -> level ${s.level} after ${moves} moves, score ${s.score}, ticksLeft ${s.ticksLeft}`);
    lastLevel = s.level;
  }
}
console.log(`seed=${seed} done: phase=${s.phase} moves=${moves} score=${s.score} level=${s.level} ticksLeft=${s.ticksLeft} rejected=${illegalTries} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
// run through the outro so we see the final phase
await game.advance(600);
console.log("final phase:", (await game.state()).phase);
await game.close();
