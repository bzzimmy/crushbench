import { type Api, getSupportedThinkingLevels, type Model, type ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { Models } from "@earendil-works/pi-ai/models";
import type { Mode } from "./prompts";

interface ConfigEntry {
  provider: string;
  model: string;
  reasoning?: ModelThinkingLevel;
  name?: string;
}

export interface Entry {
  slug: string;
  name: string;
  reasoning: ModelThinkingLevel;
  model: Model<Api>;
}

export async function loadConfig(path: string, models: Models, mode: Mode): Promise<Entry[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`${path} not found; copy crushbench.example.json to get started`);
  const { models: list } = (await file.json()) as { models?: ConfigEntry[] };
  if (!Array.isArray(list) || !list.length) throw new Error(`${path}: "models" must be a non-empty array`);

  const entries: Entry[] = [];
  for (const [i, c] of list.entries()) {
    const where = `${path}: models[${i}]`;
    if (!c.provider || !c.model) throw new Error(`${where} needs "provider" and "model"`);
    const model = models.getModel(c.provider, c.model);
    if (!model) throw new Error(`${where}: unknown model ${c.provider}/${c.model}`);

    const levels = getSupportedThinkingLevels(model);
    const reasoning = c.reasoning ?? levels[0];
    if (!levels.includes(reasoning)) {
      throw new Error(`${where}: reasoning "${reasoning}" not supported, use one of ${levels.join(", ")}`);
    }
    if (mode === "image" && !model.input.includes("image")) throw new Error(`${where}: model has no image input`);
    if (!(await models.getAuth(model.provider))) {
      throw new Error(`${where}: no API key for provider "${model.provider}"; set it in .env (see .env.example)`);
    }

    const slug = `${c.model}-${reasoning}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (entries.some((e) => e.slug === slug)) throw new Error(`${where}: duplicate of ${slug}`);
    // Catalog names on aggregators look like "DeepSeek: DeepSeek V4.1 Flash".
    const name = c.name ?? model.name.replace(/^[^:]+:\s*/, "");
    entries.push({ slug, name, reasoning, model });
  }
  return entries;
}
