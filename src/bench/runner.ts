import type { AssistantMessage, Context, Usage, UserMessage } from "@earendil-works/pi-ai";
import type { Models } from "@earendil-works/pi-ai/models";
import type { RuffleGame } from "../game/RuffleGame";
import type { GameState, Move } from "../game/types";
import type { Entry } from "./config";
import { observationText, observe } from "./observe";
import { type Mode, systemPrompt } from "./prompts";

const MAX_ATTEMPTS = 3;
const FORFEIT_TICKS = 90;
const MAX_API_RETRIES = 5;

export interface GameResult {
  name: string;
  slug: string;
  provider: string;
  model: string;
  reasoning: string;
  mode: Mode;
  seed: number;
  score: number;
  level: number;
  moves: number;
  noMatchSwaps: number;
  replies: number;
  invalidReplies: number;
  forfeits: number;
  apiErrors: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; reasoning: number; total: number };
  costUsd: number;
  modelSeconds: number;
  elapsedSeconds: number;
  transcript: Context;
}

export function parseMove(text: string, s: GameState): Move | string {
  const found = text.match(/\{[^{}]*"from"[^{}]*\}/g);
  if (!found) return 'No move found. End your reply with {"from": [x, y], "to": [x, y]} on its own line.';
  let m: any;
  try {
    m = JSON.parse(found[found.length - 1]);
  } catch {
    return 'Your move is not valid JSON. Use {"from": [x, y], "to": [x, y]}.';
  }
  const cell = (c: unknown, w: number, h: number) =>
    Array.isArray(c) &&
    c.length === 2 &&
    Number.isInteger(c[0]) &&
    Number.isInteger(c[1]) &&
    c[0] >= 0 &&
    c[0] < w &&
    c[1] >= 0 &&
    c[1] < h;
  if (!cell(m.from, s.width, s.height) || !cell(m.to, s.width, s.height)) {
    return `"from" and "to" must each be [x, y] with x from 0 to ${s.width - 1} and y from 0 to ${s.height - 1}.`;
  }
  const [x0, y0] = m.from;
  const [x1, y1] = m.to;
  if (Math.abs(x0 - x1) + Math.abs(y0 - y1) !== 1) {
    return `(${x0}, ${y0}) and (${x1}, ${y1}) are not adjacent. Swap two cells that share an edge.`;
  }
  return [x0, y0, x1, y1];
}

const user = (content: UserMessage["content"]): UserMessage => ({ role: "user", content, timestamp: Date.now() });
const replyText = (m: AssistantMessage) => m.content.map((b) => (b.type === "text" ? b.text : "")).join("");

export async function playGame(
  models: Models,
  entry: Entry,
  game: RuffleGame,
  mode: Mode,
  log: (line: string) => void,
): Promise<GameResult> {
  const t0 = performance.now();
  const context: Context = { systemPrompt: systemPrompt(mode), messages: [] };
  const sessionId = crypto.randomUUID();
  const r: GameResult = {
    name: entry.name,
    slug: entry.slug,
    provider: entry.model.provider,
    model: entry.model.id,
    reasoning: entry.reasoning,
    mode,
    seed: game.options.seed,
    score: 0,
    level: 1,
    moves: 0,
    noMatchSwaps: 0,
    replies: 0,
    invalidReplies: 0,
    forfeits: 0,
    apiErrors: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 },
    costUsd: 0,
    modelSeconds: 0,
    elapsedSeconds: 0,
    transcript: context,
  };

  const addUsage = (u: Usage) => {
    r.tokens.input += u.input;
    r.tokens.output += u.output;
    r.tokens.cacheRead += u.cacheRead;
    r.tokens.cacheWrite += u.cacheWrite;
    r.tokens.reasoning += u.reasoning ?? 0;
    r.tokens.total += u.totalTokens;
    r.costUsd += u.cost.total;
  };

  // Provider failures come back as stopReason "error"; they are retried and kept out of the conversation.
  const ask = async (): Promise<AssistantMessage> => {
    for (let attempt = 1; ; attempt++) {
      const t = performance.now();
      const reply = await models.completeSimple(entry.model, context, {
        reasoning: entry.reasoning === "off" ? undefined : entry.reasoning,
        sessionId,
      });
      r.modelSeconds += (performance.now() - t) / 1000;
      addUsage(reply.usage);
      if (reply.stopReason !== "error" && reply.stopReason !== "aborted") return reply;
      r.apiErrors++;
      if (attempt === MAX_API_RETRIES) throw new Error(`${entry.slug}: ${reply.errorMessage}`);
      log(`  api error (${attempt}/${MAX_API_RETRIES}): ${reply.errorMessage}`);
      await Bun.sleep(1000 * 2 ** attempt);
    }
  };

  let s = await game.state();
  let note = "";
  while (!s.done) {
    if (!s.ready) {
      const settled = await game.settle();
      s = settled.state;
      if (!settled.ticks) break;
      continue;
    }

    const obs = observationText(observe(s, mode));
    const text = note ? `${note}\n\n${obs}` : obs;
    if (mode === "image") {
      const data = (await game.screenshot()).toString("base64");
      context.messages.push(
        user([
          { type: "image", data, mimeType: "image/png" },
          { type: "text", text },
        ]),
      );
    } else {
      context.messages.push(user(text));
    }

    let move: Move | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !move; attempt++) {
      const reply = await ask();
      context.messages.push(reply);
      r.replies++;
      const parsed = parseMove(replyText(reply), s);
      if (typeof parsed !== "string") move = parsed;
      else {
        r.invalidReplies++;
        if (attempt < MAX_ATTEMPTS) context.messages.push(user(parsed));
      }
    }

    if (!move) {
      r.forfeits++;
      await game.advance(FORFEIT_TICKS);
      s = (await game.settle()).state;
      note = `${MAX_ATTEMPTS} invalid replies: the turn was forfeited and ${FORFEIT_TICKS / 30} seconds ran off the clock.`;
      log(`  turn forfeited, score ${s.score}`);
      continue;
    }

    const swap = await game.swap(move);
    s = swap.state;
    r.moves++;
    if (!swap.legal) r.noMatchSwaps++;
    note = swap.legal
      ? `Your swap scored ${swap.scoreDelta} points.`
      : "Your swap made no match and the candies swapped back.";
    log(
      `  #${r.moves} (${move[0]},${move[1]})->(${move[2]},${move[3]}) ${swap.legal ? `+${swap.scoreDelta}` : "no match"}  score ${s.score}  level ${s.level}  ${Math.ceil(s.ticksLeft / 30)}s left  $${r.costUsd.toFixed(4)}`,
    );
  }

  r.score = s.score;
  r.level = s.level;
  r.elapsedSeconds = (performance.now() - t0) / 1000;
  return r;
}
