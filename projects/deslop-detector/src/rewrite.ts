import type { Mark } from "./detect.ts";

export const DESLOP_MODEL = "hf.co/erikkannike/qwen3-4b-deslop-v4-GGUF:Q4_K_M";
export const DEFAULT_OLLAMA = "http://localhost:11434";

export interface Paragraph {
  start: number;
  end: number;
  text: string;
  marks: number;
}

/** Paragraphs (non-empty lines) of the text, with how many marks touch each. */
export function paragraphs(text: string, marks: Mark[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const m of text.matchAll(/[^\n]+/g)) {
    if (!m[0].trim()) continue;
    const start = m.index, end = m.index + m[0].length;
    out.push({ start, end, text: m[0], marks: marks.filter((k) => k.start < end && k.end > start).length });
  }
  return out;
}

export function rewritePrompt(paragraph: string): string {
  // Small models drift into writing their own piece unless the text is fenced off as something to edit.
  return [
    "Edit the text below. Keep the same meaning, facts, point of view and length, but say it plainly.",
    "Output only the edited text, nothing else.",
    "",
    "Text:",
    '"""',
    paragraph.trim(),
    '"""',
  ].join("\n");
}

/** Drops Qwen-style thinking blocks and any wrapping quotes the model adds. */
export function cleanReply(reply: string): string {
  let s = reply.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "").trim();
  s = s.replace(/^(?:Text:\s*)?"""\s*|\s*"""$/g, "").trim();
  if (/^["“].*["”]$/s.test(s)) s = s.slice(1, -1).trim();
  return s.replace(/\n{2,}/g, "\n");
}

/** Replaces each paragraph range with its rewrite, keeping everything else byte for byte. */
export function splice(text: string, rewrites: { start: number; end: number; text: string }[]): string {
  let out = "", cursor = 0;
  for (const r of [...rewrites].sort((a, b) => a.start - b.start)) {
    out += text.slice(cursor, r.start) + r.text;
    cursor = r.end;
  }
  return out + text.slice(cursor);
}

export function normalizeBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function init(base: string, extra: RequestInit = {}): RequestInit {
  const host = new URL(base).hostname;
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  // Chrome's Local Network Access: tells the browser this public page means to reach this device.
  return loopback ? ({ ...extra, targetAddressSpace: "loopback" } as RequestInit) : extra;
}

export async function listModels(base: string): Promise<string[]> {
  const res = await fetch(`${base}/api/tags`, init(base));
  if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
  const body = (await res.json()) as { models?: { name: string }[] };
  return (body.models ?? []).map((m) => m.name);
}

export function pickModel(names: string[]): string | undefined {
  return names.find((n) => /deslop/i.test(n)) ?? names[0];
}

export async function rewriteParagraph(
  base: string,
  model: string,
  paragraph: string,
  onText: (soFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(
    `${base}/api/chat`,
    init(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        think: false,
        messages: [{ role: "user", content: rewritePrompt(paragraph) }],
        options: { temperature: 0.3 },
      }),
      signal,
    }),
  );
  if (!res.ok || !res.body) throw new Error(`Ollama answered ${res.status}: ${await res.text().catch(() => "")}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "", reply = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (chunk.error) throw new Error(chunk.error);
      reply += chunk.message?.content ?? "";
      onText(cleanReply(reply));
    }
  }
  return cleanReply(reply);
}
