import observationImage from "./prompts/observation-image.md" with { type: "text" };
import observationText from "./prompts/observation-text.md" with { type: "text" };
import system from "./prompts/system.md" with { type: "text" };

export type Mode = "text" | "image";

export function systemPrompt(mode: Mode): string {
  return system.replace("{{observation}}", (mode === "text" ? observationText : observationImage).trim());
}
