import { describe, expect, it } from "vitest";
import { PRESETS, type Config } from "./config.ts";
import type { Fact } from "./payload.ts";
import { judge, summarize, toMarkdown, type Observed } from "./verdict.ts";

const ORIGIN = "https://kit.test";
const scriptsOnly = PRESETS.find((p) => p.id === "scripts-only")!.config;
const sameOrigin = PRESETS.find((p) => p.id === "same-origin")!.config;

function observed(facts: Fact[], extra: Partial<Observed> = {}): Observed {
  return { facts, settled: true, navigated: new Set(), origin: ORIGIN, ...extra };
}

const opaque: Fact[] = [
  { id: "scripts", value: true },
  { id: "origin", value: "null" },
  { id: "parent-dom", value: false },
  { id: "cookies", value: false },
  { id: "storage", value: false },
  { id: "read-api", value: false },
  { id: "service-worker", value: false },
  { id: "fetch-out", value: true },
  { id: "image-out", value: true },
  { id: "forms", value: false },
  { id: "features", value: [] },
  { id: "top-nav", value: "blocked" },
];

const status = (config: Config, o: Observed, id: string) => judge(config, o).find((f) => f.id === id)?.status;

describe("judge", () => {
  it("calls a scripts-only sandbox contained but leaky", () => {
    const findings = judge(scriptsOnly, observed(opaque));
    expect(findings.find((f) => f.id === "origin")?.status).toBe("pass");
    expect(findings.find((f) => f.id === "fetch-out")?.status).toBe("warn");
    expect(findings.filter((f) => f.status === "fail")).toEqual([]);
    expect(summarize(findings).tone).toBe("meh");
  });

  it("fails a frame that shares the page's origin", () => {
    const facts: Fact[] = opaque.map((f) =>
      f.id === "origin" ? { ...f, value: ORIGIN } : ["parent-dom", "cookies", "storage", "read-api"].includes(f.id) ? { ...f, value: true } : f,
    );
    const findings = judge(sameOrigin, observed(facts));
    for (const id of ["origin", "parent-dom", "cookies", "storage", "read-api"]) {
      expect(findings.find((f) => f.id === id)?.status, id).toBe("fail");
    }
    expect(summarize(findings).title).toBe("The sandbox leaks");
  });

  it("trusts the kit's own hash observation for top navigation, not the frame's claim", () => {
    const attempted = opaque.map((f) => (f.id === "top-nav" ? { ...f, value: "attempted" } : f));
    expect(status(scriptsOnly, observed(attempted), "top-nav")).toBe("pass");
    expect(status(scriptsOnly, observed(attempted, { navigated: new Set(["top-nav"]) }), "top-nav")).toBe("fail");
  });

  it("only fails popups that escape the sandbox", () => {
    const clicked: Fact[] = [...opaque, { id: "popup-click", value: true }];
    expect(status(scriptsOnly, observed(clicked), "popup-click")).toBe("info");
    const escaping: Config = { ...scriptsOnly, sandbox: ["allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"] };
    expect(status(escaping, observed(clicked), "popup-click")).toBe("fail");
    expect(summarize(judge(escaping, observed(clicked))).blurb).toContain("can't act as your site");
  });

  it("credits form-action 'none' even when the sandbox allows forms", () => {
    const forms = opaque.map((f) => (f.id === "forms" ? { ...f, value: true } : f));
    expect(status(scriptsOnly, observed(forms), "forms")).toBe("warn");
    expect(status({ ...scriptsOnly, csp: "no-network" }, observed(forms), "forms")).toBe("pass");
  });

  it("treats silence after the deadline as scripts blocked", () => {
    const findings = judge({ ...scriptsOnly, sandbox: [] }, observed([]));
    expect(findings[0]).toMatchObject({ id: "scripts", status: "pass" });
    expect(summarize(findings).tone).toBe("good");
  });

  it("reports probing while facts are still arriving", () => {
    expect(summarize(judge(scriptsOnly, observed([], { settled: false }))).tone).toBe("wait");
  });

  it("writes a Markdown report with fixes for what got out", () => {
    const md = toMarkdown(scriptsOnly, judge(scriptsOnly, observed(opaque)), '<iframe sandbox="allow-scripts">', "https://kit.test/?e=srcdoc");
    expect(md).toContain("## Sandbox Check: Contained, with open doors");
    expect(md).toContain("| WARN | Sends data out with fetch |");
    expect(md).toContain("### Fixes");
  });
});
