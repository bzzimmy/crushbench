import {
  type AssistantMessage,
  type Context,
  type ImageContent,
  type TextContent,
  type Tool,
  type ToolCall,
  type ToolResultMessage,
  Type,
  type Usage,
  validateToolCall,
} from "@earendil-works/pi-ai";
import type { Models } from "@earendil-works/pi-ai/models";
import type { RuffleGame } from "../game/RuffleGame";
import type { GameState, Move } from "../game/types";
import type { Entry } from "./config";
import { observationText, observe } from "./observe";
import { type Mode, systemPrompt } from "./prompts";

const MAX_ATTEMPTS = 3;
const FORFEIT_TICKS = 90;
const MAX_API_RETRIES = 5;

const cell = Type.Array(Type.Integer({ minimum: 0, maximum: 8 }), { minItems: 2, maxItems: 2 });
const SWAP: Tool = {
  name: "swap",
  description: "Swap two adjacent candies. Each cell is [x, y]. Returns the result and the new board.",
  parameters: Type.Object({ from: cell, to: cell }),
};

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

type Content = (TextContent | ImageContent)[];

function toMove(call: ToolCall): Move {
  const { from, to } = validateToolCall([SWAP], call) as { from: number[]; to: number[] };
  if (Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) !== 1) {
    throw new Error(`[${from}] and [${to}] are not adjacent. Swap two cells that share an edge.`);
  }
  return [from[0], from[1], to[0], to[1]];
}

const result = (call: ToolCall, content: Content, isError: boolean): ToolResultMessage => ({
  role: "toolResult",
  toolCallId: call.id,
  toolName: call.name,
  content,
  isError,
  timestamp: Date.now(),
});

export async function playGame(
  models: Models,
  entry: Entry,
  game: RuffleGame,
  mode: Mode,
  log: (line: string) => void,
): Promise<GameResult> {
  const t0 = performance.now();
  const context: Context = { systemPrompt: systemPrompt(mode), messages: [], tools: [SWAP] };
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

  const ready = async (s: GameState) => {
    while (!s.done && !s.ready) {
      const settled = await game.settle();
      if (!settled.ticks) throw new Error("game stopped before it was ready for a move");
      s = settled.state;
    }
    return s;
  };

  const frame = async (s: GameState, note: string): Promise<Content> => {
    const obs = observationText(observe(s, mode));
    const text: TextContent = { type: "text", text: note ? `${note}\n\n${obs}` : obs };
    if (mode === "text") return [text];
    return [{ type: "image", data: (await game.screenshot()).toString("base64"), mimeType: "image/png" }, text];
  };

  let s = await ready(await game.state());
  context.messages.push({ role: "user", content: await frame(s, ""), timestamp: Date.now() });
  let attempts = 0;
  while (!s.done) {
    const reply = await ask();
    context.messages.push(reply);
    r.replies++;
    const [call, ...extra] = reply.content.filter((b): b is ToolCall => b.type === "toolCall");

    let move: Move | undefined;
    let error = "No move made. Call the swap tool.";
    if (call) {
      try {
        move = toMove(call);
      } catch (e) {
        error = (e as Error).message;
      }
    }

    let content: Content;
    if (move) {
      const swap = await game.swap(move);
      s = await ready(swap.state);
      r.moves++;
      attempts = 0;
      if (!swap.legal) r.noMatchSwaps++;
      content = await frame(
        s,
        swap.legal ? `Scored ${swap.scoreDelta} points.` : "No match; the candies swapped back.",
      );
      log(
        `  #${r.moves} (${move[0]},${move[1]})->(${move[2]},${move[3]}) ${swap.legal ? `+${swap.scoreDelta}` : "no match"}  score ${s.score}  level ${s.level}  ${Math.ceil(s.ticksLeft / 30)}s left  $${r.costUsd.toFixed(4)}`,
      );
    } else {
      r.invalidReplies++;
      if (++attempts < MAX_ATTEMPTS) content = [{ type: "text", text: error }];
      else {
        r.forfeits++;
        attempts = 0;
        await game.advance(FORFEIT_TICKS);
        s = await ready((await game.settle()).state);
        const note = `${error}\n\n${MAX_ATTEMPTS} invalid attempts: the turn is forfeited and ${FORFEIT_TICKS / 30} seconds ran off the clock.`;
        content = await frame(s, note);
        log(`  turn forfeited, score ${s.score}`);
      }
    }

    if (call) context.messages.push(result(call, content, !move));
    else context.messages.push({ role: "user", content, timestamp: Date.now() });
    for (const x of extra)
      context.messages.push(result(x, [{ type: "text", text: "One swap per turn; ignored." }], true));
  }

  r.score = s.score;
  r.level = s.level;
  r.elapsedSeconds = (performance.now() - t0) / 1000;
  return r;
}
