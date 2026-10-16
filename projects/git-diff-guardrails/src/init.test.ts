import { describe, expect, it, vi } from "vitest";
import { buildPrompt, findInstructionFiles, generateRules, layoutSummary, parseGeneratedRules } from "./init.ts";
import { tempRepo } from "./test-helpers.ts";

describe("parseGeneratedRules", () => {
  it("keeps valid rules, drops invalid ones, and strips empty fields", () => {
    const result = parseGeneratedRules({
      rules: [
        { id: "no-env", type: "file", paths: [".env"], message: "No .env", source: "AGENTS.md: never commit .env", exclude: [], pattern: "" },
        { id: "broken", type: "line", pattern: "(", message: "x" },
        { id: "no-env", type: "file", paths: [".env"], message: "dup" },
      ],
      skipped: ["Prefer small PRs", 3],
    });
    expect(result.rules).toEqual([{ id: "no-env", type: "file", paths: [".env"], message: "No .env", source: "AGENTS.md: never commit .env" }]);
    expect(result.dropped.map((d) => d.problems)).toEqual([[expect.stringContaining("invalid pattern")], ["duplicate id"]]);
    expect(result.skipped).toEqual(["Prefer small PRs"]);
  });

  it("tolerates garbage", () => {
    expect(parseGeneratedRules(undefined)).toEqual({ rules: [], skipped: [], dropped: [] });
  });
});

describe("findInstructionFiles", () => {
  it("finds root and nested instruction files", () => {
    const { dir, write } = tempRepo();
    write("AGENTS.md", "# Rules");
    write("CLAUDE.md", "See AGENTS.md");
    write(".github/copilot-instructions.md", "copilot");
    write("packages/api/AGENTS.md", "api rules");
    const files = findInstructionFiles(dir, ["AGENTS.md", "CLAUDE.md", "packages/api/AGENTS.md", "node_modules/y/CLAUDE.md"]);
    expect(files.map((f) => f.path)).toEqual(["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md", "packages/api/AGENTS.md"]);
    expect(files[3]!.content).toBe("api rules");
  });
});

describe("generateRules", () => {
  it("calls the Messages API and parses the tool call", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Here you go" },
          { type: "tool_use", name: "write_rules", input: { rules: [{ id: "a", type: "line", pattern: "x", message: "m", source: "s" }], skipped: [] } },
        ],
      }),
    );
    const files = [{ path: "AGENTS.md", content: "- Never use x" }];
    const result = await generateRules(files, "src/ (1 files)", { apiKey: "k", model: "m", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(result.rules.map((r) => r.id)).toEqual(["a"]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("m");
    expect(body.tool_choice).toEqual({ type: "auto" });
    expect(body.messages[0].content).toContain("- Never use x");
  });

  it("surfaces API errors and missing tool calls", async () => {
    const files = [{ path: "AGENTS.md", content: "x" }];
    const err = vi.fn(async () => new Response("bad key", { status: 401 }));
    await expect(generateRules(files, "", { apiKey: "k", fetch: err as unknown as typeof fetch })).rejects.toThrow(/401: bad key/);
    const none = vi.fn(async () => Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: "no" }] }));
    await expect(generateRules(files, "", { apiKey: "k", fetch: none as unknown as typeof fetch })).rejects.toThrow(/did not call write_rules/);
  });
});

describe("prompt", () => {
  it("includes every file and the layout", () => {
    const layout = layoutSummary(["README.md", "src/a.ts", "src/b.ts"]);
    expect(layout).toContain("src/ (2 files)");
    const prompt = buildPrompt([{ path: "apps/web/AGENTS.md", content: "Use @/ imports" }], layout);
    expect(prompt).toContain("## apps/web/AGENTS.md");
    expect(prompt).toContain("Use @/ imports");
  });
});
