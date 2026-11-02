import { describe, expect, it } from "vitest";
import { extractSvg, looksDrawable, sanitizeSvg } from "./svg.ts";

describe("extractSvg", () => {
  it("pulls the svg out of a fenced reply with chatter", () => {
    const reply = "Here you go!\n```svg\n<svg viewBox=\"0 0 10 10\"><circle r=\"1\"/></svg>\n```\nEnjoy.";
    expect(extractSvg(reply)).toBe('<svg viewBox="0 0 10 10"><circle r="1"/></svg>');
  });

  it("keeps only the first of several svgs", () => {
    expect(extractSvg("<svg><rect/></svg> and <svg><circle/></svg>")).toBe("<svg><rect/></svg>");
  });

  it("returns null when there is no svg", () => {
    expect(extractSvg("I can't draw.")).toBeNull();
    expect(extractSvg("<svg unfinished")).toBeNull();
  });
});

describe("sanitizeSvg", () => {
  it("strips scripts, event handlers, foreignObject and remote references", () => {
    const dirty =
      '<svg width="200" height="100"><script>alert(1)</script><rect onclick="alert(2)" width="5"/>' +
      '<foreignObject><div>hi</div></foreignObject><image href="https://evil.test/x.png"/>' +
      '<a xlink:href="javascript:alert(3)"><circle r="2" style="fill:url(https://evil.test/f)"/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/script|onclick|foreignObject|evil\.test|javascript:/i);
    expect(clean).toContain('<rect width="5"/>');
  });

  it("adds xmlns and a viewBox from width/height so it scales", () => {
    const clean = sanitizeSvg('<svg width="400" height="300"><rect/></svg>');
    expect(clean).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(clean).toContain('viewBox="0 0 400 300"');
  });

  it("leaves an existing viewBox alone", () => {
    const clean = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="9" height="9"/>');
    expect(clean.match(/viewBox/g)).toHaveLength(1);
  });
});

describe("looksDrawable", () => {
  it("needs a few shapes", () => {
    expect(looksDrawable("<svg><rect/></svg>")).toBe(false);
    expect(looksDrawable("<svg><rect/><circle/><path d='M0 0'/></svg>")).toBe(true);
  });
});
