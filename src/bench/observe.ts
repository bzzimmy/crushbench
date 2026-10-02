import { colorName, type GameState, type RawCell, specialName } from "../game/types";
import type { Mode } from "./prompts";

const LETTER: Record<string, string> = { blue: "B", green: "G", orange: "O", purple: "P", red: "R", yellow: "Y" };
const MARK: Record<string, string> = { "striped-h": "-", "striped-v": "|", wrapped: "+", none: "" };

export function cellToken(cell: RawCell): string {
  if (!cell) return "_";
  const special = specialName(cell[1]);
  if (special === "colorbomb") return "*";
  return LETTER[colorName(cell[0])] + MARK[special];
}

export interface Observation {
  score: number;
  level: number;
  candiesNeeded: number;
  secondsLeft: number;
  board?: string[];
}

export function observe(state: GameState, mode: Mode): Observation {
  const o: Observation = {
    score: state.score,
    level: state.level,
    candiesNeeded: Math.max(0, state.levelTarget - state.levelRemoved),
    secondsLeft: Math.max(0, Math.ceil(state.ticksLeft / 30)),
  };
  if (mode === "text") o.board = state.board.map((row) => row.map(cellToken).join(" "));
  return o;
}

export function observationText(o: Observation): string {
  const { board, ...scalars } = o;
  if (!board) return JSON.stringify(scalars);
  const rows = board.map((r) => `  ${JSON.stringify(r)}`).join(",\n");
  return `{${JSON.stringify(scalars).slice(1, -1)},\n "board": [\n${rows}\n ]}`;
}
