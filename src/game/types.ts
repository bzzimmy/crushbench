/** Colour ids as used by the game (GameView.COLOR_*). 0 = none (colour bomb / blank). */
export const COLORS = ["none", "blue", "green", "orange", "purple", "red", "yellow"] as const;
export type ColorName = (typeof COLORS)[number];

/** Special bits as used by the game (ItemType.*). */
export const SPECIAL = { WRAP: 8, LINE: 16, COLOR: 32, COLUMN: 128 } as const;

export type SpecialName = "none" | "striped-h" | "striped-v" | "wrapped" | "colorbomb";

/** One cell: [colorId, specialBits] or null for an empty slot. */
export type RawCell = [number, number] | null;

export type Phase = "loading" | "notstarted" | "intro" | "game" | "outro" | "done";

export interface GameState {
  phase: Phase;
  /** Game is waiting for a move: in play, unpaused, board at rest. */
  ready: boolean;
  done: boolean;
  paused: boolean;
  stable: boolean;
  level: number;
  score: number;
  levelScore: number;
  /** Candies removed this level / needed to advance. */
  levelRemoved: number;
  levelTarget: number;
  /** Game-clock ticks (30/s) left before the final blast. */
  ticksLeft: number;
  levelTicks: number;
  /** Manual clock in ms. */
  time: number;
  /** Game's own "are there any moves" check. */
  movesLeft: boolean;
  width: number;
  height: number;
  /** board[y][x] */
  board: RawCell[][];
}

/** A swap between two orthogonally adjacent cells. */
export type Move = [x0: number, y0: number, x1: number, y1: number];

export interface SwapResult {
  /** Board.trySwap accepted the input (adjacent, stable, items not busy). */
  accepted: boolean;
  /** Our pre-check: would this swap do anything? Illegal swaps animate and swap back. */
  legal: boolean;
  scoreBefore: number;
  scoreDelta: number;
  levelBefore: number;
  /** Ticks consumed settling before + after the swap. */
  ticks: number;
  state: GameState;
}

export function specialName(bits: number): SpecialName {
  if (bits & SPECIAL.COLOR) return "colorbomb";
  if (bits & SPECIAL.WRAP) return "wrapped";
  if (bits & SPECIAL.LINE) return "striped-h";
  if (bits & SPECIAL.COLUMN) return "striped-v";
  return "none";
}

export function colorName(id: number): ColorName {
  return COLORS[id] ?? "none";
}
