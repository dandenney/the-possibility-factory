// Sends the pelican prompt to every model in models.json through OpenRouter and saves the SVGs.
// Usage: OPENROUTER_API_KEY=... pnpm generate [model-slug ...]
// Re-running only fills missing samples, so it's safe to stop and resume. Pass --redo to regenerate.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractSvg, looksDrawable, sanitizeSvg } from "../src/svg.ts";
import type { ArenaConfig, Gallery, ModelConfig, Sample } from "../src/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const galleryPath = join(root, "src/gallery.json");
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("Set OPENROUTER_API_KEY.");
  process.exit(1);
}

const args = process.argv.slice(2);
const redo = args.includes("--redo");
const only = new Set(args.filter((a) => !a.startsWith("--")));

const config = JSON.parse(await readFile(join(root, "models.json"), "utf8")) as ArenaConfig;
const gallery = JSON.parse(await readFile(galleryPath, "utf8")) as Gallery;
const models = config.models.filter((m) => only.size === 0 || only.has(m.slug));
if (redo) {
  const slugs = new Set(models.map((m) => m.slug));
  gallery.samples = gallery.samples.filter((s) => !slugs.has(s.model));
  gallery.failures = gallery.failures.filter((f) => !slugs.has(f.model));
}

let totalCost = 0;
let writing = Promise.resolve();
const save = () => {
  writing = writing.then(async () => {
    gallery.generatedAt = new Date().toISOString();
    gallery.samples.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
    await writeFile(galleryPath, JSON.stringify(gallery, null, 2) + "\n");
  });
  return writing;
};

class OutOfCredits extends Error {}

interface Completion {
  choices?: { message?: { content?: string | null } }[];
  usage?: { completion_tokens?: number; cost?: number };
  error?: { message?: string };
}

async function ask(model: ModelConfig): Promise<{ reply: string; outputTokens: number | null; cost: number | null; seconds: number }> {
  const started = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pelican-bench-arena.netlify.app",
      "X-Title": "Pelican Bench Arena",
    },
    body: JSON.stringify({
      model: model.id,
      messages: [{ role: "user", content: config.prompt }],
      max_tokens: model.maxTokens ?? config.maxTokens,
      usage: { include: true },
    }),
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const body = (await res.json()) as Completion;
  if (res.status === 402) throw new OutOfCredits(body.error?.message ?? "out of credits");
  if (!res.ok || body.error) throw new Error(`${res.status} ${body.error?.message ?? res.statusText}`);
  return {
    reply: body.choices?.[0]?.message?.content ?? "",
    outputTokens: body.usage?.completion_tokens ?? null,
    cost: body.usage?.cost ?? null,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
}

async function run(model: ModelConfig): Promise<void> {
  const have = () => gallery.samples.filter((s) => s.model === model.slug);
  let attempt = 0;
  const maxAttempts = config.samplesPerModel + 2;
  while (have().length < config.samplesPerModel && attempt < maxAttempts) {
    attempt++;
    const n = Math.max(0, ...have().map((s) => Number(s.id.split("-").pop()))) + 1;
    try {
      const { reply, outputTokens, cost, seconds } = await ask(model);
      totalCost += cost ?? 0;
      const raw = extractSvg(reply);
      if (!raw) throw new Error("no <svg> in reply");
      const svg = sanitizeSvg(raw);
      if (!looksDrawable(svg)) throw new Error("SVG has almost no shapes");
      const file = `/svgs/${model.slug}/${n}.svg`;
      await mkdir(join(root, "public/svgs", model.slug), { recursive: true });
      await writeFile(join(root, "public", file), svg);
      const sample: Sample = { id: `${model.slug}-${n}`, model: model.slug, file, outputTokens, cost, seconds, createdAt: new Date().toISOString() };
      gallery.samples.push(sample);
      console.log(`✓ ${sample.id} (${seconds}s, ${outputTokens ?? "?"} tokens, $${(cost ?? 0).toFixed(4)})`);
    } catch (err) {
      if (err instanceof OutOfCredits) {
        console.log(`✗ ${model.slug}: out of OpenRouter credits, stopping (${err.message.slice(0, 120)})`);
        return;
      }
      const reason = err instanceof Error ? err.message : String(err);
      gallery.failures.push({ model: model.slug, attempt, reason: reason.slice(0, 200), createdAt: new Date().toISOString() });
      console.log(`✗ ${model.slug} attempt ${attempt}: ${reason.slice(0, 200)}`);
    }
    await save();
  }
}

await Promise.all(models.map(run));
await writing;
console.log(`Done. ${gallery.samples.length} samples, this run cost $${totalCost.toFixed(4)}.`);
