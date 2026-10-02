// Human play: serve the game with the clock on wall time, one URL per benchmark seed.

import { SEEDS } from "../src/bench/seeds";
import { startGameServer } from "../src/game/server";

const server = startGameServer(4321);
const url = (seed: number) => `${server.url}/#${encodeURIComponent(JSON.stringify({ seed, realtime: true }))}`;
console.log("Play each seed once; note the FINAL SCORE from the line under the board.\n");
for (const s of SEEDS) console.log(`seed ${s}: ${url(s)}`);
console.log("\nCtrl-C to stop.");
