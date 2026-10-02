// Run configured models over the benchmark seeds: bun run bench [slug...] [--mode text|image] [--seed n]
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { loadConfig } from "../src/bench/config";
import type { Mode } from "../src/bench/prompts";
import { type GameResult, playGame } from "../src/bench/runner";
import { SEEDS } from "../src/bench/seeds";
import { RuffleGame } from "../src/game/RuffleGame";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    mode: { type: "string", default: "text" },
    seed: { type: "string" },
    config: { type: "string", default: "crushbench.json" },
    seconds: { type: "string", default: "240" },
  },
});

const mode = values.mode as Mode;
if (mode !== "text" && mode !== "image") throw new Error(`--mode must be text or image, got "${mode}"`);
const seeds = values.seed ? [Number(values.seed)] : [...SEEDS];
const timeLimitSeconds = Number(values.seconds);

const models = builtinModels();
let entries = await loadConfig(values.config, models, mode);
if (positionals.length) {
  const unknown = positionals.filter((p) => !entries.some((e) => e.slug === p));
  if (unknown.length)
    throw new Error(`not in config: ${unknown.join(", ")} (have ${entries.map((e) => e.slug).join(", ")})`);
  entries = entries.filter((e) => positionals.includes(e.slug));
}

const results: GameResult[] = [];
for (const entry of entries) {
  const dir = `results/${mode}/${entry.slug}`;
  mkdirSync(dir, { recursive: true });
  for (const seed of seeds) {
    console.log(`${entry.name} (${entry.reasoning}, ${mode}) seed ${seed}`);
    const game = await RuffleGame.launch({ seed, timeLimitSeconds });
    try {
      const r = await playGame(models, entry, game, mode, console.log);
      results.push(r);
      // Screenshots would make image-mode transcripts tens of MB.
      const transcript = JSON.parse(JSON.stringify(r.transcript), (k, v) => (k === "data" ? "<png>" : v));
      writeFileSync(`${dir}/seed-${seed}.json`, `${JSON.stringify({ ...r, timeLimitSeconds, transcript }, null, 2)}\n`);
      console.log(
        `  final score ${r.score}, level ${r.level}, $${r.costUsd.toFixed(4)}, ${r.elapsedSeconds.toFixed(0)}s`,
      );
    } finally {
      await game.close();
    }
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.table(
  entries.map((e) => {
    const rs = results.filter((r) => r.slug === e.slug);
    const moves = rs.reduce((a, r) => a + r.moves, 0) || 1;
    return {
      model: e.name,
      reasoning: e.reasoning,
      mode,
      games: rs.length,
      score: Math.round(mean(rs.map((r) => r.score))),
      level: +mean(rs.map((r) => r.level)).toFixed(1),
      invalid: `${((100 * rs.reduce((a, r) => a + r.invalidReplies, 0)) / (rs.reduce((a, r) => a + r.replies, 0) || 1)).toFixed(1)}%`,
      "out tokens/move": Math.round(rs.reduce((a, r) => a + r.tokens.output, 0) / moves),
      "s/move": +(rs.reduce((a, r) => a + r.modelSeconds, 0) / moves).toFixed(1),
      "$/game": +mean(rs.map((r) => r.costUsd)).toFixed(4),
    };
  }),
);
