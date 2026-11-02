import { describe, expect, it } from "vitest";
import { detectBrowser } from "./probe.ts";

describe("detectBrowser", () => {
  it("tells the major browsers apart", () => {
    const chrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    expect(detectBrowser(chrome)).toBe("chrome");
    expect(detectBrowser(`${chrome} Edg/141.0.0.0`)).toBe("edge");
    expect(detectBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:133.0) Gecko/20100101 Firefox/133.0")).toBe("firefox");
    expect(detectBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("safari");
    expect(detectBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1")).toBe("chrome");
  });
});
