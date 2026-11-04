import { describe, expect, it } from "vitest";
import {
  buildDocument,
  decodeConfig,
  encodeConfig,
  frameAttrs,
  NO_NETWORK_CSP,
  PRESETS,
  probeOptions,
  snippet,
  type Config,
} from "./config.ts";

const opts = probeOptions({ nonce: "abc123", mode: "kit", kitOrigin: "https://kit.test", topUrl: "https://kit.test/?e=srcdoc", canary: "abc123" });

describe("share links", () => {
  it("round-trips every preset", () => {
    for (const p of PRESETS) expect(decodeConfig(encodeConfig(p.config))).toEqual(p.config);
  });

  it("keeps 'no sandbox' distinct from an empty sandbox", () => {
    const none: Config = { ...PRESETS[0]!.config, sandbox: null };
    const empty: Config = { ...PRESETS[0]!.config, sandbox: [] };
    expect(decodeConfig(encodeConfig(none))?.sandbox).toBeNull();
    expect(decodeConfig(encodeConfig(empty))?.sandbox).toEqual([]);
  });

  it("drops unknown tokens and rejects junk", () => {
    expect(decodeConfig("e=srcdoc&s=allow-scripts+allow-everything")?.sandbox).toEqual(["allow-scripts"]);
    expect(decodeConfig("e=iframe&s=allow-scripts")).toBeUndefined();
    expect(decodeConfig("")).toBeUndefined();
  });
});

describe("the framed document", () => {
  it("adds the CSP meta only when one is chosen, escaped", () => {
    const plain = buildDocument(PRESETS[0]!.config, opts);
    expect(plain).not.toContain("Content-Security-Policy");
    const locked = buildDocument({ ...PRESETS[0]!.config, csp: "no-network" }, opts);
    expect(locked).toContain(`content="${NO_NETWORK_CSP.replace(/'/g, "'")}"`);
    const custom = buildDocument({ ...PRESETS[0]!.config, csp: "custom", customCsp: `default-src "x"><script>` }, opts);
    expect(custom).toContain("default-src &quot;x&quot;&gt;&lt;script&gt;");
  });

  it("can't close its own script tag through the options", () => {
    const doc = buildDocument(null, { ...opts, topUrl: "https://kit.test/</script><b>" });
    expect(doc.match(/<\/script>/g)).toHaveLength(1);
  });

  it("embeds a probe function that parses on its own", () => {
    const doc = buildDocument(null, opts);
    const body = doc.slice(doc.indexOf("<script>") + 8, doc.lastIndexOf("</script>"));
    expect(() => new Function(body)).not.toThrow();
  });
});

describe("iframe attributes", () => {
  it("omits the sandbox attribute only when there is no sandbox", () => {
    expect(frameAttrs({ ...PRESETS[0]!.config, sandbox: null }).sandbox).toBeNull();
    expect(frameAttrs({ ...PRESETS[0]!.config, sandbox: [] }).sandbox).toBe("");
    expect(snippet(PRESETS[0]!.config)).toContain('sandbox="allow-scripts"');
    expect(snippet({ ...PRESETS[0]!.config, sandbox: null })).toContain("no sandbox attribute");
  });
});
