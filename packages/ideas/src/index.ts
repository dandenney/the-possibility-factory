import Anthropic from "@anthropic-ai/sdk";
import {
  createIdea,
  getSetting,
  listFreshSignals,
  listIdeas,
  type Db,
  type Idea,
  type Signal,
} from "@factory/core";

export const INTERESTS_KEY = "interests";
export const DEFAULT_MODEL = "claude-sonnet-5-5";

export interface Proposal {
  title: string;
  pitch: string;
  whyNow: string;
  signalIds: number[];
}

export interface GenerateOptions {
  client: Anthropic;
  model?: string;
  count?: number;
  /** Only consider signals created within this many hours. */
  lookbackHours?: number;
}

export const proposeIdeasTool = {
  name: "propose_ideas",
  description: "Record software project ideas, each grounded in one or more of the provided signals.",
  input_schema: {
    type: "object" as const,
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short, concrete project name or one-line concept." },
            pitch: { type: "string", description: "Two or three sentences: what it is, who it's for, the fun or useful hook." },
            why_now: { type: "string", description: "Why the cited signals make this timely." },
            signal_ids: { type: "array", items: { type: "integer" }, description: "Ids of the signals this idea builds on." },
          },
          required: ["title", "pitch", "why_now", "signal_ids"],
        },
      },
    },
    required: ["ideas"],
  },
};

export function buildPrompt({
  signals,
  interests,
  recentIdeas,
  count,
}: {
  signals: Pick<Signal, "id" | "kind" | "title" | "note" | "source">[];
  interests: string | undefined;
  recentIdeas: Pick<Idea, "title">[];
  count: number;
}): string {
  const signalLines = signals.map((s) => {
    const note = s.note ? ` — ${s.note.replace(/\s+/g, " ").slice(0, 240)}` : "";
    return `[${s.id}] (${s.kind}, ${s.source}) ${s.title}${note}`;
  });
  return [
    "You generate project ideas for Dan, a web engineer who builds side projects to explore new AI models,",
    "developer tools, and fun pop-culture moments. Ideas should be small enough to prototype in a few days.",
    "",
    "## Dan's interests",
    interests?.trim() || "(none recorded yet; favor AI, developer tooling, and playful web experiments)",
    "",
    "## Ideas already on the board (don't repeat these)",
    recentIdeas.length ? recentIdeas.map((i) => `- ${i.title}`).join("\n") : "(none)",
    "",
    "## Fresh signals",
    signalLines.join("\n"),
    "",
    `Propose up to ${count} ideas using the propose_ideas tool. Each must cite the signal ids it builds on.`,
    "Combining a new model or tool with a cultural moment is encouraged. Skip signals that are tragedies,",
    "partisan politics, or otherwise poor material, and propose fewer ideas rather than weak ones.",
  ].join("\n");
}

/** Validates the model's tool input, dropping ideas that cite no known signal. */
export function parseProposals(input: unknown, knownIds: Set<number>): Proposal[] {
  const ideas = (input as { ideas?: unknown })?.ideas;
  if (!Array.isArray(ideas)) return [];
  return ideas.flatMap((raw) => {
    const i = raw as Record<string, unknown>;
    const title = typeof i.title === "string" ? i.title.trim() : "";
    const pitch = typeof i.pitch === "string" ? i.pitch.trim() : "";
    const whyNow = typeof i.why_now === "string" ? i.why_now.trim() : "";
    const signalIds = Array.isArray(i.signal_ids)
      ? [...new Set(i.signal_ids.filter((id): id is number => typeof id === "number" && knownIds.has(id)))]
      : [];
    return title && signalIds.length ? [{ title, pitch, whyNow, signalIds }] : [];
  });
}

export async function proposeIdeas(db: Db, options: GenerateOptions): Promise<Proposal[]> {
  const { client, model = DEFAULT_MODEL, count = 5, lookbackHours = 36 } = options;
  const signals = await listFreshSignals(db, new Date(Date.now() - lookbackHours * 3_600_000), 120);
  if (signals.length === 0) return [];
  const [interests, ideas] = await Promise.all([getSetting(db, INTERESTS_KEY), listIdeas(db)]);
  const prompt = buildPrompt({ signals, interests, recentIdeas: ideas.slice(0, 50), count });
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    tools: [proposeIdeasTool],
    tool_choice: { type: "tool", name: proposeIdeasTool.name },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b) => b.type === "tool_use");
  return parseProposals(toolUse?.input, new Set(signals.map((s) => s.id)));
}

/** Generates ideas from fresh signals and adds them to the inbox, linked to their signals. */
export async function generateIdeas(db: Db, options: GenerateOptions): Promise<Idea[]> {
  const proposals = await proposeIdeas(db, options);
  const created: Idea[] = [];
  for (const p of proposals) {
    created.push(
      await createIdea(db, { title: p.title, pitch: p.pitch, notes: p.whyNow, origin: "automation" }, p.signalIds),
    );
  }
  return created;
}
